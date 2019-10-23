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

TP_BUILD_PATH ?= build/temp.linux-x86_64-3.6/typed_python
TP_LIB_PATH ?= build/lib.linux-x86_64-3.6/typed_python

ODB_BUILD_PATH ?= build/temp.linux-x86_64-3.6/object_database
ODB_LIB_PATH ?= build/lib.linux-x86_64-3.6/object_database

CPP_FLAGS = -std=c++14  -O2  -Wall  -pthread  -DNDEBUG  -g  -fwrapv         \
            -fstack-protector-strong  -D_FORTIFY_SOURCE=2  -fPIC            \
            -Wno-terminate -Wno-bool-compare \
            -Wno-cpp \
            -Wformat  -Werror=format-security  -Wdate-time -Wno-reorder     \
            -Wno-sign-compare  -Wno-narrowing  -Wno-int-in-bool-context     \
            -I$(VIRTUAL_ENV)/include/python3.6m                             \
            -I$(VIRTUAL_ENV)/lib/python3.6/site-packages/numpy/core/include \
            -I../typed_python                                                \
            -I/usr/include/python3.6m                                       \
            -I/usr/local/lib/python3.6/dist-packages/numpy/core/include

LINKER_FLAGS = -Wl,-O1 \
               -Wl,-Bsymbolic-functions \
               -Wl,-z,relro

SHAREDLIB_FLAGS = -pthread -shared -g -fstack-protector-strong \
                  -Wformat -Werror=format-security -Wdate-time \
                  -D_FORTIFY_SOURCE=2

UNICODEPROPS = $(TP_SRC_PATH)/UnicodeProps.hpp
TP_O_FILES = $(TP_BUILD_PATH)/all.o
ODB_O_FILES = $(ODB_BUILD_PATH)/all.o
DT_SRC_PATH = $(TP_SRC_PATH)/direct_types
TESTTYPES = $(DT_SRC_PATH)/GeneratedTypes1.hpp
TESTTYPES2 = $(DT_SRC_PATH)/ClientToServer0.hpp

##########################################################################
#  MAIN RULES

.PHONY: install
install: $(VIRTUAL_ENV) testcert.cert testcert.key pre-commit-install
	. $(VIRTUAL_ENV)/bin/activate; \
		pip install pipenv==2018.11.26; \
		pip install black; \
		pipenv install --dev --deploy; \
		pip install -e .; \
		nodeenv --python-virtualenv --prebuilt --node=10.15.3 $(NODE_ENV); \
		npm install --global webpack webpack-cli; \
		cd object_database/web/content; \
		npm install; \
	 	webpack

.PHONY: pre-commit-install
pre-commit-install: $(VIRTUAL_ENV)
	pip install pre-commit
	pre-commit install

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

.PHONY: install-local
install-local: $(VIRTUAL_ENV)
	. $(VIRTUAL_ENV)/bin/activate; \
		pip install pipenv==2018.11.26; \
		pip install --editable ../typed_python; \
		pip install --editable .

.PHONY: test
test: $(VIRTUAL_ENV) testcert.cert testcert.key js-test
	. $(VIRTUAL_ENV)/bin/activate; pytest

.PHONY:
js-test:
	cd object_database/web/content/; npm test

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
		black --target-version=py36  --line-length=95  .

.PHONY: lib
lib: object_database/_types.cpython-36m-x86_64-linux-gnu.so

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
	python3 $(DT_SRC_PATH)/generate_types.py --testTypes3 $(TESTTYPES)
	. $(VIRTUAL_ENV)/bin/activate; \
	python3 $(DT_SRC_PATH)/generate_types.py --testTypes2 $(TESTTYPES2)

.PHONY: clean
clean:
	rm -rf build/
	rm -rf nativepython.egg-info/
	rm -f nose.*.log
	rm -f typed_python/_types.cpython-*.so
	rm -f object_database/_types.cpython-*.so
	rm -f testcert.cert testcert.key
	rm -rf $(VIRTUAL_ENV) .env
	rm -rf .nodeenv
	rm -f object_database/web/content/dist/main.bundle.js
	rm -f .coverage*


##########################################################################
#  HELPER RULES

.env:
	echo "NOTICE: File Auto-generated by Makefile" > $@
	echo "export COVERAGE_PROCESS_START=$(PWD)/tox.ini" >> $@
	echo "export PYTHONPATH=$(PWD)" >> $@

$(VIRTUAL_ENV): $(PYTHON) .env
	virtualenv $(VIRTUAL_ENV) --python=$(PYTHON)

$(ODB_BUILD_PATH)/all.o: $(ODB_SRC_PATH)/*.hpp $(ODB_SRC_PATH)/*.cpp $(TP_SRC_PATH)/*.hpp
	$(CC) $(CPP_FLAGS) -c $(ODB_SRC_PATH)/all.cpp $ -o $@

object_database/_types.cpython-36m-x86_64-linux-gnu.so: $(ODB_LIB_PATH)/_types.cpython-36m-x86_64-linux-gnu.so
	cp $(ODB_LIB_PATH)/_types.cpython-36m-x86_64-linux-gnu.so  object_database

$(ODB_LIB_PATH)/_types.cpython-36m-x86_64-linux-gnu.so: $(ODB_LIB_PATH) $(ODB_BUILD_PATH) $(ODB_O_FILES)
	$(CXX) $(SHAREDLIB_FLAGS) $(LINKER_FLAGS) \
		$(ODB_O_FILES) \
		-o $(ODB_LIB_PATH)/_types.cpython-36m-x86_64-linux-gnu.so

$(TP_BUILD_PATH):
	mkdir -p $(TP_BUILD_PATH)

$(ODB_BUILD_PATH):
	mkdir -p $(ODB_BUILD_PATH)

$(TP_LIB_PATH):
	mkdir -p $(TP_LIB_PATH)

$(ODB_LIB_PATH):
	mkdir -p $(ODB_LIB_PATH)

testcert.cert testcert.key:
	openssl req -x509 -newkey rsa:2048 -keyout testcert.key -nodes \
		-out testcert.cert -sha256 -days 1000 \
		-subj '/C=US/ST=New York/L=New York/CN=localhost'
