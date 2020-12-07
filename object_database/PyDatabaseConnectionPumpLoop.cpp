/******************************************************************************
   Copyright 2017-2019 object_database Authors

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

#include "PyDatabaseConnectionPumpLoop.hpp"
#include "ObjectFieldId.hpp"
#include "IndexId.hpp"
#include "direct_types/all.hpp"
#include <typed_python/SerializationContext.hpp>
#include <typed_python/PythonSerializationContext.hpp>

PyMethodDef PyDatabaseConnectionPumpLoop_methods[] = {
    {"readLoop", (PyCFunction)PyDatabaseConnectionPumpLoop::readLoop, METH_VARARGS | METH_KEYWORDS, NULL},
    {"writeLoop", (PyCFunction)PyDatabaseConnectionPumpLoop::writeLoop, METH_VARARGS | METH_KEYWORDS, NULL},
    {"write", (PyCFunction)PyDatabaseConnectionPumpLoop::write, METH_VARARGS | METH_KEYWORDS, NULL},
    {"close", (PyCFunction)PyDatabaseConnectionPumpLoop::close, METH_VARARGS | METH_KEYWORDS, NULL},
    {"isClosed", (PyCFunction)PyDatabaseConnectionPumpLoop::isClosed, METH_VARARGS | METH_KEYWORDS, NULL},
    {"setHeartbeatMessage", (PyCFunction)PyDatabaseConnectionPumpLoop::setHeartbeatMessage, METH_VARARGS | METH_KEYWORDS, NULL},
    {NULL}  /* Sentinel */
};


/* static */
void PyDatabaseConnectionPumpLoop::dealloc(PyDatabaseConnectionPumpLoop *self)
{
    self->state.~shared_ptr();

    Py_TYPE(self)->tp_free((PyObject*)self);
}

/* static */
PyObject* PyDatabaseConnectionPumpLoop::new_(PyTypeObject *type, PyObject *args, PyObject *kwargs)
{
    PyDatabaseConnectionPumpLoop* self;

    self = (PyDatabaseConnectionPumpLoop*) type->tp_alloc(type, 0);

    if (self != NULL) {
        new (&self->state) std::shared_ptr<DatabaseConnectionPumpLoop>();
    }

    return (PyObject*)self;
}

/* static */
PyObject* PyDatabaseConnectionPumpLoop::readLoop(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs) {
    static const char *kwlist[] = {"onMessage", NULL};

    PyObject* onMessage;

    if (!PyArg_ParseTupleAndKeywords(args, kwargs, "O", (char**)kwlist, &onMessage)) {
        return NULL;
    }

    return translateExceptionToPyObject([&]() {
        PyObjectHolder holdSelf((PyObject*)self);
        PyObjectHolder holdOnMessage((PyObject*)onMessage);

        self->state->readLoop(onMessage);
        return incref(Py_None);
    });
}

/* static */
PyObject* PyDatabaseConnectionPumpLoop::writeLoop(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs) {
    static const char *kwlist[] = {NULL};

    if (!PyArg_ParseTupleAndKeywords(args, kwargs, "", (char**)kwlist)) {
        return NULL;
    }

    return translateExceptionToPyObject([&]() {
        PyObjectHolder holdSelf((PyObject*)self);

        self->state->writeLoop();
        return incref(Py_None);
    });
}

/* static */
PyObject* PyDatabaseConnectionPumpLoop::close(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs) {
    static const char *kwlist[] = {NULL};

    if (!PyArg_ParseTupleAndKeywords(args, kwargs, "", (char**)kwlist)) {
        return NULL;
    }

    return translateExceptionToPyObject([&]() {
        self->state->close("user shutdown");

        return incref(Py_None);
    });
}

/* static */
PyObject* PyDatabaseConnectionPumpLoop::setHeartbeatMessage(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs) {
    static const char *kwlist[] = {"messageBytes", "interval", NULL};

    PyObject* msgBytes;
    float interval;

    if (!PyArg_ParseTupleAndKeywords(args, kwargs, "Of", (char**)kwlist, &msgBytes, &interval)) {
        return NULL;
    }

    return translateExceptionToPyObject([&]() {
        if (!PyBytes_Check(msgBytes)) {
            throw std::runtime_error("Expected a bytes object for 'messageBytes'");
        }
        std::string msg(PyBytes_AsString(msgBytes), PyBytes_AsString(msgBytes) + PyBytes_GET_SIZE(msgBytes));

        self->state->setHeartbeatMessage(msg, interval);

        return incref(Py_None);
    });
}

/* static */
PyObject* PyDatabaseConnectionPumpLoop::write(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs) {
    static const char *kwlist[] = {"msg", NULL};

    PyObject* msg;

    if (!PyArg_ParseTupleAndKeywords(args, kwargs, "O", (char**)kwlist, &msg)) {
        return NULL;
    }

    return translateExceptionToPyObject([&]() {
        if (!PyBytes_Check(msg)) {
            throw std::runtime_error("Expected 'msg' to be a bytes object.");
        }

        bool wrote = self->state->write(PyBytes_AsString(msg), PyBytes_GET_SIZE(msg));

        return incref(wrote ? Py_True : Py_False);
    });
}

/* static */
PyObject* PyDatabaseConnectionPumpLoop::isClosed(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs) {
    static const char *kwlist[] = {NULL};

    if (!PyArg_ParseTupleAndKeywords(args, kwargs, "", (char**)kwlist)) {
        return NULL;
    }

    return translateExceptionToPyObject([&]() {
        return incref(self->state->isClosed() ? Py_True : Py_False);
    });
}

/* static */
int PyDatabaseConnectionPumpLoop::init(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs)
{
    static const char *kwlist[] = {"ssl", NULL};

    PyObject* ssl;

    if (!PyArg_ParseTupleAndKeywords(args, kwargs, "O", (char**)kwlist, &ssl)) {
        return -1;
    }

    if (std::string(ssl->ob_type->tp_name) != "_ssl._SSLSocket") {
        PyErr_Format(PyExc_TypeError, "Expected an _ssl._SSLSocket, got %S", ssl->ob_type);
        return -1;
    }

    self->state.reset(
        new DatabaseConnectionPumpLoop(
            (PySSLSocket*)ssl
        )
    );

    new std::shared_ptr<DatabaseConnectionPumpLoop>(self->state);

    return 0;
}

PyTypeObject PyType_DatabaseConnectionPumpLoop = {
    PyVarObject_HEAD_INIT(NULL, 0)
    .tp_name = "DatabaseConnectionPumpLoop",
    .tp_basicsize = sizeof(PyDatabaseConnectionPumpLoop),
    .tp_itemsize = 0,
    .tp_dealloc = (destructor) PyDatabaseConnectionPumpLoop::dealloc,
    #if PY_MINOR_VERSION < 8
    .tp_print = 0,
    #else
    .tp_vectorcall_offset = 0,                  // printfunc  (Changed to tp_vectorcall_offset in Python 3.8)
    #endif
    .tp_getattr = 0,
    .tp_setattr = 0,
    .tp_as_async = 0,
    .tp_repr = 0,
    .tp_as_number = 0,
    .tp_as_sequence = 0,
    .tp_as_mapping = 0,
    .tp_hash = 0,
    .tp_call = 0,
    .tp_str = 0,
    .tp_getattro = 0,
    .tp_setattro = 0,
    .tp_as_buffer = 0,
    .tp_flags = Py_TPFLAGS_DEFAULT,
    .tp_doc = 0,
    .tp_traverse = 0,
    .tp_clear = 0,
    .tp_richcompare = 0,
    .tp_weaklistoffset = 0,
    .tp_iter = 0,
    .tp_iternext = 0,
    .tp_methods = PyDatabaseConnectionPumpLoop_methods,
    .tp_members = 0,
    .tp_getset = 0,
    .tp_base = 0,
    .tp_dict = 0,
    .tp_descr_get = 0,
    .tp_descr_set = 0,
    .tp_dictoffset = 0,
    .tp_init = (initproc) PyDatabaseConnectionPumpLoop::init,
    .tp_alloc = 0,
    .tp_new = PyDatabaseConnectionPumpLoop::new_,
    .tp_free = 0,
    .tp_is_gc = 0,
    .tp_bases = 0,
    .tp_mro = 0,
    .tp_cache = 0,
    .tp_subclasses = 0,
    .tp_weaklist = 0,
    .tp_del = 0,
    .tp_version_tag = 0,
    .tp_finalize = 0,
};
