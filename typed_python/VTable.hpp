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

class InterfaceType;

class VTableEntry {
public:
   void* functionPtr; //the actual function pointer we implement
}

// a pointer offset table for the implementation of an instance of
// an interface.
class VTable {
public:
   InterfaceType* m_interface; // the interface this table is for.

   VTableEntry m_table_entries[];
};

// dispatch table for classes that implement multiple interfaces.
// Interface instances know which vtable they use by embedding
// it in the top 16 bits of the pointer (we only use 48 bits of address
// space on modern x64 chips).

class MultiVTable {
public:
   MultiVTable() :
         m_tables(nullptr),
         m_type(nullptr)
   {
   }

   VTable* m_tables;
   Type* m_type; //the actual type that we represent
};
