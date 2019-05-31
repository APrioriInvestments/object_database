#!/usr/bin/env python3

#   Copyright 2017-2019 Nativepython Authors
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

import sys
import argparse
import traceback
from typed_python.Codebase import Codebase
from typed_python._types import Dict, ConstDict, NamedTuple, Tuple, ListOf, TupleOf, OneOf, Alternative
from typed_python._types import getOrSetTypeResolver
from typed_python.direct_types.generate_tuple import gen_tuple_type
from typed_python.direct_types.generate_named_tuple import gen_named_tuple_type
from typed_python.direct_types.generate_alternative import gen_alternative_type


cpp_type_mapping = {}


def anon_name(py_type):
    """Given a python Type, generates a unique name.

    Intended to be used to label anonymously occuring Types.
    """
    return "Anon" + str(id(py_type))


# implementation comment:
# this is an awkward way to keep track of prerequisites
def cpp_type(py_type) -> (str, dict):
    """Given a python Type, returns the corresponding c++ type name (as a string) and a dict of prerequisites.

    examples:
        given Int64 return "int64_t"
        given ListOf(Int64) return ListOf<int64_t>
    For generated types with given names, just use the name
    example:
        if Arb=NamedTuple(X=Int64,Y=Bool)
        given Arb return "Arb"
    For types containing anonymous subtypes, keep track of them so they can be generated as prerequisites for this type

    Args:
        py_type: Type subclass.

    Returns:
        tuple (string, dict)
            string is the c++ type name
            dict (str->Type) of anonymous type prerequisites for this time
    """
    simple_cats = {
        'None': 'None',
        'Int64': 'int64_t',
        'UInt64': 'uint64_t',
        'Int32': 'uint32_t',
        'UInt32': 'uint32_t',
        'Int16': 'uint16_t',
        'UInt16': 'uint16_t',
        'Int8': 'uint8_t',
        'UInt8': 'uint8_t',
        'Bool': 'bool',
        'Float64': 'double',
        'Float32': 'float',
        'Bytes': 'Bytes',
        'String': 'String'
    }
    cat = py_type.__typed_python_category__
    cpp_name = "undefined_type"
    prerequisites = {}
    if cat in simple_cats.keys():
        cpp_name = simple_cats[cat]
    elif cat == 'ListOf' or cat == 'TupleOf':
        (cpp_elem_name, prerequisites) = cpp_type(py_type.ElementType)
        cpp_name = '{}<{}>'.format(cat, cpp_elem_name)
    elif cat == 'OneOf':
        result = [cpp_type(t) for t in py_type.Types]
        for e in result:
            prerequisites.update(e[1])
        cpp_name = 'OneOf<{}>'.format(', '.join([e[0] for e in result]))
    # Forwards are no longer supported here: types must be fully defined (resolved) before generating direct c++ types
    # elif cat == 'Forward':
    #    cpp_name = str(py_type)[8:-2] + '*'  # just for now!
    elif cat in ('Tuple', 'NamedTuple', 'Alternative'):
        if py_type in cpp_type_mapping:
            cpp_name = cpp_type_mapping[py_type].rsplit(".", 1)[-1]
        else:
            name = anon_name(py_type)
            prerequisites[name] = py_type
            cpp_name = name
    elif cat in ('Dict', 'ConstDict'):
        (cpp_key_type, key_pre) = cpp_type(py_type.KeyType)
        (cpp_value_type, value_pre) = cpp_type(py_type.ValueType)
        prerequisites.update(key_pre)
        prerequisites.update(value_pre)
        cpp_name = '{}<{}, {}>'.format(cat, cpp_key_type, cpp_value_type)

    return (cpp_name, prerequisites)


def avoid_cpp_keywords(w):
    """Given a string, return the string unless it is a c++ keyword, in which case modify the string.
    """
    keywords = ["typename", "class"]
    if w in keywords:
        return w + '0'
    return w


def typed_python_codegen(**kwargs):
    """Generates direct c++ wrappers for Tuple, NamedTuple, and Alternative types

    Args:
        **kwargs: Dict of name -> Type
    Returns:
        A list of strings, containing c++ code implementing wrappers for these types.
    """
    ret = []
    if len(kwargs.items()) == 0:
        return ret
    anon_types = {}
    for k, v in kwargs.items():
        k = avoid_cpp_keywords(k)
        if v.__typed_python_category__ in ('Tuple', 'NamedTuple', 'Alternative'):
            if v.__typed_python_category__ == 'Tuple':
                ret += gen_tuple_type(k, *[cpp_type(t)[0] for t in v.ElementTypes])
                for t in v.ElementTypes:
                    anon_types.update(cpp_type(t)[1])
            elif v.__typed_python_category__ == 'NamedTuple':
                ret += gen_named_tuple_type(k, **{avoid_cpp_keywords(n): cpp_type(t)[0] for n, t in zip(v.ElementNames, v.ElementTypes)})
                for t in v.ElementTypes:
                    anon_types.update(cpp_type(t)[1])
            elif v.__typed_python_category__ == 'Alternative':
                d = {nt.Name: [(avoid_cpp_keywords(a), cpp_type(t)[0])
                               for a, t in zip(nt.ElementType.ElementNames, nt.ElementType.ElementTypes)]
                     for nt in v.__typed_python_alternatives__}
                ret += gen_alternative_type(k, d)
                for nt in v.__typed_python_alternatives__:
                    for t in nt.ElementType.ElementTypes:
                        anon_types.update(cpp_type(t)[1])

            cpp_type_mapping[v] = k
    return typed_python_codegen(**anon_types) + ret


def typed_python_codegen2(**kwargs):
    """Generates direct c++ wrappers for Tuple, NamedTuple, and Alternative types

    Args:
        **kwargs: Dict of name -> Type
    Returns:
        A list of strings, containing c++ code implementing wrappers for these types.
    """
    ret = []
    if len(kwargs.items()) == 0:
        return ret
    for k, v in kwargs.items():
        k = avoid_cpp_keywords(k)
        if v.__typed_python_category__ in ('Tuple', 'NamedTuple', 'Alternative'):
            if v.__typed_python_category__ == 'Tuple':
                ret += gen_tuple_type(k, *[cpp_type(t)[0] for t in v.ElementTypes])
                # for t in v.ElementTypes:
                #     anon_types.update(cpp_type(t)[1])
            elif v.__typed_python_category__ == 'NamedTuple':
                ret += gen_named_tuple_type(k, **{avoid_cpp_keywords(n): cpp_type(t)[0] for n, t in zip(v.ElementNames, v.ElementTypes)})
                # for t in v.ElementTypes:
                #     anon_types.update(cpp_type(t)[1])
            elif v.__typed_python_category__ == 'Alternative':
                d = {nt.Name: [(avoid_cpp_keywords(a), cpp_type(t)[0])
                               for a, t in zip(nt.ElementType.ElementNames, nt.ElementType.ElementTypes)]
                     for nt in v.__typed_python_alternatives__}
                ret += gen_alternative_type(k, d)
                # for nt in v.__typed_python_alternatives__:
                #     for t in nt.ElementType.ElementTypes:
                #         anon_types.update(cpp_type(t)[1])

            cpp_type_mapping[v] = k
    return ret


def generate_cpp(codebase, t, cpp, verbose=False, produce_code=True):
    if t in cpp:
        return
    cat = t.__typed_python_category__
    if cat in ('Tuple', 'NamedTuple'):
        for s in t.ElementTypes:
            generate_cpp(codebase, s, cpp, verbose)
    elif cat == 'Alternative':
        for s in t.__typed_python_alternatives__:
            generate_cpp(codebase, s.ElementType, cpp, verbose, False)
    elif cat in ('TupleOf', 'ListOf'):
        generate_cpp(codebase, t.ElementType, cpp, verbose)
    elif cat == 'OneOf':
        for s in t.Types:
            generate_cpp(codebase, s, cpp, verbose)
    elif cat in ('Dict', 'ConstDict'):
        generate_cpp(codebase, t.KeyType, cpp, verbose)
        generate_cpp(codebase, t.ValueType, cpp, verbose)

    if produce_code and cat in ('Tuple', 'NamedTuple', 'Alternative'):
        name = codebase.serializationContext.objToName.get(id(t), anon_name(t))
        if verbose:
            print(f'    Gen {t.__name__} = {name}')
            if name in cpp:
                print('        already defined')
        cpp[name] = t


def generate_from_codebase(codebase, dest, one=None, verbose=False):
    cpp = {}
    if one:
        items = [(one, codebase.serializationContext.nameToObject[one])]
    else:
        items = codebase.serializationContext.nameToObject.items()
    for n, t in items:
        if hasattr(t, '__typed_python_category__'):
            if verbose:
                print(f'{n} {t.__typed_python_category__}')
            if t.__typed_python_category__ in ('Tuple', 'NamedTuple', 'Alternative'):
                generate_cpp(codebase, t, cpp, verbose)
    with open(dest, 'w') as f:
        f.write('#pragma once\n')
        f.writelines(typed_python_codegen2(**cpp))


class resolver:
    def __init__(self, codebase):
        self._codebase = codebase

    def resolveTypeByName(self, s):
        return self._codebase.serializationContext.nameToObject[s]


def generate_some_types(dest):
    """Generates direct c++ type wrappers for testing.

    Specifically, generates code for direct c++ wrappers of test Tuple, NamedTuple, and Alternative types.

    Args:
        dest: filename to which to write generated code.
    """
    Bexpress = Forward("Bexpress*")
    Bexpress = Bexpress.define(Alternative(
        "BooleanExpr",
        Leaf={
            "value": bool
        },
        BinOp={
            "op": str,
            "left": Bexpress,
            "right": Bexpress,
        },
        UnaryOp={
            "op": str,
            "right": Bexpress
    with open(dest, 'w') as f:
        f.write('#pragma once\n')
        f.writelines(typed_python_codegen(
            # ObjectFieldId=ObjectFieldId,
            # IndexId=IndexId,
            # FieldDefinition=FieldDefinition,
            # TypeDefinition=TypeDefinition,
            # SchemaDefinition=SchemaDefinition,
            # ClientToServer=ClientToServer,
            # A=A,
            # Overlap=Overlap,
            # Bexpress=Bexpress,
            NamedTupleTwoStrings=NamedTuple(X=str, Y=str),
            NamedTupleBoolIntStr=NamedTuple(b=bool, i=int, s=str),
            # Choice=NamedTuple(A=NamedTuple(X=str, Y=str), B=Bexpress),
            NamedTupleIntFloatDesc=NamedTuple(a=OneOf(int, float, bool), b=float, desc=str),
            NamedTupleBoolListOfInt=NamedTuple(X=bool, Y=ListOf(int)),
            NamedTupleAttrAndValues=NamedTuple(attributes=TupleOf(str), values=TupleOf(int)),
            AnonTest=Tuple(
                Dict(Tuple(int, int), str),
                ConstDict(str, OneOf(bool, Tuple(bool, bool))),
                ListOf(Tuple(int, int)),
                TupleOf(NamedTuple(x=int, y=int))
            )
            # IndexValue=Tuple(int, int, int, int, int),
            # ObjectFieldId=NamedTuple(objId=int, fieldId=int, isIndexValue=bool),
            # IndexId=NamedTuple(fieldId=int, indexValue=Tuple(int, int, int, int, int)),
        ))


def main(argv):
    parser = argparse.ArgumentParser(description='Generate types')
    parser.add_argument('dest', nargs='?', default='DefaultGeneratedTestTypes.hpp')
    parser.add_argument('-t', '--testTypes', action='store_true')
    parser.add_argument('-c', '--testTypes2', action='store_true')
    parser.add_argument('-d', '--testTypes3', action='store_true')
    parser.add_argument('-e', '--testTypes4', action='store_true')
    parser.add_argument('-v', '--verbose', action='store_true')
    args = parser.parse_args()

    try:
        if args.testTypes:
            generate_some_types(args.dest)
        elif args.testTypes2:
            codebase = Codebase.FromRootlevelPath("object_database")
            getOrSetTypeResolver(resolver(codebase))
            generate_from_codebase(codebase, args.dest, "object_database.messages.ClientToServer", verbose=args.verbose)
        elif args.testTypes3:
            codebase = Codebase.FromRootlevelPath("typed_python")
            generate_from_codebase(codebase, args.dest, "typed_python.python_ast.Expr", verbose=args.verbose)
        elif args.testTypes4:
            codebase = Codebase.FromRootlevelPath("object_database", verbose=args.verbose)
            generate_from_codebase(codebase, args.dest)
    except Exception:
        print("FAILED:\n", traceback.format_exc())
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
