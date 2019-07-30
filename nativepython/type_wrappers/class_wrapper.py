#   Coyright 2017-2019 Nativepython Authors
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

from nativepython.type_wrappers.wrapper import Wrapper
from nativepython.type_wrappers.refcounted_wrapper import RefcountedWrapper
from nativepython.type_wrappers.exceptions import generateThrowException
import nativepython.type_wrappers.runtime_functions as runtime_functions

from typed_python import NoneType, _types, Type

import nativepython.native_ast as native_ast
import nativepython


typeWrapper = lambda x: nativepython.python_object_representation.typedPythonTypeToTypeWrapper(x)


native_destructor_function_type = native_ast.Type.Function(
    output=native_ast.Void,
    args=(native_ast.VoidPtr,),
    varargs=False,
    can_throw=False
).pointer()


class_dispatch_table_type = native_ast.Type.Struct(
    element_types=[
        ('implementingClass', native_ast.VoidPtr),
        ('interfaceClass', native_ast.VoidPtr),
        ('funcPtrs', native_ast.VoidPtr.pointer()),
    ],
    name="ClassDispatchTable"
)

vtable_type = native_ast.Type.Struct(
    element_types=[
        ('heldTypePtr', native_ast.VoidPtr),
        ('destructorFun', native_destructor_function_type),
        ('classDispatchTable', class_dispatch_table_type.pointer())
    ],
    name="VTable"
)


class BoundClassMethodWrapper(Wrapper):
    def __init__(self, wrapped_type, method_name):
        super().__init__((wrapped_type, method_name))
        self.wrapped_type = typeWrapper(wrapped_type)
        self.method_name = method_name

    def convert_assign(self, context, target, toStore):
        return self.wrapped_type.convert_assign(
            context,
            target.changeType(self.wrapped_type),
            toStore.changeType(self.wrapped_type)
        )

    def convert_copy_initialize(self, context, target, toStore):
        return self.wrapped_type.convert_copy_initialize(
            context,
            target.changeType(self.wrapped_type),
            toStore.changeType(self.wrapped_type)
        )

    def convert_destroy(self, context, instance):
        return self.wrapped_type.convert_destroy(
            context,
            instance.changeType(self.wrapped_type)
        )

    def convert_call(self, context, left, args, kwargs):
        return self.wrapped_type.convert_method_call(
            context,
            left.changeType(self.wrapped_type),
            self.method_name,
            args,
            kwargs
        )


class ClassWrapper(RefcountedWrapper):
    is_pod = False
    is_empty = False
    is_pass_by_ref = True

    BYTES_BEFORE_INIT_BITS = 16 # the refcount and vtable are both 8 byte integers.

    def __init__(self, t):
        super().__init__(t)

        self.nameToIndex = {}
        self.indexToByteOffset = {}
        self.classType = t

        element_types = [('refcount', native_ast.Int64), ('vtable', vtable_type.pointer()), ('data', native_ast.UInt8)]

        # this follows the general layout of 'held class' which is 1 bit per field for initialization and then
        # each field packed directly according to byte size
        byteOffset = self.BYTES_BEFORE_INIT_BITS + (len(self.classType.MemberNames) // 8 + 1)

        self.bytesOfInitBits = byteOffset - self.BYTES_BEFORE_INIT_BITS

        for i, name in enumerate(self.classType.MemberNames):
            self.nameToIndex[name] = i
            self.indexToByteOffset[i] = byteOffset

            byteOffset += _types.bytecount(self.classType.MemberTypes[i])

        self.layoutType = native_ast.Type.Struct(element_types=element_types, name=t.__qualname__+"Layout").pointer()

        # we need this to actually be a global variable that we fill out, but we don't have the machinery
        # yet in the native_ast. So for now, we just hack it together.
        # because we are writing a pointer value directly into the generated code as a constant, we
        # won't be able to reuse the binary we produced in another program.
        self.vtableExpr = native_ast.const_uint64_expr(
            _types._vtablePointer(self.typeRepresentation)).cast(vtable_type.pointer()
        )

    def convert_default_initialize(self, context, instance):
        return context.pushException(TypeError, f"Can't default initialize instances of {self}")

    def getNativeLayoutType(self):
        return self.layoutType

    def on_refcount_zero(self, context, instance):
        def installDestructorFun(funcPtr):
            _types.installClassDestructor(self.typeRepresentation, funcPtr.fp)

        context.converter.defineNativeFunction(
            "destructor_" + str(self.typeRepresentation),
            ('destructor', self),
            [self],
            typeWrapper(NoneType),
            self.generateNativeDestructorFunction,
            callback=installDestructorFun
        )

        return native_ast.CallTarget.Pointer(
            expr=instance.nonref_expr.ElementPtrIntegers(0, 1).load().ElementPtrIntegers(0, 1).load()
        ).call(instance.expr.cast(native_ast.VoidPtr))

    def generateNativeDestructorFunction(self, context, out, instance):
        for i in range(len(self.typeRepresentation.MemberTypes)):
            if not typeWrapper(self.typeRepresentation.MemberTypes[i]).is_pod:
                with context.ifelse(context.pushPod(bool, self.isInitializedNativeExpr(instance, i))) as (true_block, false_block):
                    with true_block:
                        context.pushEffect(
                            self.convert_attribute(context, instance, i, nocheck=True).convert_destroy()
                        )

        context.pushEffect(runtime_functions.free.call(instance.nonref_expr.cast(native_ast.UInt8Ptr)))

    def memberPtr(self, instance, ix):
        return (
            instance
            .nonref_expr.cast(native_ast.UInt8.pointer())
            .ElementPtrIntegers(self.indexToByteOffset[ix])
            .cast(
                typeWrapper(self.typeRepresentation.MemberTypes[ix])
                .getNativeLayoutType()
                .pointer()
            )
        )

    def isInitializedNativeExpr(self, instance, ix):
        byte = ix // 8
        bit = ix % 8

        return (
            instance.nonref_expr
            .cast(native_ast.UInt8.pointer())
            .ElementPtrIntegers(self.BYTES_BEFORE_INIT_BITS + byte)
            .load()
            .rshift(native_ast.const_uint8_expr(bit))
            .bitand(native_ast.const_uint8_expr(1))
        )

    def setIsInitializedExpr(self, instance, ix):
        byte = ix // 8
        bit = ix % 8

        bytePtr = (
            instance.nonref_expr
            .cast(native_ast.UInt8.pointer())
            .ElementPtrIntegers(self.BYTES_BEFORE_INIT_BITS + byte)
        )

        return bytePtr.store(bytePtr.load().bitor(native_ast.const_uint8_expr(1 << bit)))

    def convert_attribute(self, context, instance, attribute, nocheck=False):
        if attribute in self.typeRepresentation.MemberFunctions:
            methodType = BoundClassMethodWrapper(self.typeRepresentation, attribute)

            return instance.changeType(methodType)

        if not isinstance(attribute, int):
            ix = self.nameToIndex.get(attribute)
        else:
            ix = attribute

        if ix is None:
            return context.pushTerminal(
                generateThrowException(context, AttributeError("Attribute %s doesn't exist in %s" % (attribute, self.typeRepresentation)))
            )

        if nocheck:
            return context.pushReference(
                self.typeRepresentation.MemberTypes[ix],
                self.memberPtr(instance, ix)
            )

        return context.pushReference(
            self.typeRepresentation.MemberTypes[ix],
            native_ast.Expression.Branch(
                cond=self.isInitializedNativeExpr(instance, ix),
                false=generateThrowException(context, AttributeError("Attribute %s is not initialized" % attribute)),
                true=self.memberPtr(instance, ix)
            )
        )

    def convert_method_call(self, context, instance, methodName, args, kwargs):
        # figure out which signature we'd want to use on the given args/kwargs
        argTypes = [instance.expr_type.typeRepresentation] + [a.expr_type.typeRepresentation for a in args]

        for a in argTypes:
            assert issubclass(a, Type), a

        func = self.typeRepresentation.MemberFunctions[methodName]

        for o in func.overloads:
            if o.matchesTypes(argTypes):
                # let's use this one.
                signature = o.signatureForSubtypes(methodName, argTypes)

                # we should be dispatching to this slot
                dispatchSlot = _types.allocateClassMethodDispatch(self.typeRepresentation, methodName, signature)

                classDispatchTables = instance.nonref_expr.ElementPtrIntegers(0, 1).load().ElementPtrIntegers(0, 2).load()

                classDispatchTable = classDispatchTables.elemPtr(
                    instance.nonref_expr.cast(native_ast.UInt64)
                        .rshift(native_ast.const_uint8_expr(48))
                )

                funcPtr = classDispatchTables.ElementPtrIntegers(0, 2).elemPtr(dispatchSlot).load()

                return context.call_function_pointer(funcPtr, (instance,) + tuple(args), kwargs, typeWrapper(signature.returnType))

    def convert_set_attribute(self, context, instance, attribute, value):
        if not isinstance(attribute, int):
            ix = self.nameToIndex.get(attribute)
        else:
            ix = attribute

        if ix is None:
            return context.pushTerminal(
                generateThrowException(context, AttributeError("Attribute %s doesn't exist in %s" % (attribute, self.typeRepresentation)))
            )

        attr_type = typeWrapper(self.typeRepresentation.MemberTypes[ix])

        if attr_type.is_pod:
            return context.pushEffect(
                self.memberPtr(instance, ix).store(value.nonref_expr)
                >> self.setIsInitializedExpr(instance, ix)
            )
        else:
            member = context.pushReference(attr_type, self.memberPtr(instance, ix))

            with context.ifelse(context.pushPod(bool, self.isInitializedNativeExpr(instance, ix))) as (true_block, false_block):
                with true_block:
                    member.convert_assign(value)
                with false_block:
                    member.convert_copy_initialize(value)
                    context.pushEffect(
                        self.setIsInitializedExpr(instance, ix)
                    )

            return native_ast.nullExpr

    def convert_type_call(self, context, typeInst, args, kwargs):
        if kwargs:
            raise NotImplementedError("can't kwargs-initialize a class yet")
        return context.push(
            self,
            lambda new_class:
                context.converter.defineNativeFunction(
                    'construct(' + self.typeRepresentation.__name__ + ")("
                    + ",".join([a.expr_type.typeRepresentation.__name__ for a in args]) + ")",
                    ('util', self, 'construct', tuple([a.expr_type for a in args])),
                    [a.expr_type for a in args],
                    self,
                    self.generateConstructor
                ).call(new_class, *args)
        )

    def generateConstructor(self, context, out, *args):
        context.pushEffect(
            out.expr.store(
                runtime_functions.malloc.call(
                    native_ast.const_int_expr(
                        _types.bytecount(self.typeRepresentation.HeldClass) + self.BYTES_BEFORE_INIT_BITS
                    )
                ).cast(self.getNativeLayoutType())
            ) >>
            # store a refcount
            out.expr.load().ElementPtrIntegers(0, 0).store(native_ast.const_int_expr(1)) >>
            # store the vtable
            out.expr.load().ElementPtrIntegers(0, 1).store(self.vtableExpr)
        )

        # clear bits of init flags
        for byteOffset in range(self.bytesOfInitBits):
            context.pushEffect(
                out.nonref_expr
                .cast(native_ast.UInt8.pointer())
                .ElementPtrIntegers(self.BYTES_BEFORE_INIT_BITS + byteOffset).store(native_ast.const_uint8_expr(0))
            )

        for i in range(len(self.classType.MemberTypes)):
            if _types.wantsToDefaultConstruct(self.classType.MemberTypes[i]):
                name = self.classType.MemberNames[i]

                if name in self.classType.MemberDefaultValues:
                    defVal = self.classType.MemberDefaultValues.get(name)
                    context.pushReference(self.classType.MemberTypes[i], self.memberPtr(out, i)).convert_copy_initialize(
                        nativepython.python_object_representation.pythonObjectRepresentation(context, defVal)
                    )
                else:
                    context.pushReference(self.classType.MemberTypes[i], self.memberPtr(out, i)).convert_default_initialize()
                context.pushEffect(self.setIsInitializedExpr(out, i))

        if '__init__' in self.typeRepresentation.MemberFunctions:
            initFuncType = typeWrapper(self.typeRepresentation.MemberFunctions['__init__'])
            initFuncType.convert_call(context, context.pushVoid(initFuncType), (out,) + args, {})
        else:
            if len(args):
                context.pushException(
                    TypeError,
                    "Can't construct a " + self.typeRepresentation.__qualname__ +
                    " with positional arguments because it doesn't have an __init__"
                )
