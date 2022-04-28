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
