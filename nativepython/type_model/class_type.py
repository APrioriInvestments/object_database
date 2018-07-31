#   Copyright 2017 Braxton Mckee
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

import types

from nativepython.type_model.type_base import Type
from nativepython.type_model.typed_expression import TypedExpression
from nativepython.exceptions import ConversionException, UnassignableFieldException

import nativepython
import nativepython.python.string_util as string_util
import nativepython.native_ast as native_ast

special_member_names_accessible_directly = [
    '__iter__',
    '__len__'
    ]

def class_has_function(cls, name):
    return hasattr(cls, name) and isinstance(getattr(cls, name), types.FunctionType)

def is_special_name(name):
    return name.startswith("__") and name.endswith("__") and len(name) > 4

class ClassType(Type):   
    def __init__(self, cls):
        self.cls = cls
    
    @property
    def is_pod(self):
        if (class_has_function(self.cls, "__assign__") 
                or class_has_function(self.cls, "__destructor__")
                or class_has_function(self.cls, "__init__") 
                or class_has_function(self.cls, "__copy_constructor__")
                ):
            return False

        for _,e in self.element_types:
            if not e.is_pod:
                return False

        return True

    @property
    def is_class(self):
        return True

    @property
    def null_value(self):
        return native_ast.Constant.Struct(
                [(name,t.null_value) for name,t in self.element_types]
                )

    def convert_initialize_copy(self, context, instance_ref, other_instance):
        self.assert_is_instance_ref(instance_ref)

        if not self.is_pod:
            self.assert_is_instance_ref(other_instance)

        if class_has_function(self.cls, "__copy_constructor__"):
            def make_body(instance_ref, other_instance):
                init_func = self.cls.__copy_constructor__

                call_target = context.converter.convert_initializer_function(
                    init_func, 
                    [instance_ref.expr_type, other_instance.expr_type],
                    self.cls.__name__+".__copy_constructor__",
                    self.element_types
                    )
                    
                return TypedExpression.Void(
                    context.generate_call_expr(
                        target=call_target.named_call_target,
                        args=[instance_ref.expr, other_instance.expr]
                        )
                    )

            return context.call_expression_in_function(
                (self, "initialize_copy"), "%s.initialize_copy" % (self.cls.__name__), 
                [instance_ref, other_instance], 
                make_body
                )
        else:
            def make_body(instance_ref, other_instance):
                body = native_ast.nullExpr

                for ix,(name,e) in enumerate(self.element_types):
                    dest_field = self.reference_to_field(instance_ref.expr, name)
                    source_field = other_instance.convert_attribute(context, name)

                    body = body + dest_field.convert_initialize_copy(context, source_field).expr

                return TypedExpression.Void(body)

            return context.call_expression_in_function(
                (self, "initialize_copy"), 
                "%s.initialize_copy" % (str(self)), 
                [instance_ref, other_instance], 
                make_body
                )

    def convert_destroy(self, context, instance_ref):
        self.assert_is_instance_ref(instance_ref)
        
        def make_body(instance_ref):
            expr = native_ast.nullExpr

            if class_has_function(self.cls, "__destructor__"):
                destructor_func = self.cls.__destructor__
                expr = context.call_py_function(
                    destructor_func, 
                    [instance_ref],
                    name_override=self.cls.__name__+".__destructor__").expr

            #destroy things in reverse order
            for ix,(name,e) in enumerate(reversed(self.element_types)):
                dest_field = self.reference_to_field(instance_ref.expr, name)

                dest_t = dest_field.expr_type.value_type
                expr = expr + dest_t.convert_destroy(context, dest_field).expr

            return TypedExpression.Void(expr)

        return context.call_expression_in_function(
            (self,'destroy'), 
            "%s.destroy" % (self.cls.__name__),
            [instance_ref],
            make_body
            )

    def convert_initialize(self, context, instance_ref, args):
        self.assert_is_instance_ref(instance_ref)

        def make_body(instance_ref, *args):
            body = native_ast.nullExpr

            if not class_has_function(self.cls, "__init__"):
                if len(args) != len(self.element_types) and len(args) != 0:
                    raise ConversionException("Can't initialize %s with arguments of type %s" % (
                            self, [str(a.expr_type) for a in args]
                            )
                        )

                for ix,(name,e) in enumerate(self.element_types):
                    dest_field = self.reference_to_field(instance_ref.expr, name)

                    dest_t = dest_field.expr_type.value_type
                    if len(args):
                        body = body + dest_t.convert_initialize_copy(context, dest_field, args[ix]).expr
                    else:
                        body = body + dest_t.convert_initialize(context, dest_field, ()).expr

                return TypedExpression.Void(body)
            else:
                init_func = self.cls.__init__
                
                call_target = context.converter.convert_initializer_function(
                    init_func, 
                    [instance_ref.expr_type] + [a.expr_type for a in args],
                    self.cls.__name__+".__init__",
                    self.element_types
                    )

                return TypedExpression.Void(
                    context.generate_call_expr(
                        target=call_target.named_call_target,
                        args=[instance_ref.expr] + [a.expr for a in args]
                        )
                    )

        return context.call_expression_in_function(
            (self, "initialize"), 
            "%s.initialize" % (self.cls.__name__), 
            [instance_ref] + list(args), 
            make_body
            )

    def convert_assign(self, context, instance_ref, arg):
        self.assert_is_instance_ref(instance_ref)
        self.assert_is_instance_ref(arg)
        
        def make_body(instance_ref, arg):
            expr = native_ast.nullExpr

            if class_has_function(self.cls, "__assign__"):
                assign_func = self.cls.__assign__
                return context.call_py_function(
                    assign_func, 
                    [instance_ref, arg],
                    name_override=self.cls.__name__+".__assign__"
                    )

            for ix,(name,e) in enumerate(self.element_types):
                dest_field = self.reference_to_field(instance_ref.expr, name)
                source_field = arg.convert_attribute(context, name)

                dest_t = dest_field.expr_type.value_type
                expr = expr + dest_t.convert_assign(context, dest_field, source_field).expr

            return TypedExpression.Void(expr)

        return context.call_expression_in_function(
            (self,"assign"), 
            "%s.assign" % self.cls.__name__, 
            [instance_ref, arg], 
            make_body
            )

    def lower(self):
        return native_ast.Type.Struct(tuple([(a[0], a[1].lower()) for a in self.element_types]))

    def convert_attribute(self, context, instance_or_ref, attr, allow_double_refs=False):
        if is_special_name(attr) and attr not in special_member_names_accessible_directly:
            raise ConversionException("Illegal to access attributes with names like __X__")

        if self.is_pod and instance_or_ref.expr_type == self:
            instance = instance_or_ref

            for i in range(len(self.element_types)):
                if self.element_types[i][0] == attr:
                    return TypedExpression(
                        native_ast.Expression.Attribute(
                            left=instance.expr, 
                            attr=attr
                            ),
                        self.element_types[i][1]
                        ).drop_double_references()
        else:
            instance_ref = instance_or_ref

            self.assert_is_instance_ref(instance_ref)

            field = self.reference_to_field(instance_ref.expr, attr)
            if field is not None:
                if allow_double_refs:
                    return field
                else:
                    return field.drop_double_references()

            if hasattr(self.cls, attr) and isinstance(getattr(self.cls, attr), property):
                return context.call_py_function(
                    getattr(self.cls, attr).fget, 
                    [instance_ref],
                    name_override=self.cls.__name__+".%s.getter" % attr
                    )


            func = None
            try:
                func = getattr(self.cls, attr)
            except AttributeError:
                pass

            if func is not None:
                return TypedExpression(instance_ref.expr, PythonClassMemberFunc(self, attr))

        return super(ClassType,self).convert_attribute(context, instance_ref, attr, allow_double_refs)

    def reference_to_field(self, native_instance_ptr, attribute_name):
        for i in range(len(self.element_types)):
            if self.element_types[i][0] == attribute_name:
                return TypedExpression(
                    native_instance_ptr.ElementPtrIntegers(0, i),
                    self.element_types[i][1].reference
                    )

    def convert_set_attribute(self, context, instance_ref, attr, val):
        self.assert_is_instance_ref(instance_ref)

        if hasattr(self.cls, attr) and isinstance(getattr(self.cls, attr), property):
            return context.call_py_function(
                getattr(self.cls, attr).fset, 
                [instance_ref, val],
                name_override=self.cls.__name__+".%s.setter" % attr
                )

        field_ref = self.reference_to_field(instance_ref.expr, attr).drop_double_references()

        if field_ref is None:
            raise UnassignableFieldException(self, attr, val.expr_type)

        return field_ref.convert_assign(context, val)

    def convert_getitem(self, context, instance, item):
        if class_has_function(self.cls, "__getitem__"):
            getitem = self.cls.__getitem__
            return context.call_py_function(
                getitem, 
                [instance, item],
                name_override=self.cls.__name__+".__getitem__"
                )

        return self.convert_getitem(context, instance, item)

    def convert_setitem(self, context, instance, item, value):
        if class_has_function(self.cls, "__setitem__"):
            getitem = self.cls.__setitem__
            return context.call_py_function(
                getitem, 
                [instance, item, value],
                name_override=self.cls.__name__+".__setitem__"
                )

        return self.convert_setitem(context, instance, item, value)

    def __str__(self):
        return "Class(%s@%s,%s)" % (self.cls.__name__, id(self.cls), 
                ",".join(["%s=%s" % t for t in self.element_types]))

    def fieldsToCheck(self):
        return ('cls', 'element_types')

class PythonClassMemberFunc(Type):
    def __init__(self, python_class_type, attr):
        self.python_class_type = python_class_type
        self.attr = attr

    def lower(self):
        return self.python_class_type.pointer.lower()

    @property
    def is_pod(self):
        return True

    def convert_call(self, context, instance, args):
        instance = instance.dereference()

        func = getattr(self.python_class_type.cls, self.attr)

        if isinstance(func, Override):
            func = func.first_matching(args)
        
        obj_ref = TypedExpression(instance.expr, self.python_class_type.reference)

        return context.call_py_function(
            func, 
            [obj_ref] + args, 
            name_override=self.python_class_type.cls.__name__ + "." + self.attr
            )

    def __str__(self):
        return "ClassMemberFunction(%s,%s,%s)" % (
            self.python_class_type.cls, 
            self.attr, 
            ",".join(["%s=%s" % t for t in self.python_class_type.element_types])
            )
