/******************************************************************************
   Copyright 2017-2022 object_database Authors

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

#include "IndexId.hpp"
#include "direct_types/all.hpp"


class ViewWatcher {
public:
   virtual ~ViewWatcher() {}

   virtual void onFieldRead(
      field_id field,
      object_id oid
   ) = 0;

   virtual void onFieldWritten(
      field_id field,
      object_id oid,
      Type* t,
      instance_ptr dataOrNull
   ) = 0;

   virtual void onIndexRead(
      field_id field,
      index_value indexValue
   ) = 0;

   virtual void onIndexWritten(
      field_id field,
      index_value indexValue
   ) = 0;
};
