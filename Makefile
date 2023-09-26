##########################################################################
#  CONFIGURATION

# Path to python binary
PYTHON ?= $(shell which python3)

COMMIT ?= $(shell git rev-parse HEAD)

PWD = $(shell pwd)

# Path to virtual environment(s)
VIRTUAL_ENV ?= .venv
NODE_ENV ?= .nodeenv

TP_SRC_PATH ?= ../typed_python/typed_python
ODB_SRC_PATH ?= object_database

ODB_BUILD_PATH ?= build/temp.linux-x86_64/object_database
ODB_LIB_PATH ?= build/lib.linux-x86_64/object_database

TYPES_SO_NAME = $(shell python3 -c 'import _ssl; import os; print(os.path.split(_ssl.__file__)[1].replace("_ssl", "_types"))')
TYPES_O_NAME = $(shell python3 -c 'import _ssl; import os; print(os.path.split(_ssl.__file__)[1].replace("_ssl", "_types")[:-2] + "o")')

TP_BUILD_OPT_LEVEL ?= 2

PYINCLUDE = $(shell python3 -c 'import sysconfig; print(sysconfig.get_paths()["include"])')

NUMPYINCLUDE = $(shell python3 -c 'import pkg_resources; print(pkg_resources.resource_filename("numpy", "core/include"))')

CPP_FLAGS = -std=c++14  -O$(TP_BUILD_OPT_LEVEL)  -Wall  -pthread  -DNDEBUG  -g  -fwrapv         \
            -fstack-protector-strong  -D_FORTIFY_SOURCE=2  -fPIC            \
            -Wno-terminate -Wno-bool-compare                                \
            -Wno-cpp                                                        \
            -Wformat  -Werror=format-security  -Wdate-time -Wno-reorder     \
            -Wno-sign-compare  -Wno-narrowing  -Wno-int-in-bool-context     \
            -I../typed_python                                               \
            -I$(PYINCLUDE)                                       			\
            -I$(NUMPYINCLUDE)											    \

LINKER_FLAGS = -Wl,-O1                  \
               -Wl,-Bsymbolic-functions \
               -Wl,-z,relro
LINK_FLAGS_POST = -lssl

SHAREDLIB_FLAGS = -pthread -shared -g -fstack-protector-strong \
                  -Wformat -Werror=format-security -Wdate-time \
                  -D_FORTIFY_SOURCE=2

UNICODEPROPS = $(TP_SRC_PATH)/UnicodeProps.hpp
ODB_O_FILES = $(ODB_BUILD_PATH)/all.o
DT_SRC_PATH = $(TP_SRC_PATH)/direct_types
TESTTYPES = $(DT_SRC_PATH)/GeneratedTypes1.hpp
TESTTYPES2 = $(DT_SRC_PATH)/ClientToServer0.hpp

##########################################################################
#  MAIN RULES

.PHONY: install
install: $(VIRTUAL_ENV) testcert.cert testcert.key install-dependencies install-odb pre-commit-install


.PHONY: install-dependencies
.ONESHELL:
install-dependencies: $(VIRTUAL_ENV) requirements.lock dev-requirements.lock
	. $(VIRTUAL_ENV)/bin/activate; \
		pip install --requirement requirements.lock; \
		pip install --requirement dev-requirements.lock

	nodeenv --python-virtualenv --prebuilt --node=16.20.2 $(NODE_ENV)
	npm install --global webpack webpack-cli
	cd object_database/web/content
	npm install
	webpack

.PHONY: install-odb
.ONESHELL:
install-odb: $(VIRTUAL_ENV)
	. $(VIRTUAL_ENV)/bin/activate
	pip install --editable .

.PHONY: pre-commit-install
pre-commit-install: $(VIRTUAL_ENV)
	. $(VIRTUAL_ENV)/bin/activate; \
		pip install pre-commit; \
		pre-commit install;

.PHONY: node-install
node-install:
	pip3 install nodeenv; \
	nodeenv --prebuilt --node=10.15.3 $(NODE_ENV); \
	. $(NODE_ENV)/bin/activate; \
	npm install --global webpack webpack-cli; \
	cd object_database/web/content; \
	npm install

.PHONY: build-js
build-js:
	. $(NODE_ENV)/bin/activate; \
	cd object_database/web/content; \
	npm run build

.PHONY: test
test: $(VIRTUAL_ENV) testcert.cert testcert.key js-test
	. $(VIRTUAL_ENV)/bin/activate; pytest

.PHONY: js-test
js-test:
	. $(NODE_ENV)/bin/activate; \
	cd object_database/web/content/; \
	npm test

.PHONY: js-test-editor
js-test-editor:
	. $(NODE_ENV)/bin/activate; \
	cd object_database/web/content/; \
	npm run test-editor

.PHONY: lint-local
lint-local:
	flake8

.PHONY: lint
lint: $(VIRTUAL_ENV)
	. $(VIRTUAL_ENV)/bin/activate; \
		make lint-local

.PHONY: black
black: $(VIRTUAL_ENV)
	. $(VIRTUAL_ENV)/bin/activate; \
		black --target-version=py36  --line-length=95  object_database

.PHONY: black-check
black-check: $(VIRTUAL_ENV)
	. $(VIRTUAL_ENV)/bin/activate; \
		make black-check-local

.PHONY: black-check-local
black-check-local:
	black --check --target-version=py36  --line-length=95  object_database


.PHONY: cells-demo
cells-demo:
	@echo "Starting cells demo. Point your browser to 'localhost:8000'."
	. $(VIRTUAL_ENV)/bin/activate; \
		./object_database/frontends/object_database_webtest.py

.PHONY: lib
lib: object_database/$(TYPES_SO_NAME)

.PHONY: docker-build
docker-build:
	rm -rf build
	rm -rf nativepython.egg-info
	docker build . -t nativepython/cloud:"$(COMMIT)"
	docker tag nativepython/cloud:"$(COMMIT)"  nativepython/cloud:latest

.PHONY: docker-push
docker-push:
	docker push nativepython/cloud:"$(COMMIT)"
	docker push nativepython/cloud:latest

.PHONY: docker-test
docker-test:
	#run unit tests in the debugger
	docker run -it --rm --privileged --entrypoint bash \
		nativepython/cloud:"$(COMMIT)" \
		-c "gdb -ex run --args  python -m pytest"

.PHONY: docker-web
docker-web:
	#run a dummy webframework
	docker run -it --rm --publish 8000:8000 --entrypoint object_database_webtest \
		nativepython/cloud:"$(COMMIT)"

.PHONY: unicodeprops
unicodeprops: ./unicodeprops.py
	$(PYTHON) ./unicodeprops.py > $(UNICODEPROPS)

.PHONY: generatetesttypes
generatetesttypes: $(DT_SRC_PATH)/generate_types.py
	. $(VIRTUAL_ENV)/bin/activate; \
		python3 $(DT_SRC_PATH)/generate_types.py --testTypes3 $(TESTTYPES); \
		python3 $(DT_SRC_PATH)/generate_types.py --testTypes2 $(TESTTYPES2); \

.PHONY: clean
clean:
	rm -rf build/
	rm -f object_database/$(TYPES_SO_NAME)
	rm -f testcert.cert testcert.key
	rm -rf $(VIRTUAL_ENV) .env
	rm -rf .nodeenv
	rm -f object_database/web/content/dist/main.bundle.js
	rm -f .coverage*
	rm -rf dist


##########################################################################
#  HELPER RULES

.env:
	echo "# NOTICE: File Auto-generated by Makefile" > $@
	echo "export COVERAGE_PROCESS_START=$(PWD)/tox.ini" >> $@
	echo "export PYTHONPATH=$(PWD)" >> $@

.ONESHELL:
$(VIRTUAL_ENV): $(PYTHON) .env
	$(PYTHON) -m venv $(VIRTUAL_ENV)
	. $(VIRTUAL_ENV)/bin/activate
	pip install --upgrade pip pip-tools wheel

$(ODB_BUILD_PATH)/all.o: $(ODB_SRC_PATH)/*.hpp $(ODB_SRC_PATH)/*.cpp $(TP_SRC_PATH)/*.hpp
	$(CC) $(CPP_FLAGS) -c $(ODB_SRC_PATH)/all.cpp $ -o $@

object_database/$(TYPES_SO_NAME): $(ODB_LIB_PATH)/$(TYPES_SO_NAME)
	cp $(ODB_LIB_PATH)/$(TYPES_SO_NAME)  object_database

$(ODB_LIB_PATH)/$(TYPES_SO_NAME): $(ODB_LIB_PATH) $(ODB_BUILD_PATH) $(ODB_O_FILES)
	$(CXX) $(SHAREDLIB_FLAGS) $(LINKER_FLAGS) \
		$(ODB_O_FILES) \
		-o $(ODB_LIB_PATH)/$(TYPES_SO_NAME) $(LINK_FLAGS_POST)

$(ODB_BUILD_PATH):
	mkdir --parents $(ODB_BUILD_PATH)

$(ODB_LIB_PATH):
	mkdir --parents $(ODB_LIB_PATH)

testcert.cert testcert.key:
	openssl req -x509 -newkey rsa:2048 -keyout testcert.key -nodes \
		-out testcert.cert -sha256 -days 1000 \
		-subj '/C=US/ST=New York/L=New York/CN=localhost'

.PHONY: pypi-upload
pypi-upload: $(VIRTUAL_ENV)
	. $(VIRTUAL_ENV)/bin/activate; \
		rm -rf dist; \
		python setup.py sdist; \
		twine upload dist/*;

requirements.lock: requirements.txt
	. $(VIRTUAL_ENV)/bin/activate; \
		pip-compile --quiet --output-file $@ requirements.txt

dev-requirements.lock: dev-requirements.txt requirements.lock
	. $(VIRTUAL_ENV)/bin/activate; \
		pip-compile --quiet --output-file $@ dev-requirements.txt

.PHONY: upgrade-dependencies
upgrade-dependencies:
	. $(VIRTUAL_ENV)/bin/activate; \
		pip-compile --quiet --upgrade --output-file \
			requirements.lock  requirements.txt; \
		pip-compile --quiet --upgrade --output-file \
			dev-requirements.lock  dev-requirements.txt; \
