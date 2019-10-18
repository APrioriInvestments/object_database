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
#include <Python.h>
#include "util.hpp"
#include "Type.hpp"
#include "SerializationContext.hpp"

// PySet_CheckExact is missing from the CPython API for some reason
#ifndef PySet_CheckExact
  #define PySet_CheckExact(obj)        (Py_TYPE(obj) == &PySet_Type)
#endif


static inline void throwDerivedClassError(std::string type) {
    throw std::runtime_error(
        std::string("Classes derived from `" + type + "` cannot be serialized")
    );
}

// Wrapping this macro with a function so we can use it in templated code
inline PyObject* PyList_Get_Item_No_Checks(PyObject* obj, long idx) {
    return PyList_GET_ITEM(obj, idx);
}

// Wrapping this macro with a function so we can use it in templated code
inline void PyList_Set_Item_No_Checks(PyObject* obj, long idx, PyObject* item) {
    PyList_SET_ITEM(obj, idx, item);
}

// Wrapping this macro with a function so we can use it in templated code
inline PyObject* PyTuple_Get_Item_No_Checks(PyObject* obj, long idx) {
    return PyTuple_GET_ITEM(obj, idx);
}

// Wrapping this macro with a function so we can use it in templated code
inline void PyTuple_Set_Item_No_Checks(PyObject* o, long k, PyObject* item) {
    PyTuple_SET_ITEM(o, k, item);
}

//models bytes held in a python 'bytes' object.
class PyBytesByteBuffer : public ByteBuffer {
public:
    explicit PyBytesByteBuffer(PyObject* obj) : m_obj(incref(obj)) {
        if (!PyObject_CheckBuffer(obj)) {
            PyErr_Format(PyExc_TypeError, "Not a buffer object.");
            throw PythonExceptionSet();
        }

        if (PyObject_GetBuffer(obj, &m_buffer, PyBUF_SIMPLE | PyBUF_ANY_CONTIGUOUS) == -1) {
            throw PythonExceptionSet();
        }
    }

    virtual ~PyBytesByteBuffer() {
        PyBuffer_Release(&m_buffer);
        decref(m_obj);
    }

    virtual std::pair<uint8_t*, uint8_t*> range() {
        assertHoldingTheGil();
        return std::make_pair((uint8_t*)m_buffer.buf, (uint8_t*)m_buffer.buf + m_buffer.len);
    }

private:
    PyObject* m_obj;
    Py_buffer m_buffer;
};

class PythonSerializationContext : public SerializationContext {
public:
    //enums in our protocol (serialized as uint8_t)
    class FieldNumbers {
    public:
        enum {
            MEMO = 0, //a varint encoding the ID of the object in the memo stream.
                      //if this memo has been defined already in the stream, no other
                      //fields should be present in the stream.
            NATIVE_TYPE = 1, //an encoded native type.
                             //field 0 is the type category. Fields above that encode
                             //type-detail arguments
            NATIVE_INSTANCE = 2, //field 0 is the type, field 1 is the data.
            OBJECT_NAME = 3, //a string encoding the name of the object in the current codebase
            OBJECT_TYPEANDDICT = 4, //an object where the object's python type is encoded as
                                    //field 0, and the dictionary is encoded as field 1
            OBJECT_REPRESENTATION = 5, //a python object representing an objects' representation
            FLOAT = 6, //the object is a 64-bit float
            LONG = 7, //the object is a varint encoding a python long
            BOOL = 8, //the object is a varint encoding a python bool (1 for true, 0 for False)
            LIST = 9, //the object is a list with items encoded by index in a child compound
            TUPLE = 10, //the object is a tuple
            SET = 11, //the object is a set
            DICT = 12, //the object is a dict with keys and values encoded in alternating order
            NONE = 13, //the object is an empty compound encoding None.
            UNICODE = 14, //the object is a BYTES encoding a utf8-encoded string
            BYTES = 15, //the object is a BYTES encoding actual the actual bytes
            FROZENSET = 16, //the object is a frozenset with items encoded by index
        };
    };

    PythonSerializationContext(PyObject* typeSetObj) :
            mContextObj(typeSetObj),
            mCompressionEnabled(false)
    {
        setCompressionEnabled();
    }

    void setCompressionEnabled();

    bool isCompressionEnabled() const {
        return mCompressionEnabled;
    }

    std::shared_ptr<ByteBuffer> compress(uint8_t* begin, uint8_t* end) const;

    std::shared_ptr<ByteBuffer> decompress(uint8_t* begin, uint8_t* end) const;

    std::shared_ptr<ByteBuffer> compressOrDecompress(uint8_t* begin, uint8_t* end, bool compress) const;

    virtual void serializePythonObject(PyObject* o, SerializationBuffer& b, size_t fieldNumber) const;

    void serializePythonObjectNamedOrAsObj(PyObject* o, SerializationBuffer& b) const;

    void serializePythonObjectRepresentation(PyObject* o, SerializationBuffer& b) const;

    //serialize a native type in the format we'd expect for a python object
    //which means we write a compound message which is either a NATIVE_TYPE, or an OBJECT_NAME
    void serializeNativeType(Type* nativeType, SerializationBuffer& b) const;

    void serializeNativeTypeInCompound(Type* nativeType, SerializationBuffer& b, size_t fieldNumber) const;

    Type* deserializeNativeType(DeserializationBuffer& b, size_t wireType, int64_t memo) const;

    Instance deserializeNativeInstance(DeserializationBuffer& b, size_t wireType) const;

    virtual PyObject* deserializePythonObject(DeserializationBuffer& b, size_t wireType) const;

    Type* deserializePythonObjectExpectingNativeType(DeserializationBuffer& b, size_t wireType) const;

    PyObject* deserializePythonObjectFromName(DeserializationBuffer& b, size_t wireType, int64_t memo) const;

    PyObject* deserializePythonObjectFromTypeAndDict(DeserializationBuffer& b, size_t wireType, int64_t memo) const;

    PyObject* deserializePythonObjectFromRepresentation(DeserializationBuffer& b, size_t wireType, int64_t memo) const;

private:
    template<class Factory_Fn, class SetItem_Fn>
    inline PyObject* deserializeIndexable(DeserializationBuffer& b, size_t wireType, Factory_Fn factory_fn, SetItem_Fn set_item_and_steal_ref_fn, int64_t memo) const;

    void serializeIterable(PyObject* o, SerializationBuffer& b, size_t fieldNumber) const;

    template<class Factory_Fn, class AddItem_Fn, class Clear_Fn>
    inline PyObject* deserializeIterable(DeserializationBuffer &b, size_t wireType, Factory_Fn factory_fn, AddItem_Fn add_item_fn, Clear_Fn clear_fn, int64_t memo) const;

    void serializePyList(PyObject* o, SerializationBuffer& b) const;

    PyObject* deserializePyList(DeserializationBuffer& b, size_t wireType, int64_t memo) const;

    void serializePyTuple(PyObject* o, SerializationBuffer& b) const;

    PyObject* deserializePyTuple(DeserializationBuffer& b, size_t wireType, int64_t memo) const;

    void serializePySet(PyObject* o, SerializationBuffer& b) const;

    PyObject* deserializePySet(DeserializationBuffer &b, size_t wireType, int64_t memo) const;

    void serializePyDict(PyObject* o, SerializationBuffer& b) const;

    PyObject* deserializePyDict(DeserializationBuffer& b, size_t wireType, int64_t memo) const;

    void serializePyFrozenSet(PyObject* o, SerializationBuffer& b) const;

    PyObject* deserializePyFrozenSet(DeserializationBuffer &b, size_t wireType, int64_t memo) const;

    PyObject* mContextObj;

    bool mCompressionEnabled;
};

