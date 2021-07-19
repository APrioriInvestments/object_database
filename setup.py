#   Copyright 2017-2019 object_database Authors
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

import pkg_resources
import setuptools
import os

from distutils.command.build_ext import build_ext
from distutils.extension import Extension


class BuildExtension(build_ext):
    """
    Used for when numpy headers are needed during build.
    Ensures that numpy will be installed before attempting
    to include any of its libraries
    """

    def run(self):
        numpy_dir = pkg_resources.resource_filename("numpy", "core/include")
        self.include_dirs.append(numpy_dir)

        # The typed_python includes are inline.
        # We want to find them as #include <typed_python/...>, so we kluge this
        # together this way. Better to modify typed_python to export its
        # includes in a more reasonable way.
        tp_dir = pkg_resources.resource_filename("typed_python", ".")
        dir_to_add = os.path.dirname(os.path.dirname(tp_dir))
        self.include_dirs.append(dir_to_add)
        build_ext.run(self)


extra_compile_args = [
    "-O2",
    "-fstack-protector-strong",
    "-Wformat",
    "-Wdate-time",
    "-Werror=format-security",
    "-std=c++14",
    "-Wno-sign-compare",
    "-Wno-narrowing",
    "-Wno-sign-compare",
    "-Wno-terminate",
    "-Wno-reorder",
    "-Wno-bool-compare",
    "-Wno-cpp",
]

ext_modules = [
    Extension(
        "object_database._types",
        sources=["object_database/all.cpp"],
        define_macros=[("_FORTIFY_SOURCE", 2)],
        extra_compile_args=extra_compile_args,
        libraries=["ssl"],
    )
]

INSTALL_REQUIRES = [line.strip() for line in open("requirements.txt")]

setuptools.setup(
    name="object_database",
    version="0.2",
    description="Distributed software transactional memory.",
    author="Braxton Mckee",
    author_email="braxton.mckee@gmail.com",
    url="https://github.com/aprioriinvestments/object_database",
    packages=setuptools.find_packages(),
    cmdclass={"build_ext": BuildExtension},
    ext_modules=ext_modules,
    # setup_requires: replaced by build-system:requires in pyproject.toml
    install_requires=INSTALL_REQUIRES,
    # https://pypi.org/classifiers/
    classifiers=[
        "License :: OSI Approved :: Apache Software License",
        "Programming Language :: Python :: 3 :: Only",
    ],
    license="Apache Software License v2.0",
    entry_points={
        "console_scripts": [
            "object_database_webtest=object_database.frontends.object_database_webtest:main",
            "object_database_service_manager=object_database.frontends.service_manager:main",
        ]
    },
    include_package_data=True,
    zip_safe=False,
)
