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

#pragma once

#include <Python.h>
#include <map>
#include <memory>
#include <vector>
#include <string>
#include <iostream>

#include "DatabaseConnectionPumpLoop.hpp"

class PyDatabaseConnectionPumpLoop {
public:
    PyObject_HEAD;
    std::shared_ptr<DatabaseConnectionPumpLoop> state;

    static void dealloc(PyDatabaseConnectionPumpLoop *self);

    static PyObject *new_(PyTypeObject *type, PyObject *args, PyObject *kwargs);

    static int init(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs);

    static PyObject* close(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs);

    static PyObject* isClosed(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs);

    static PyObject* write(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs);

    static PyObject* readLoop(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs);

    static PyObject* writeLoop(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs);

    static PyObject* setHeartbeatMessage(PyDatabaseConnectionPumpLoop *self, PyObject *args, PyObject *kwargs);
};

extern PyTypeObject PyType_DatabaseConnectionPumpLoop;
