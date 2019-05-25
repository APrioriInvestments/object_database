#   Copyright 2019 Nativepython Authors
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

"""
cpp_compiler

A prototype of a model for compiling c++-14 source code into a binary,
and for managing such binaries. Eventually, this ought to be implemented
by statically linking against the subset of llvm/clang libraries we need
to do this, so that we can compile and manage code entirely in process,
and ensure that the right versions of c++ and the stl are present.

For now, as a prototype, we're using out-of-process gcc, which will
only work on linux and if a modern gcc is installed.
"""

import tempfile
import subprocess
import os
import ctypes
import struct
import pkg_resources
import distutils.sysconfig

from typed_python import sha_hash

_root_dir = os.path.split(os.path.split(__file__)[0])[0]

class BinarySharedObject:
    """Models a shared object library (.so) loadable on linux systems."""

    def __init__(self, binaryForm):
        self.binaryForm = binaryForm

    def loadAndReturnFunctionPointers(self, symbolsToReturn, storageDir):
        """Instantiate this .so in temporary storage and return a dict from symbol -> integer function pointer"""
        if not os.path.exists(storageDir):
            os.makedirs(storageDir)

        modulename = sha_hash(self.binaryForm).hexdigest + "_module.so"
        modulePath = os.path.join(storageDir, modulename)

        with open(modulePath, "wb") as f:
            f.write(self.binaryForm)

        dll = ctypes.CDLL(modulePath)

        output = {}

        for symbol in symbolsToReturn:
            # if you ask for 'bytes' on a ctypes function you get the function pointer
            # encoded as a bytearray.
            output[symbol] = struct.unpack("q", bytes(dll[symbol]))[0]

        return output


extra_compile_args = [
    '-O2',
    '-fstack-protector-strong',
    '-Wformat',
    '-Wdate-time',
    '-Werror=format-security',
    '-std=c++14',
    '-Wno-sign-compare',
    '-Wno-narrowing'
]

class Compiler:
    def __init__(self):
        pass

    def compile(self, source:str) -> BinarySharedObject:
        """Compile a single translation unit into a shared object.

        The source can compile anything in the typed_python/nativepython ecosystem,
        or in the STL.
        """
        with tempfile.TemporaryDirectory() as srcDir:
            codePath = os.path.join(srcDir, "code.cpp")
            objectPath = os.path.join(srcDir, "code.o")
            binaryPath = os.path.join(srcDir, "code.so")

            with open(codePath, 'w') as f:
                f.write(source)

            res = subprocess.run(
                ["gcc", "-shared", "-fPIC", codePath, "-o", binaryPath, "-I", _root_dir] +
                ["-I", pkg_resources.resource_filename('numpy', 'core/include')] +
                ["-I", distutils.sysconfig.get_python_inc()] +
                extra_compile_args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

            if res.returncode != 0:
                raise Exception("FAILED:\n" + "\n".join(res.stderr.decode("utf8").split("\n")[:20]))


            with open(binaryPath, "rb") as f:
                return BinarySharedObject(f.read())

