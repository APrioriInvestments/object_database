/******************************************************************************
   Copyright 2017-2020 object_database Authors

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
******************************************************************************/

#pragma once

#include <Python.h>
#include <deque>
#include <map>
#include <memory>
#include <vector>
#include <string>
#include <iostream>
#include <condition_variable>
#include <fcntl.h>
#include <openssl/ssl.h>

#include "typed_python/Format.hpp"
#include "DatabaseConnectionPumpLoop.hpp"


/***********
Two threads - one for handling serialization and message processing

the other for handling interacting with python objects, with the point being
that the GIL can get blocked for a long time, and we don't want that to preclude
us heartbeating.
***********/

// declaration of the PySSL socket datastructure which is contained
// in _ssl.c. We need it because we want to let python create and destroy
// the SSL sockets. Our job is just to read and write from them.

enum py_ssl_server_or_client {
    PY_SSL_CLIENT,
    PY_SSL_SERVER
};

typedef struct {
    int ssl; /* last seen error from SSL */
    int c; /* last seen error from libc */
#ifdef MS_WINDOWS
    int ws; /* last seen error from winsock */
#endif
} _PySSLError;

typedef struct {
    PyObject_HEAD
    PyObject *Socket; /* weakref to socket on which we're layered */
    SSL *ssl;
    PyObject *ctx; /* weakref to SSL context */
    char shutdown_seen_zero;
    enum py_ssl_server_or_client socket_type;
    PyObject *owner; /* Python level "owner" passed to servername callback */
    PyObject *server_hostname;
    _PySSLError err; /* last seen error from various sources */
    /* Some SSL callbacks don't have error reporting. Callback wrappers
     * store exception information on the socket. The handshake, read, write,
     * and shutdown methods check for chained exceptions.
     */
    PyObject *exc_type;
    PyObject *exc_value;
    PyObject *exc_tb;
} PySSLSocket;

// extern PyTypeObject PySSLSocket_Type;

class DatabaseConnectionPumpLoop {
public:
    DatabaseConnectionPumpLoop(PySSLSocket* pySslSocket) :
        mSocket((PySSLSocket*)incref((PyObject*)pySslSocket)),
        mSSL(mSocket->ssl),
        mIsClosed(false),
        mHeartbeatInterval(0),
        mMessagesInWriteBufferFrontPartSent(0),
        mHasReadSizeOfFrontMessage(false)
    {
        mSSLSocketFD = SSL_get_fd(mSSL);

        if (fcntl(mSSLSocketFD, F_SETFL, fcntl(mSSLSocketFD, F_GETFL, 0) | O_NONBLOCK) == -1) {
            throw std::runtime_error("Failed to mark our socket nonblocking.");
        }

        if (pipe(mWakePipe) == -1) {
            throw std::runtime_error("Failed to allocate the wake pipe.");
        }
    }

    ~DatabaseConnectionPumpLoop() {
        PyEnsureGilAcquired getTheGil;
        decref((PyObject*)mSocket);
    }

    static double curClock() {
        struct timespec ts;
        clock_gettime(CLOCK_REALTIME, &ts);
        return ts.tv_sec + ts.tv_nsec / 1000000000.0;
    }

    void setHeartbeatMessage(std::string msg, float frequency) {
        std::unique_lock<std::mutex> lock(mMutex);

        mHeartbeatMessage = msg;
        mNextHeartbeat = curClock() + frequency;
        mHeartbeatInterval = frequency;
        mMessagesToSend.push_back(msg);

        //wake up the reader
        ::write(mWakePipe[1], (void*)" ", 1);
    }

    // really, this is the 'select loop'
    void writeLoop() {
        PyEnsureGilReleased releaseTheGil;

        size_t selectsWithNoUpdate = 0;

        try {
            while (true) {
                // lock the lock and pull any messages off we need to send;
                {
                    std::unique_lock<std::mutex> lock(mMutex);

                    if (mIsClosed) {
                        ensureSslSocketClosed();
                        return;
                    }

                    if (curClock() > mNextHeartbeat && mHeartbeatMessage.size() && mHeartbeatInterval > 0.0) {
                        mMessagesToSend.push_back(mHeartbeatMessage);
                        mNextHeartbeat = curClock() + mHeartbeatInterval;
                    }

                    while (mMessagesToSend.size()) {
                        std::string msg = mMessagesToSend.front();
                        mMessagesToSend.pop_front();

                        uint32_t bytesToSend = msg.size();

                        mMessagesInWriteBuffer.push_back(
                            std::string((char*)&bytesToSend, (char*)&bytesToSend + sizeof(uint32_t))
                        );
                        mMessagesInWriteBuffer.push_back(msg);
                    }
                }

                if (SSL_get_shutdown(mSSL)) {
                    close("Socket shut down");
                    return;
                }

                // make sure we don't have any writes we need to flush before we go to sleep.
                writeAnyPendingDataToSocket();

                fd_set readFds;
                fd_set writeFds;

                FD_ZERO(&readFds);
                FD_ZERO(&writeFds);

                FD_SET(mSSLSocketFD, &readFds);
                FD_SET(mWakePipe[0], &readFds);

                bool wantedToWrite = false;
                if ((mMessagesInWriteBuffer.size() && !(SSL_want_read(mSSL) && selectsWithNoUpdate > 2)) || SSL_want_write(mSSL)) {
                    FD_SET(mSSLSocketFD, &writeFds);
                    wantedToWrite = true;
                }

                timeval toSleep;
                toSleep.tv_sec = 0;
                toSleep.tv_usec = 0;

                bool wantsToWakeUp = false;
                double t0 = curClock();
                double sleepSeconds = mNextHeartbeat - t0;

                if (mHeartbeatMessage.size() && mHeartbeatInterval > 0.0) {
                    wantsToWakeUp = true;
                    if (sleepSeconds < 0) {
                        sleepSeconds = 0.00001;
                    }

                    toSleep.tv_sec = int(sleepSeconds);
                    toSleep.tv_usec = 1000000 * (sleepSeconds - toSleep.tv_sec);
                }

                int selectRes = select(
                    std::max(mWakePipe[0], mSSLSocketFD) + 1,
                    &readFds,
                    &writeFds,
                    NULL,
                    wantsToWakeUp ? &toSleep : NULL
                );

                // if we blocked for a while, reset our counter, we're not in a
                // spin loop.
                if (curClock() - t0 > 0.01) {
                    selectsWithNoUpdate = 0;
                }

                if (curClock() - t0 > 1.0 && wantedToWrite) {
                    std::cerr << "WARNING: spent more than 1 second asleep even though we had writes.\n";
                }

                if (selectRes == -1) {
                    throw std::runtime_error("Warning: SELECT failed.");
                }

                bool sslSocketWriteable = FD_ISSET(mSSLSocketFD, &writeFds);
                bool sslSocketReadable = FD_ISSET(mSSLSocketFD, &readFds);
                bool wakePipeReadable = FD_ISSET(mWakePipe[0], &readFds);

                if (wakePipeReadable) {
                    // just read whatever data off here we can. we
                    // don't care about it because we just use the pipe
                    // to wake ourselves up.
                    char buffer[1024];
                    ::read(mWakePipe[0], buffer, 1024);
                }

                // always try to read/write on the socket. ssl will push back if
                // its a problem
                bool wroteAny = readAnyPendingDataOnSocket();

                if (writeAnyPendingDataToSocket()) {
                    wroteAny = true;
                }

                if (wroteAny) {
                    selectsWithNoUpdate = 0;
                } else {
                    selectsWithNoUpdate++;
                }

                if (selectsWithNoUpdate && selectsWithNoUpdate % 1000 == 0) {
                    std::cerr << "DatabaseConnectionPumpLoop had "
                        << selectsWithNoUpdate << " updates with no progress. "
                        << mMessagesInWriteBuffer.size() << " messages.  "
                        << "SSL_want_write(mSSL) = " << (SSL_want_write(mSSL) ? "true":"false") << ", "
                        << "SSL_want_read(mSSL) = " << (SSL_want_read(mSSL) ? "true":"false") << ", "
                        << "sslSocketWriteable: " << (sslSocketWriteable? "true":"false") << ". "
                        << "sslSocketReadable: " << (sslSocketReadable? "true":"false") << ". "
                        << "wakePipeReadable: " << (wakePipeReadable? "true":"false") << ". "
                        << "\n"
                    ;
                }
            }
        } catch(...) {
            ensureSslSocketClosed();
            throw;
        }
    }

    bool readAnyPendingDataOnSocket() {
        const int BUFSIZE = 1024 * 128;
        char buffer[BUFSIZE];

        // read some data
        int res = SSL_read(mSSL, buffer, BUFSIZE);

        if (res > 0) {
            consumeReadBytes(buffer, res);
            return true;
        }

        if (res == 0) {
            //socket was closed
            close("graceful shutdown during read");
            return false;
        }

        //something bad happened
        int err = SSL_get_error(mSSL, res);

        if (err == SSL_ERROR_ZERO_RETURN) {
            close("graceful shutdown during read");
            return false;
        }
        else if (err == SSL_ERROR_WANT_WRITE || err == SSL_ERROR_WANT_READ) {
            return false;
        }
        else if (err == SSL_ERROR_WANT_CONNECT) {
            close("read error: ssl want connect");
            throw std::runtime_error("Unexpected SSL_ERROR_WANT_CONNECT in 'readBytes'");
        }
        else if (err == SSL_ERROR_WANT_ACCEPT) {
            close("read error: ssl want accept");
            throw std::runtime_error("Unexpected SSL_ERROR_WANT_ACCEPT in 'readBytes'");
        }
        else if (err == SSL_ERROR_WANT_X509_LOOKUP) {
            close("read error: want x509 lookup");
            throw std::runtime_error("Unexpected SSL_ERROR_WANT_X509_LOOKUP in 'readBytes'");
        }
        else if (err == SSL_ERROR_SYSCALL) {
            close("read error: bad syscall");
            throw std::runtime_error("Unexpected SSL_ERROR_SYSCALL in 'readBytes'");
        }
        else if (err == SSL_ERROR_SSL) {
            close("read error: ssl error");
            throw std::runtime_error("Unexpected SSL_ERROR_SSL in 'readBytes'");
        } else {
            close("read error: unknown");
            throw std::runtime_error("Unexpected unknown error in 'readBytes'");
        }

        return false;
    }

    void consumeReadBytes(char* bytes, size_t bytecount) {
        while (bytecount ||
            (mHasReadSizeOfFrontMessage && mPartiallyReadFrontMessageSize == mPartiallyReadFrontMessage.size())
        ) {
            if (mHasReadSizeOfFrontMessage) {
                if (mPartiallyReadFrontMessageSize == mPartiallyReadFrontMessage.size()) {
                    // consume the message
                    messageReceived(
                        std::string(
                            mPartiallyReadFrontMessage.begin(),
                            mPartiallyReadFrontMessage.end()
                        )
                    );

                    mPartiallyReadFrontMessage.resize(0);
                    mHasReadSizeOfFrontMessage = false;
                } else {
                    // copy into the main buffer
                    size_t toConsume = std::min(
                        mPartiallyReadFrontMessageSize - mPartiallyReadFrontMessage.size(),
                        bytecount
                    );

                    copyFromBuffer(bytes, bytecount, toConsume);
                }
            } else {
                if (mPartiallyReadFrontMessage.size() == sizeof(uint32_t)) {
                    // we have the 4 bytes. copy the size out and clear the buffer
                    mHasReadSizeOfFrontMessage = true;
                    mPartiallyReadFrontMessageSize = *(uint32_t*)&mPartiallyReadFrontMessage[0];
                    mPartiallyReadFrontMessage.resize(0);
                } else {
                    // we don't have the 4 bytes yet. grab them.
                    uint32_t toConsume = std::min(
                        sizeof(uint32_t) - mPartiallyReadFrontMessage.size(),
                        bytecount
                    );

                    copyFromBuffer(bytes, bytecount, toConsume);
                }
            }
        }
    }

    void copyFromBuffer(char* &bytes, size_t& bytecount, size_t toConsume) {
        size_t oldSize = mPartiallyReadFrontMessage.size();

        // make size on the buffer
        mPartiallyReadFrontMessage.resize(mPartiallyReadFrontMessage.size() + toConsume);

        // copy from our stack buffer into this one
        memcpy(&mPartiallyReadFrontMessage[oldSize], bytes, toConsume);

        // update the stack buffer.
        bytes += toConsume;
        bytecount -= toConsume;
    }

    bool writeAnyPendingDataToSocket() {
        bool wroteSome = false;

        while (mMessagesInWriteBuffer.size()) {
            if (mMessagesInWriteBufferFrontPartSent >= mMessagesInWriteBuffer.front().size()) {
                mMessagesInWriteBufferFrontPartSent = 0;
                mMessagesInWriteBuffer.pop_front();
            } else {
                // we still have some data
                int bytesWritten = SSL_write(
                    mSSL,
                    &mMessagesInWriteBuffer.front()[mMessagesInWriteBufferFrontPartSent],
                    mMessagesInWriteBuffer.front().size() - mMessagesInWriteBufferFrontPartSent
                );

                if (bytesWritten > 0) {
                    mMessagesInWriteBufferFrontPartSent += bytesWritten;

                    wroteSome = true;
                } else {
                    if (bytesWritten == 0) {
                        close("graceful shutdown during write");
                        return false;
                    }

                    //something bad happened
                    int err = SSL_get_error(mSSL, bytesWritten);

                    if (err == SSL_ERROR_ZERO_RETURN) {
                        close("graceful shutdown during write");
                        return false;
                    }
                    else if (err == SSL_ERROR_WANT_WRITE || err == SSL_ERROR_WANT_READ) {
                        return wroteSome;
                    }
                    else if (err == SSL_ERROR_WANT_CONNECT) {
                        close("write error: ssl want connect");
                        throw std::runtime_error("Unexpected SSL_ERROR_WANT_CONNECT in 'writeBytes'");
                    }
                    else if (err == SSL_ERROR_WANT_ACCEPT) {
                        close("write error: ssl want accept");
                        throw std::runtime_error("Unexpected SSL_ERROR_WANT_ACCEPT in 'writeBytes'");
                    }
                    else if (err == SSL_ERROR_WANT_X509_LOOKUP) {
                        close("write error: ssl want x509 lookup");
                        throw std::runtime_error("Unexpected SSL_ERROR_WANT_X509_LOOKUP in 'writeBytes'");
                    }
                    else if (err == SSL_ERROR_SYSCALL) {
                        close("write error: ssl bad syscall");
                        throw std::runtime_error("Unexpected SSL_ERROR_SYSCALL in 'writeBytes'");
                    }
                    else if (err == SSL_ERROR_SSL) {
                        close("write error: ssl error ssl");
                        throw std::runtime_error("Unexpected SSL_ERROR_SSL in 'writeBytes'");
                    } else {
                        close("unknown write error");
                        throw std::runtime_error("Unexpected unknown error in 'writeBytes'");
                    }
                }
            }
        }

        return wroteSome;
    }

    void ensureSslSocketClosed() {
        if (SSL_get_shutdown(mSSL) == 0) {
            SSL_shutdown(mSSL);
        }

        ::close(mWakePipe[0]);
        ::close(mWakePipe[1]);
    }

    void messageReceived(const std::string& msg) {
        std::unique_lock<std::mutex> lock(mMutex);

        mMessagesReceived.push_back(msg);

        mHasReceivedMessages.notify_all();
    }

    // really, this is the 'event loop'
    void readLoop(PyObject* callback) {
        PyEnsureGilReleased releaseTheGil;

        while (true) {
            std::vector<std::string> toFire;

            {
                std::unique_lock<std::mutex> lock(mMutex);

                if (mIsClosed) {
                    return;
                }

                if (mMessagesReceived.size() == 0) {
                    mHasReceivedMessages.wait(lock);
                }

                std::swap(toFire, mMessagesReceived);
            }

            if (toFire.size()) {
                callOnMessage(toFire, callback);
            }
        }
    }

    void callOnMessage(const std::vector<std::string>& messages, PyObject* callback) {
        PyEnsureGilAcquired getTheGil;

        for (const auto& msg: messages) {
            if (!msg.size()) {
                throw std::runtime_error("Improperly formed message in DatabaseConnectionPumpLoop");
            }

            PyObject* bytes = PyBytes_FromStringAndSize(&msg[0], msg.size());

            PyObject* res = PyObject_CallFunctionObjArgs(
                callback,
                bytes,
                NULL
            );

            decref(bytes);

            if (!res) {
                throw PythonExceptionSet();
            } else {
                decref(res);
            }
        }
    }

    bool write(const char* data, size_t bytes) {
        std::unique_lock<std::mutex> lock(mMutex);

        if (mIsClosed) {
            return false;
        }

        mMessagesToSend.push_back(std::string(data, data + bytes));

        if (::write(mWakePipe[1], (void*)" ", 1) != 1) {
            std::cerr << "Warning: failed to write to the wake-pipe" << std::endl;
        }

        return true;
    }

    void close(const char* reason) {
        PyEnsureGilReleased releaseTheGil;

        std::unique_lock<std::mutex> lock(mMutex);

        if (!mIsClosed) {
            mIsClosed = true;

            // place a byte on the wake pipe. it should
            // wake up and check the mIsClosed flag
            ::write(mWakePipe[1], (void*)" ", 1);

            // also wake the read thread.
            mHasReceivedMessages.notify_all();
        }
    }

    bool isClosed() {
        std::unique_lock<std::mutex> lock(mMutex);

        return mIsClosed;
    }

private:
    PySSLSocket* mSocket;
    SSL* mSSL;

    bool mIsClosed;

    // all messages, in order, that we have received but
    // not fired on the 'read' loop.
    std::vector<std::string> mMessagesReceived;

    // condition variable the 'read' loop waits on
    std::condition_variable mHasReceivedMessages;

    // messages we want to send. There will be exactly 1 for
    // each byte placed on the 'wake pipe'. These have not
    // been picked up by the socket thread yet.
    std::deque<std::string> mMessagesToSend;

    // a little state machine that contains the actual packets
    // we want to send. mMessagesInWriteBuffer contains alternating
    // 4 byte messages (encoding size) and then the actual message.
    // mMessagesInWriteBufferFrontPartSent is the number of bytes
    // in mMessagesInWriteBuffer.front() that have been flushed to
    // the socket.
    size_t mMessagesInWriteBufferFrontPartSent;
    std::deque<std::string> mMessagesInWriteBuffer;

    // a little statemachine for the front message we're reading.
    // if we are reading the 4 bytes containing the message size,
    // then mHasReadSizeOfFrontMessage is false, otherwise true.
    // if we have read the size then mPartiallyReadFrontMessageSize is
    // the size we're expecting.
    // mPartiallyReadFrontMessage contains the actual bytes we've read
    bool mHasReadSizeOfFrontMessage;
    size_t mPartiallyReadFrontMessageSize;
    std::vector<char> mPartiallyReadFrontMessage;

    std::mutex mMutex;

    std::string mHeartbeatMessage;
    double mNextHeartbeat;
    double mHeartbeatInterval;

    int mWakePipe[2];

    int mSSLSocketFD;
};
