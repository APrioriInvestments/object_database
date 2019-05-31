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

class FunctionArgType {
public:
    FunctionArgType(std::string name, Type* typeFilterOrNull, PyObject* defaultValue, bool isStarArg, bool isKwarg) :
        m_name(name),
        m_typeFilter(typeFilterOrNull),
        m_defaultValue(defaultValue),
        m_isStarArg(isStarArg),
        m_isKwarg(isKwarg)
    {
        assert(!(isStarArg && isKwarg));
    }

    std::string getName() const {
        return m_name;
    }

    PyObject* getDefaultValue() const {
        return m_defaultValue;
    }

    Type* getTypeFilter() const {
        return m_typeFilter;
    }

    bool getIsStarArg() const {
        return m_isStarArg;
    }

    bool getIsKwarg() const {
        return m_isKwarg;
    }

    bool getIsNormalArg() const {
        return !m_isKwarg && !m_isStarArg;
    }

    template<class visitor_type>
    void _visitReferencedTypes(const visitor_type& visitor) {
        if (m_typeFilter) {
            visitor(m_typeFilter);
        }
    }

private:
    std::string m_name;
    Type* m_typeFilter;
    PyObject* m_defaultValue;
    bool m_isStarArg;
    bool m_isKwarg;
};
