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
#include "ReprAccumulator.hpp"
#include "VTable.hpp"
#include "ClassType.hpp"

class InterfaceType : public Type {
public:
    //we have the same layout
    typedef ClassType::layout layout;

    InterfaceType(
            std::string inName
            ) :
        Type(catInterface)
    {
        m_name = inName;
        m_is_simple = false;
        m_is_default_constructible = false;
        m_size = sizeof(void*);

        endOfConstructorInitialization(); // finish initializing the type object.
    }

    void _updateAfterForwardTypesChanged() {

    }

    template<class visitor_type>
    void _visitContainedTypes(const visitor_type& visitor) {
    }

    template<class visitor_type>
    void _visitReferencedTypes(const visitor_type& visitor) {
    }

    bool cmp(instance_ptr left, instance_ptr right, int pyComparisonOp) {
        return cmpResultToBoolForPyOrdering(pyComparisonOp, 0);
    }

    template<class buf_t>
    void deserialize(instance_ptr self, buf_t& buffer, size_t wireType) {
        throw std::runtime_error("not implemented");
    }

    template<class buf_t>
    void serialize(instance_ptr self, buf_t& buffer, size_t fieldNumber) {
        throw std::runtime_error("not implemented");
    }

    void repr(instance_ptr self, ReprAccumulator& stream) {
        stream << "<interface " << m_name << ">";
    }

    int32_t hash32(instance_ptr left) {
        Hash32Accumulator acc((int)getTypeCategory());

        return acc.get();
    }

    void constructor(instance_ptr self) {
    }

    void destroy(instance_ptr self) {
    }

    void copy_constructor(instance_ptr self, instance_ptr other) {
    }

    void assign(instance_ptr self, instance_ptr other) {
    }

private:
    //we have a default implementation for these (by default, just throwing)
    //but we always look in the vtable for a dispatch
    std::map<std::string, Function*> m_virtualMemberFunctions;

    //for each Function, at which vtable offset do that particular function's overloads
    //start?
    std::map<std::string, size_t> m_virtualMemberFunctionVtableOffsets;

    //we also have functions where we just dispatch directly
    std::map<std::string, Function*> m_nonvirtualMemberFunctions;

    //visible on the class, but not present in the vtable
    std::map<std::string, Function*> m_staticFunctions;
    std::map<std::string, PyObject*> m_classMembers;
};

