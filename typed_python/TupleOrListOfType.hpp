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

#include "Type.hpp"

class TupleOrListOfType : public Type {
public:
    class layout {
    public:
        std::atomic<int64_t> refcount;
        typed_python_hash_type hash_cache;
        int32_t count;
        int32_t reserved;
        uint8_t* data;
    };

    typedef layout* layout_ptr;

public:
    TupleOrListOfType(Type* type, bool isTuple) :
            Type(isTuple ? TypeCategory::catTupleOf : TypeCategory::catListOf),
            m_element_type(type),
            m_is_tuple(isTuple)
    {
        m_size = sizeof(void*);
        m_is_default_constructible = true;

        endOfConstructorInitialization(); // finish initializing the type object.
    }

    bool isBinaryCompatibleWithConcrete(Type* other);

    template<class visitor_type>
    void _visitContainedTypes(const visitor_type& visitor) {

    }

    template<class visitor_type>
    void _visitReferencedTypes(const visitor_type& visitor) {
        visitor(m_element_type);
    }

    bool _updateAfterForwardTypesChanged() {
        std::string name = (m_is_tuple ? "TupleOf(" : "ListOf(") + m_element_type->name() + ")";

        if (m_is_recursive) {
            name = m_recursive_name;
        }

        bool anyChanged = name != m_name;

        m_name = name;

        return anyChanged;
    }

    //serialize, but don't write a count
    template<class buf_t>
    void serializeStream(instance_ptr self, buf_t& buffer) {
        int32_t ct = count(self);
        m_element_type->check([&](auto& concrete_type) {
            for (long k = 0; k < ct;k++) {
                concrete_type.serialize(this->eltPtr(self,k), buffer, 0);
            }
        });
    }

    void repr(instance_ptr self, ReprAccumulator& stream);

    typed_python_hash_type hash(instance_ptr left);

    bool cmp(instance_ptr left, instance_ptr right, int pyComparisonOp, bool suppressExceptions);

    Type* getEltType() const {
        return m_element_type;
    }

    instance_ptr eltPtr(layout_ptr self, int64_t i) const {
        return eltPtr((instance_ptr)&self, i);
    }

    instance_ptr eltPtr(instance_ptr self, int64_t i) const {
        if (!(*(layout**)self)) {
            return self;
        }

        return (*(layout**)self)->data + i * m_element_type->bytecount();
    }

    int64_t count(instance_ptr self) const;

    int64_t refcount(instance_ptr self) const;

    //construct a new list at 'selfPtr' with 'count' items, each initialized by calling
    //'allocator(target_object, k)', where 'target_object' is a pointer to the memory location
    //to be filled and 'k' is the index in the list.
    template<class sub_constructor>
    void constructor(instance_ptr selfPtr, int64_t count, const sub_constructor& allocator) {
        layout_ptr& self = *(layout_ptr*)selfPtr;

        if (count == 0 && m_is_tuple) {
            self = nullptr;
            return;
        }

        self = (layout*)malloc(sizeof(layout));

        self->count = count;
        self->refcount = 1;
        self->reserved = std::max<int32_t>(1, count);
        self->hash_cache = -1;
        self->data = (uint8_t*)malloc(getEltType()->bytecount() * self->reserved);

        for (int64_t k = 0; k < count; k++) {
            try {
                allocator(eltPtr(self, k), k);
            } catch(...) {
                for (long k2 = k-1; k2 >= 0; k2--) {
                    m_element_type->destroy(eltPtr(self,k2));
                }
                free(self->data);
                free(self);
                throw;
            }
        }
    }
    //construct a new list at 'selfPtr'. We call 'allocator(target_object, k)' repeatedly.
    //we stop when it returns 'false'
    template<class sub_constructor>
    void constructorUnbounded(instance_ptr selfPtr, const sub_constructor& allocator) {
        layout_ptr& self = *(layout_ptr*)selfPtr;

        self = (layout*)malloc(sizeof(layout));

        self->count = 0;
        self->refcount = 1;
        self->reserved = 1;
        self->hash_cache = -1;
        self->data = (uint8_t*)malloc(getEltType()->bytecount() * self->reserved);

        while(true) {
            try {
                if (!allocator(eltPtr(self, self->count), self->count)) {
                    if (m_is_tuple && self->count == 0) {
                        //tuples need to be the nullptr
                        free(self->data);
                        free(self);
                        self = nullptr;
                    }
                    return;
                }

                self->count++;
                if (self->count >= self->reserved) {
                    reserve(selfPtr, self->reserved * 1.25 + 1);
                }
            } catch(...) {
                for (long k2 = (long)self->count-1; k2 >= 0; k2--) {
                    m_element_type->destroy(eltPtr(self,k2));
                }
                free(self->data);
                free(self);
                throw;
            }
        }
    }

    void constructor(instance_ptr self);

    void destroy(instance_ptr self);

    void copy_constructor(instance_ptr self, instance_ptr other);

    void assign(instance_ptr self, instance_ptr other);

    void reserve(instance_ptr self, size_t count);

protected:
    Type* m_element_type;

    bool m_is_tuple;
};

class ListOfType : public TupleOrListOfType {
public:
    ListOfType(Type* type) : TupleOrListOfType(type, false)
    {
    }

    static ListOfType* Make(Type* elt);

    void setSizeUnsafe(instance_ptr self, size_t count);

    void append(instance_ptr self, instance_ptr other);

    size_t reserved(instance_ptr self);

    void remove(instance_ptr self, size_t count);

    void resize(instance_ptr self, size_t count);

    void resize(instance_ptr self, size_t count, instance_ptr value);

    void copyListObject(instance_ptr target, instance_ptr src);

    void ensureSpaceFor(instance_ptr self, size_t count);

    template<class initializer>
    void extend(instance_ptr self, size_t count, const initializer& initFun) {
        layout_ptr& self_layout = *(layout_ptr*)self;
        ensureSpaceFor(self, count);

        size_t bytesPer = m_element_type->bytecount();
        instance_ptr base = this->eltPtr(self, this->count(self));

        size_t i = 0;

        try {
            for (; i < count; i++) {
                initFun(base + bytesPer * i, i);
            }

            self_layout->count += i;
        }
        catch(...) {
            self_layout->count += i;
            throw;
        }
    }

    template<class buf_t>
    void serialize(instance_ptr self, buf_t& buffer, size_t fieldNumber) {
        size_t ct = count(self);

        uint32_t id;
        bool isNew;
        std::tie(id, isNew) = buffer.cachePointer(*(void**)self, this);

        if (!isNew) {
            buffer.writeBeginSingle(fieldNumber);
            buffer.writeUnsignedVarintObject(0, id);
            return;
        }

        buffer.writeBeginCompound(fieldNumber);
        buffer.writeUnsignedVarintObject(0, id);
        buffer.writeUnsignedVarintObject(0, ct);

        m_element_type->check([&](auto& concrete_type) {
            for (long k = 0; k < ct; k++) {
                concrete_type.serialize(this->eltPtr(self,k), buffer, 0);
            }
        });

        buffer.writeEndCompound();
    }

    template<class buf_t>
    void deserialize(instance_ptr self, buf_t& buffer, size_t wireType) {
        assertNonemptyCompoundWireType(wireType);

        size_t id = buffer.readUnsignedVarintObject();

        void* ptr = buffer.lookupCachedPointer(id);

        if (ptr) {
            ((layout**)self)[0] = (layout*)ptr;
            ((layout**)self)[0]->refcount++;
            buffer.finishCompoundMessage(wireType);
            return;
        }

        size_t ct = buffer.readUnsignedVarintObject();

        if (ct == 0) {
            constructor(self);
            (*(layout**)self)->refcount++;
            buffer.addCachedPointer(id, *((layout**)self), this);
        } else {
            constructor(self, ct, [&](instance_ptr tgt, int k) {
                if (k == 0) {
                    buffer.addCachedPointer(id, *((layout**)self), this);
                    (*(layout**)self)->refcount++;
                }

                auto fieldAndWire = buffer.readFieldNumberAndWireType();
                if (fieldAndWire.first) {
                    throw std::runtime_error("Corrupt data (count)");
                }
                if (fieldAndWire.second == WireType::END_COMPOUND) {
                    throw std::runtime_error("Corrupt data (count)");
                }

                m_element_type->deserialize(tgt, buffer, fieldAndWire.second);
            });
        }

        buffer.finishCompoundMessage(wireType);
    }
};

class TupleOfType : public TupleOrListOfType {
public:
    TupleOfType(Type* type) : TupleOrListOfType(type, true)
    {
    }


    template<class buf_t>
    void serialize(instance_ptr self, buf_t& buffer, size_t fieldNumber) {
        size_t ct = count(self);

        if (ct == 0) {
            buffer.writeEmpty(fieldNumber);
            return;
        }

        buffer.writeBeginCompound(fieldNumber);

        buffer.writeUnsignedVarintObject(0, ct);

        m_element_type->check([&](auto& concrete_type) {
            for (long k = 0; k < ct; k++) {
                concrete_type.serialize(this->eltPtr(self,k), buffer, 0);
            }
        });

        buffer.writeEndCompound();
    }


    template<class buf_t>
    void deserialize(instance_ptr self, buf_t& buffer, size_t wireType) {
        if (wireType == WireType::EMPTY) {
            *(layout**)self = nullptr;
            return;
        }

        assertNonemptyCompoundWireType(wireType);

        size_t ct = buffer.readUnsignedVarintObject();

        constructor(self, ct, [&](instance_ptr tgt, int k) {
            auto fieldAndWire = buffer.readFieldNumberAndWireType();
            if (fieldAndWire.first) {
                throw std::runtime_error("Corrupt data (count)");
            }
            if (fieldAndWire.second == WireType::END_COMPOUND) {
                throw std::runtime_error("Corrupt data (count)");
            }

            m_element_type->deserialize(tgt, buffer, fieldAndWire.second);
        });

        buffer.finishCompoundMessage(wireType);
    }


    static TupleOfType* Make(Type* elt);
};

