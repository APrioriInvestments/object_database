/******************************************************************************
   Copyright 2017-2019 Nativepython Authors

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

#include "PyInstance.hpp"

class PyValueInstance : public PyInstance {
public:
    typedef Value modeled_type;

    static void copyConstructFromPythonInstanceConcrete(Value* v, instance_ptr tgt, PyObject* pyRepresentation, bool isExplicit) {
        const Instance& elt = v->value();

        if (elt.type()->getTypeCategory() == Type::TypeCategory::catPythonObjectOfType && *(PyObject**)elt.data() == pyRepresentation) {
            return;
        }
        else if (compare_to_python(elt.type(), elt.data(), pyRepresentation, isExplicit ? false : true, Py_EQ)) {
            //it's the value we want
            return;
        }

        throw std::logic_error("Can't initialize a " + v->name() + " from an instance of " +
                std::string(pyRepresentation->ob_type->tp_name));
    }

    static bool pyValCouldBeOfTypeConcrete(modeled_type* valType, PyObject* pyRepresentation, bool isExplicit) {
        if (valType->value().type()->getTypeCategory() == Type::TypeCategory::catPythonObjectOfType) {
            return *(PyObject**)valType->value().data() == pyRepresentation;
        }

        return compare_to_python(valType->value().type(), valType->value().data(), pyRepresentation, true, Py_EQ);
    }

    static PyObject* extractPythonObjectConcrete(Value* valueType, instance_ptr data) {
        return extractPythonObject(valueType->value().data(), valueType->value().type());
    }

    static void mirrorTypeInformationIntoPyTypeConcrete(Value* v, PyTypeObject* pyType) {
        //expose the actual Instance we represent as a member of the type object
        PyDict_SetItemString(
            pyType->tp_dict,
            "Value",
            PyInstance::extractPythonObject(v->value())
        );
    }
};
