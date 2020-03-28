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
        mHeartbeatInterval(0)
    {
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
        mMessages.push_back(msg);
    }

    void writeLoop() {
        PyEnsureGilReleased releaseTheGil;

        while (true) {
            if (mIsClosed) {
                return;
            }

            std::unique_lock<std::mutex> lock(mMutex);

            if (mHeartbeatInterval > 0.0) {
                double t0 = curClock();

                while (t0 >= mNextHeartbeat) {
                    mMessages.push_back(mHeartbeatMessage);
                    mNextHeartbeat += mHeartbeatInterval;
                }
            }

            if (mMessages.size()) {
                std::string msg = mMessages.front();
                mMessages.pop_front();

                lock.unlock();

                uint32_t bytes = msg.size();
                if (!writeBytes((const char*)&bytes, sizeof(bytes))) {
                    return;
                }
                if (!writeBytes((const char*)&msg[0], msg.size())) {
                    return;
                }
            } else {
                if (mHeartbeatInterval > 0.0) {
                    double t0 = curClock();
                    if (mNextHeartbeat > t0) {
                        mHasMessageCond.wait_for(
                            lock,
                            std::chrono::nanoseconds(int64_t((mNextHeartbeat - t0) * 1000000000.0))
                        );
                    }
                } else {
                    mHasMessageCond.wait(lock);
                }
            }
        }
    }

    void readLoop(PyObject* callback) {
        PyEnsureGilReleased releaseTheGil;

        while (true) {
            if (mIsClosed) {
                return;
            }

            uint32_t bytecount;
            if (!readBytes((char*)&bytecount, sizeof(bytecount))) {
                return;
            }

            std::vector<char> dat;

            const int BUFSIZE = 1024 * 64;

            while (bytecount > 0) {
                int toRead = bytecount;

                // if we have a large buffer, read twice as much data
                // in each slug. This prevents someone from blowing us up
                // with a message with a bad size, but also amortizes
                // the resize costs.
                if (toRead > BUFSIZE) {
                    if (dat.size() == 0) {
                        toRead = BUFSIZE;
                    } else
                    if (toRead > dat.size()) {
                        toRead = dat.size();
                    }
                }

                dat.resize(dat.size() + toRead);

                if (!readBytes(&dat[0] + dat.size() - toRead, toRead)) {
                    return;
                }

                bytecount -= toRead;
            }

            callOnMessage(dat, callback);
        }
    }

    void callOnMessage(const std::vector<char>& data, PyObject* callback) {
        PyEnsureGilAcquired getTheGil;

        if (!data.size()) {
            throw std::runtime_error("Improperly formed message in DatabaseConnectionPumpLoop");
        }

        PyObject* bytes = PyBytes_FromStringAndSize(&data[0], data.size());

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

    bool writeBytes(const char* bytes, size_t bytecount) {
        if (!bytecount) {
            return true;
        }

        while (true) {
            if (SSL_get_shutdown(mSSL)) {
                return false;
            }

            int res = SSL_write(mSSL, bytes, bytecount);

            if (res == bytecount) {
                return true;
            }

            if (res > 0) {
                bytes += res;
                bytecount -= res;
                continue;
            }

            if (res == 0) {
                //socket was closed
                close("graceful shutdown during write");
                return false;
            }

            //something bad happened
            int err = SSL_get_error(mSSL, res);

            if (err == SSL_ERROR_ZERO_RETURN) {
                close("graceful shutdown during write");
                return false;
            }
            else if (err == SSL_ERROR_WANT_WRITE || err == SSL_ERROR_WANT_READ) {
                // do nothing
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

    bool readBytes(char* bytes, size_t bytecount) {
        while (true) {
            if (SSL_get_shutdown(mSSL)) {
                return false;
            }

            int res = SSL_read(mSSL, bytes, bytecount);

            if (res == bytecount) {
                return true;
            }

            if (res > 0) {
                bytes += res;
                bytecount -= res;
                continue;
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
                // do nothing
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
        }
    }

    bool write(const char* data, size_t bytes) {
        std::unique_lock<std::mutex> lock(mMutex);

        if (mIsClosed) {
            return false;
        }

        mMessages.push_back(std::string(data, data + bytes));

        mHasMessageCond.notify_all();

        return true;
    }

    void close(const char* reason) {
        PyEnsureGilReleased releaseTheGil;

        std::unique_lock<std::mutex> lock(mMutex);

        if (!mIsClosed) {
            mIsClosed = true;

            if (SSL_get_shutdown(mSSL) == 0) {
                SSL_shutdown(mSSL);
            }
        }

        mHasMessageCond.notify_all();
    }

    bool isClosed() {
        std::unique_lock<std::mutex> lock(mMutex);

        return mIsClosed;
    }

private:
    PySSLSocket* mSocket;
    SSL* mSSL;

    bool mIsClosed;

    std::deque<std::string> mMessages;
    std::condition_variable mHasMessageCond;

    std::mutex mMutex;

    std::string mHeartbeatMessage;
    double mNextHeartbeat;
    double mHeartbeatInterval;

};
