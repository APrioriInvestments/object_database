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

#include <unordered_set>

class HeldClass;
class Function;
class Class;

//this takes an instance_ptr for a Class object (not the HeldClass)
typedef void (*destructor_fun_type)(void* inst);

typedef Function* function_signature_type;

typedef std::pair<std::string, Function*> method_signature_type;

typedef void* untyped_function_ptr;

void destroyClassInstance(instance_ptr classInstDestroy);

/****
ClassDispatchTable

Contains the dispatch pointers for each entrypoint to compiled code. Each instance represents
everything we know about dispatching 'Subclass as Class', where an instance of 'Subclass' needs
to masquerade as an instance of 'Class' in compiled code.

At every call site for things that look like 'Class' we have an integer representing that
dispatch.  Every 'Subclass as Class' dispatch table will need to have an entry for that id,
so that compiled code can find the function pointer.
*****/


class ClassDispatchTable {
public:
    ClassDispatchTable(HeldClass* implementingClass, HeldClass* interfaceClass) :
        mImplementingClass(implementingClass),
        mInterfaceClass(interfaceClass),
        mFuncPtrs(nullptr),
        mFuncPtrsUsed(0),
        mFuncPtrsAllocated(0),
        // these members are explicitly leaked so that the layout of the C class is
        // comprehensible to the llvm code layer. maps and sets have a nontrivial layout,
        // and so it's more stable to just hold them as pointers.
        mDispatchIndices(*new std::map<method_signature_type, size_t>()),
        mDispatchDefinitions(*new std::map<size_t, method_signature_type>()),
        mIndicesNeedingDefinition(*new std::set<size_t>())
    {
    }

    // initialize this ClassDispatchTable given the table for the interface we're implementing.
    // If we are 'Subclass' implementing 'Base', 'baseAsBase' will be the table for 'Base' implementing
    // 'Base', which we need to see because it will contain an entry for every dispatch that's currently
    // known for 'Base'.
    void initialize(ClassDispatchTable* baseAsBase) {
        mDispatchIndices = baseAsBase->mDispatchIndices;
        mDispatchDefinitions = baseAsBase->mDispatchDefinitions;

        mFuncPtrsUsed = baseAsBase->mFuncPtrsUsed;
        mFuncPtrsAllocated = baseAsBase->mFuncPtrsAllocated;

        mFuncPtrs = (untyped_function_ptr*)malloc(sizeof(untyped_function_ptr) * mFuncPtrsAllocated);

        for (long k = 0; k < mFuncPtrsUsed; k++) {
            mFuncPtrs[k] = nullptr;
            mIndicesNeedingDefinition.insert(k);
            globalPointersNeedingCompile().insert(std::make_pair(this, k));
        }
    }

    size_t allocateMethodDispatch(std::string funcName, const function_signature_type& signature) {
        assertHoldingTheGil();

        auto it = mDispatchIndices.find(method_signature_type(funcName, signature));
        if (it != mDispatchIndices.end()) {
            return it->second;
        }

        size_t newIndex = mDispatchIndices.size();

        mDispatchIndices[method_signature_type(funcName, signature)] = newIndex;
        mDispatchDefinitions[newIndex] = method_signature_type(funcName, signature);

        // check if we need to allocate a bigger function pointer table. If we do,
        // we must leave the existing one in place, because compiled code may be
        // reading from it concurrently. This functino is holding the GIL, but
        // compiled code doesn't have to do that.
        if (mFuncPtrsUsed >= mFuncPtrsAllocated) {
            mFuncPtrsAllocated = (mFuncPtrsAllocated + 1) * 2;
            untyped_function_ptr* newTable = (untyped_function_ptr*)malloc(sizeof(untyped_function_ptr) * mFuncPtrsAllocated);
            for (long k = 0; k < mFuncPtrsUsed; k++) {
                newTable[k] = mFuncPtrs[k];
            }

            //TODO: don't just leak this. Put it in a queue that we can clean up in
            //the background after we are certain that any compiled code that was
            //reading from the old table will have seen this.
            mFuncPtrs = newTable;
        }

        mFuncPtrsUsed += 1;

        if (mFuncPtrsUsed != mDispatchIndices.size()) {
            throw std::runtime_error("Somehow we lost track of how many function pointers we're using.");
        }

        mFuncPtrs[newIndex] = nullptr;

        mIndicesNeedingDefinition.insert(newIndex);
        globalPointersNeedingCompile().insert(std::make_pair(this, newIndex));

        return newIndex;
    }

    void define(size_t index, untyped_function_ptr ptr) {
        if (!ptr) {
            throw std::runtime_error("Tried to define a function pointer in a VTable.ClassDispatchTable to be null.");
        }

        auto it = mIndicesNeedingDefinition.find(index);
        if (it == mIndicesNeedingDefinition.end()) {
            throw std::runtime_error("Tried to define a function pointer in a VTable.ClassDispatchTable twice.");
        }

        mIndicesNeedingDefinition.erase(it);

        mFuncPtrs[index] = ptr;
    }

    // a set of slots for function pointers that need to be compiled. We only add to this from
    // this code. Clients of this object pop these off and compile them.
    static std::set<std::pair<ClassDispatchTable*, size_t> >& globalPointersNeedingCompile() {
        static std::set<std::pair<ClassDispatchTable*, size_t> > pointers;

        return pointers;
    }

    HeldClass* getImplementingClass() const {
        return mImplementingClass;
    }

    HeldClass* getInterfaceClass() const {
        return mInterfaceClass;
    }

    method_signature_type dispatchDefinitionForSlot(size_t slotIx) const {
        auto it = mDispatchDefinitions.find(slotIx);
        if (it == mDispatchDefinitions.end()) {
            throw std::runtime_error("Invalid slot");
        }
        return it->second;
    }

private:
    // the class actually represented by this instance
    HeldClass* mImplementingClass;

    // the class we're pretending to be
    HeldClass* mInterfaceClass;

    untyped_function_ptr* mFuncPtrs;

    // for each base class of mInterfaceClass, in the MRO that it would have,
    // the dispatch table we want to use for that interface.
    uint16_t* mUpcastDispatches;

    size_t mFuncPtrsAllocated;

    size_t mFuncPtrsUsed;

    std::map<method_signature_type, size_t>& mDispatchIndices;

    std::map<size_t, method_signature_type>& mDispatchDefinitions;

    std::set<size_t>& mIndicesNeedingDefinition;
};

class VTable {
public:
    VTable(HeldClass* inClass) :
        mType(inClass),
        mCompiledDestructorFun((destructor_fun_type)destroyClassInstance),
        mDispatchTables(nullptr)
    {
    }

    /*****
    When VTable is constructed, the Class type object itself isn't complete. This function
    is responsible for completing initialization by creating dispatch tables for all of the
    base classes we might masquerade as.
    *****/

    void finalize(ClassDispatchTable* dispatchers) {
        mDispatchTables = dispatchers;
    }

    void installDestructor(destructor_fun_type fun) {
        if (mCompiledDestructorFun == fun) {
            return;
        }
        if (mCompiledDestructorFun && mCompiledDestructorFun != (destructor_fun_type)destroyClassInstance) {
            throw std::runtime_error("Can't change the compiled destructor!");
        }

        mCompiledDestructorFun = fun;
    }

    HeldClass* mType;

    // null, unless we've compiled a destructor for this function in which case we can just use that.

    destructor_fun_type mCompiledDestructorFun;

    // for each base class, we have a dispatch table we use when we are interacting with the class from
    // code that wants to view the child class as if it were the base class. we encode which base class
    // by index using the top 16 bits of the class pointer.

    ClassDispatchTable* mDispatchTables;
};

typedef VTable* vtable_ptr;

//a class held directly inside of another object
class HeldClass : public Type {
public:
    HeldClass(std::string inName,
          const std::vector<HeldClass*>& baseClasses,
          const std::vector<std::tuple<std::string, Type*, Instance> >& members,
          const std::map<std::string, Function*>& memberFunctions,
          const std::map<std::string, Function*>& staticFunctions,
          const std::map<std::string, Function*>& propertyFunctions,
          const std::map<std::string, PyObject*>& classMembers
          ) :
            Type(catHeldClass),
            m_vtable(new VTable(this)),
            m_bases(baseClasses),
            m_classType(nullptr),
            m_own_members(members),
            m_own_memberFunctions(memberFunctions),
            m_own_staticFunctions(staticFunctions),
            m_own_propertyFunctions(propertyFunctions),
            m_own_classMembers(classMembers),
            m_hasComparisonOperators(false)
    {
        m_name = inName;

        initializeMRO();

        if (m_memberFunctions.find("__eq__") != m_memberFunctions.end()) { m_hasComparisonOperators = true; }
        if (m_memberFunctions.find("__ne__") != m_memberFunctions.end()) { m_hasComparisonOperators = true; }
        if (m_memberFunctions.find("__lt__") != m_memberFunctions.end()) { m_hasComparisonOperators = true; }
        if (m_memberFunctions.find("__gt__") != m_memberFunctions.end()) { m_hasComparisonOperators = true; }
        if (m_memberFunctions.find("__le__") != m_memberFunctions.end()) { m_hasComparisonOperators = true; }
        if (m_memberFunctions.find("__ge__") != m_memberFunctions.end()) { m_hasComparisonOperators = true; }

        endOfConstructorInitialization(); // finish initializing the type object.
    }

    bool isBinaryCompatibleWithConcrete(Type* other);

    template<class visitor_type>
    void _visitContainedTypes(const visitor_type& visitor) {
        for (auto& o: m_members) {
            visitor(std::get<1>(o));
        }
    }

    template<class visitor_type>
    void _visitReferencedTypes(const visitor_type& visitor) {
        for (auto& o: m_members) {
            visitor(std::get<1>(o));
        }
        for (auto& o: m_memberFunctions) {
            Type* t = std::get<1>(o);
            visitor(t);
            assert(t == std::get<1>(o));
        }
        for (auto& o: m_staticFunctions) {
            Type* t = std::get<1>(o);
            visitor(t);
            assert(t == std::get<1>(o));
        }
    }

    bool _updateAfterForwardTypesChanged();

    static HeldClass* Make(
            std::string inName,
            const std::vector<HeldClass*>& bases,
            const std::vector<std::tuple<std::string, Type*, Instance> >& members,
            const std::map<std::string, Function*>& memberFunctions,
            const std::map<std::string, Function*>& staticFunctions,
            const std::map<std::string, Function*>& propertyFunctions,
            const std::map<std::string, PyObject*>& classMembers
            )
    {
        //we only allow one base class to have members because we want native code to be
        //able to just find those values in subclasses without hitting the vtable.
        long countWithMembers = 0;

        for (auto base: bases) {
            if (base->m_members.size()) {
                countWithMembers++;
            }
        }

        if (countWithMembers > 1) {
            throw std::runtime_error("Can't inherit from multiple base classes that both have members.");
        }

        return new HeldClass(inName, bases, members, memberFunctions, staticFunctions, propertyFunctions, classMembers);
    }

    // this gets called by Class. These types are always produced in pairs.
    void setClassType(Class* inClass) {
        if (m_classType) {
            throw std::runtime_error("Class is already set.");
        }
        m_classType = inClass;
    }

    Class* getClassType() const {
        return m_classType;
    }

    HeldClass* renamed(std::string newName) {
        return Make(
            newName,
            m_bases,
            m_members,
            m_memberFunctions,
            m_staticFunctions,
            m_propertyFunctions,
            m_classMembers
        );
    }

    // HeldClass is laid out as a VTable ptr, a set of member initialization fields, and then
    // the actual members.
    static vtable_ptr& vtableFor(instance_ptr self) {
        return *(vtable_ptr*)self;
    }

    instance_ptr eltPtr(instance_ptr self, int64_t ix) const {
        return self + m_byte_offsets[ix];
    }

    bool cmp(instance_ptr left, instance_ptr right, int pyComparisonOp, bool suppressExceptions);

    template<class buf_t>
    void deserialize(instance_ptr self, buf_t& buffer, size_t wireType) {
        vtableFor(self) = m_vtable;

        for (long k = 0; k < m_members.size();k++) {
            clearInitializationFlag(self, k);
        }

        buffer.consumeCompoundMessage(wireType, [&](size_t fieldNumber, size_t subWireType) {
            if (fieldNumber < m_members.size()) {
                getMemberType(fieldNumber)->deserialize(eltPtr(self,fieldNumber), buffer, subWireType);
                setInitializationFlag(self, fieldNumber);
            } else {
                buffer.finishReadingMessageAndDiscard(subWireType);
            }
        });
    }

    template<class buf_t>
    void serialize(instance_ptr self, buf_t& buffer, size_t fieldNumber) {
        buffer.writeBeginCompound(fieldNumber);

        for (long k = 0; k < m_members.size();k++) {
            bool isInitialized = checkInitializationFlag(self, k);
            if (isInitialized) {
                std::get<1>(m_members[k])->serialize(eltPtr(self,k),buffer, k);
            }
        }

        buffer.writeEndCompound();
    }

    void repr(instance_ptr self, ReprAccumulator& stream);

    typed_python_hash_type hash(instance_ptr left);

    template<class sub_constructor>
    void constructor(instance_ptr self, const sub_constructor& initializer) const {
        vtableFor(self) = m_vtable;

        for (int64_t k = 0; k < m_members.size(); k++) {
            try {
                initializer(eltPtr(self, k), k);
                setInitializationFlag(self, k);
            } catch(...) {
                for (long k2 = k-1; k2 >= 0; k2--) {
                    std::get<1>(m_members[k2])->destroy(eltPtr(self,k2));
                }
                throw;
            }
        }
    }

    void setAttribute(instance_ptr self, int memberIndex, instance_ptr other) const;

    void emptyConstructor(instance_ptr self);

    //don't default construct classes
    static bool wantsToDefaultConstruct(Type* t) {
        return t->is_default_constructible() && t->getTypeCategory() != TypeCategory::catClass;
    }

    void constructor(instance_ptr self);

    void destroy(instance_ptr self);

    void copy_constructor(instance_ptr self, instance_ptr other);

    void assign(instance_ptr self, instance_ptr other);

    bool checkInitializationFlag(instance_ptr self, int memberIndex) const {
        int byte = memberIndex / 8 + sizeof(vtable_ptr);
        int bit = memberIndex % 8;
        return bool( ((uint8_t*)self)[byte] & (1 << bit) );
    }

    void setInitializationFlag(instance_ptr self, int memberIndex) const;

    void clearInitializationFlag(instance_ptr self, int memberIndex) const;

    Type* getMemberType(int index) const {
        return std::get<1>(m_members[index]);
    }

    const std::string& getMemberName(int index) const {
        return std::get<0>(m_members[index]);
    }

    bool memberHasDefaultValue(int index) const {
        return std::get<2>(m_members[index]).type()->getTypeCategory() != TypeCategory::catNone;
    }

    const Instance& getMemberDefaultValue(int index) const {
        return std::get<2>(m_members[index]);
    }

    const std::vector<HeldClass*> getBases() const {
        return m_bases;
    }

    const std::vector<std::tuple<std::string, Type*, Instance> >& getMembers() const {
        return m_members;
    }

    const std::map<std::string, Function*>& getMemberFunctions() const {
        return m_memberFunctions;
    }

    const std::map<std::string, Function*>& getStaticFunctions() const {
        return m_staticFunctions;
    }

    const std::map<std::string, PyObject*>& getClassMembers() const {
        return m_classMembers;
    }

    const std::map<std::string, Function*>& getPropertyFunctions() const {
        return m_propertyFunctions;
    }

    const std::vector<size_t>& getOffsets() const {
        return m_byte_offsets;
    }

    int memberNamed(const char* c) const;

    bool hasAnyComparisonOperators() const {
        return m_hasComparisonOperators;
    }

    void initializeMRO() {
        // this is not how the MRO actually works, but we have yet to actually
        // code it correctly.
        std::set<HeldClass*> seen;

        std::function<void (HeldClass*)> visit = [&](HeldClass* cls) {
            if (seen.find(cls) == seen.end()) {
                seen.insert(cls);

                m_mro.push_back(cls);
                m_ancestor_to_mro_index[cls] = m_mro.size() - 1;

                m_bases_as_set.insert(cls);

                for (auto b: cls->getBases()) {
                    visit(b);
                }
            }
        };

        visit(this);

        if (m_ancestor_to_mro_index.find(this) == m_ancestor_to_mro_index.end() ||
                m_ancestor_to_mro_index.find(this)->second != 0) {
            throw std::runtime_error("Somehow " + m_name + " doesn't have itself as MRO 0");
        }

        // build our own method resolution table directly from our parents.
        for (HeldClass* base: m_mro) {
            for (auto nameAndObj: base->m_own_classMembers) {
                if (m_classMembers.find(nameAndObj.first) == m_classMembers.end()) {
                    m_classMembers[nameAndObj.first] = incref(nameAndObj.second);
                }
            }

            mergeInto(m_memberFunctions, base->m_own_memberFunctions);
            mergeInto(m_staticFunctions, base->m_own_staticFunctions);
            mergeInto(m_propertyFunctions, base->m_own_propertyFunctions);
        }

        std::set<std::string> membersSoFar;

        //only one base class can have members
        for (auto base: m_bases) {
            if (base->m_members.size()) {
                m_members = base->m_members;
            }
        }

        for (auto nameAndType: m_members) {
            membersSoFar.insert(std::get<0>(nameAndType));
        }

        for (auto nameAndType: m_own_members) {
            if (membersSoFar.find(std::get<0>(nameAndType)) != membersSoFar.end()) {
                throw std::runtime_error("Can't redefine member named " + std::get<0>(nameAndType));
            }

            membersSoFar.insert(std::get<0>(nameAndType));

            m_members.push_back(nameAndType);
        }

        for (HeldClass* ancestor: m_mro) {
            mClassDispatchTables.push_back(ClassDispatchTable(this, ancestor));
        }

        for (HeldClass* ancestor: m_mro) {
            ancestor->m_implementors.insert(this);
        }

        m_vtable->finalize(&mClassDispatchTables[0]);

        // make sure that, for every interface we can take on, we have slots allocated
        // that the compiler can come along and compile.
        for (HeldClass* ancestor: m_mro) {
            dispatchTableAs(ancestor)->initialize(ancestor->dispatchTableAs(ancestor));
        }
    }

    size_t allocateMethodDispatch(std::string funcName, function_signature_type signature) {
        size_t result = dispatchTableAs(this)->allocateMethodDispatch(funcName, signature);

        // make sure we add this dispatch to every child that implements us as an interface
        for (HeldClass* child: m_implementors) {
            if (result != child->dispatchTableAs(this)->allocateMethodDispatch(funcName, signature)) {
                throw std::runtime_error("Corrupted Dispatch Tables!");
            }
        }

        return result;
    }

    // given some function defininitions by name, add them to a target dictionary.
    // if the function is new just add it. Otherwise merge it in to the existing set
    // of method specializations.
    static void mergeInto(
            std::map<std::string, Function*>& target,
            const std::map<std::string, Function*>& source
            )
    {
        for (auto nameAndFunc: source) {
            auto it = target.find(nameAndFunc.first);
            if (it == target.end()) {
                target[nameAndFunc.first] = nameAndFunc.second;
            } else {
                target[nameAndFunc.first] = Function::merge(target[nameAndFunc.first], nameAndFunc.second);
            }
        }
    }


    bool isSubclassOfConcrete(Type* otherType) {
        return m_bases_as_set.find((HeldClass*)otherType) != m_bases_as_set.end();
    }

    VTable* getVTable() const {
        return m_vtable;
    }

    const std::vector<HeldClass*>& getMro() const {
        return m_mro;
    }

    int64_t getMroIndex(HeldClass* ancestor) const {
        auto it = m_ancestor_to_mro_index.find(ancestor);

        if (it == m_ancestor_to_mro_index.end()) {
            return -1;
        }

        return it->second;
    }

    ClassDispatchTable* dispatchTableAs(HeldClass* interface) {
        int64_t offset = getMroIndex(interface);
        if (offset < 0) {
            throw std::runtime_error("Interface is not an ancestor.");
        }

        return &mClassDispatchTables[offset];
    }

private:
    std::vector<size_t> m_byte_offsets;

    std::vector<HeldClass*> m_bases;

    // equivalent to python's method resolution order, so we can
    // search for methods at runtime.
    std::vector<HeldClass*> m_mro;

    std::set<HeldClass*> m_implementors; //all classes that implement this interface

    std::unordered_map<HeldClass*, int> m_ancestor_to_mro_index;

    std::unordered_set<HeldClass*> m_bases_as_set;

    VTable* m_vtable;

    Class* m_classType; //the non-held version of this class

    std::vector<ClassDispatchTable> mClassDispatchTables;

    //the members we
    std::vector<std::tuple<std::string, Type*, Instance> > m_members;

    std::map<std::string, Function*> m_memberFunctions;

    std::map<std::string, Function*> m_staticFunctions;

    std::map<std::string, Function*> m_propertyFunctions;

    std::map<std::string, PyObject*> m_classMembers;

    // the original members we were provided with
    std::vector<std::tuple<std::string, Type*, Instance> > m_own_members;

    std::map<std::string, Function*> m_own_memberFunctions;

    std::map<std::string, Function*> m_own_staticFunctions;

    std::map<std::string, Function*> m_own_propertyFunctions;

    std::map<std::string, PyObject*> m_own_classMembers;

    bool m_hasComparisonOperators;
};

