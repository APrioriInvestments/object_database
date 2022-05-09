[![Build Status](https://travis-ci.com/APrioriInvestments/object_database.svg?branch=dev)](https://travis-ci.com/APrioriInvestments/object_database.svg?branch=dev)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# object_database

An in-memory distributed objects in python, with transactions, plus a reactive web layer.


# Quickstart

Use the included `docker-compose` file to quickly spin up a container to try out object database.

1. Make sure [docker](https://docs.docker.com/get-docker/) is installed on your system
2. Clone this repository (e.g., `git clone git@github.com:APrioriInvestments/object_database`)
3. CD into the cloned repo
4. Run `docker-compose up`
5. Go to localhost:8000 in your browser to see the object database web test application

N.B. if installing docker for the first time (at least on mac) you may need to:
a) startup the docker desktop app (it will download some more things and set vars)
b) run a container such as the example one docker run -d -p 80:80 docker/getting-started

# Installation

The recommended way to install object_database is by cloning the repo and pip install 
from the repo. The public PyPI release is out of date.

1. Clone repo `git clone git@github.com:APrioriInvestments/object_database`
2. Create a fresh virtual environment with python 3.6-3.8

    via venv
    ```shell
    cd object_database
    python3 -m venv .venv
    . .venv/bin/activate
    export PYTHONPATH=`pwd`
    ```
    
    via conda
    ```shell
    cd object_database
    conda create -y -n odb python=3.8
    conda activate odb
    export PYTHONPATH=`pwd`
    ```
   
3. Build and install from source:

    ```shell
    pip install -e .
    ```
   
# Major components

This repo has 3 major components and 1 notable major dependency:
- distributed object engine
- service manager ("k8s-lite")
- reactive web layer (Cells)
- typed_python

## In-memory distributed object database

The core of this repo is a distributed in-memory object database engine.
Using this engine, you can define type-safe collections of objects that
can be safely and consistently written/read by multiple clients concurrently.
The database engine supports transactions and takes care of consistency and
state syncing (via optimistics concurrency control).

For details and examples see [object engine docs](./docs/object_engine.md)

## Service manager (k8s-lite)

Object database has a service management engine can manage distributed compute, 
run web services, run jobs, and more. This engine lives in 
[./object_database/service_manager](./object_database/service_manager) and uses
a running object database to manage state.

For more details see [service manager docs](./docs/service_manager.md)

## Cells (reactive web layer)

TODO: link to Cells docs from @dkrasner

## Typed python

ODB uses [typed_python](https://github.com/APrioriInvestments/typed_python)
to define object schemas and offer safety/performance. It is also the most 
frequent source of build/install problems. Most notably, you need to make sure
that this repo and typed_python are built on the same version of numpy 
(see [pyproject.toml](./pyproject.toml) for dependencies and version constraints 
for the build, [requirements.txt](./requirements.txt) package installation deps).
Note that the `pyproject.toml` is required so the C++ extensions are built on the
correct version of numpy.

For more details see [typed_python docs](./docs/typed_python.md).

# Support matrix

As of 2022-04-28, only python 3.6-3.8 is supported (due to typed_python not working for 3.9/3.10).
Linux: works more or less out of the box
MacOS: requires a decent amount of futzing
Windows: ahahahahaha good one

