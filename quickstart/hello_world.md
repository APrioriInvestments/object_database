# Hello World Tutorial

This file takes us through a very simple example of setting up an ODB/cells project
from start to finish.  Note that object_database requires typed python, which doesn't
run on windows right now, so you'll have to run this on linux (preferable) or MacOS (
ought to work, but not as thoroughly tested in the wild).


## Installation

First, make a fresh virtual environment, and install object database and typed python into it.

    python3 -m venv .venv

Activate the virtual environment

    . .venv/bin/activate
    export PYTHONPATH=`pwd`

Then lets install our dependencies

    pip install --upgrade pip
    pip install typed_python

    # change this to whatever path your object database codebase is
    pip install -e ../object_database

At this point, you should have a working odb install. If you want to see a running service
we need to install and build the web dependencies. In `object_database/object_database/web/content`
run

    nodeenv --node=16.16.0 --prebuilt .nenv
    source .nenv/bin/activate
    npm install
    npm run build

(you can choose another version of node, but note this is only tested with LTS versions).

Following, run

    object_database_webtest

and connect your browser to localhost:8000 to see the cells demos.

## Running the core ODB

The main ODB installation itself can be run with its storage tied to a redis database or
held in memory. For purposes of the tutorial, we'll just use the in-memory version, but if
you want the state of the ODB to persist even if the odb process goes down, you can stand up
a dedicated local redis and configure it to use that.

In a new terminal window, activate the virtual environment and run

    object_database_service_manager \
        localhost \
        localhost \
        8000 \
        Master \
        --run_db \
        --service-token TOKEN \
        --source ./odb/source \
        --storage ./odb/storage

This starts an in-memory ODB. The state of the system will be ephemeral - if you kill this
process it will go away.

In another terminal, activate the virtual environment, make a new directory called src,
and initialize a git repo.  Create a directory called hello_world, add an
empty __init__.py and a file called hello_world_service.py. Your directory structure
should look something like this

    .venv/
        ... venv stuff ...
    odb/
        source/
        storage/
    src/
        .git/
            ...
        hello_world/
            __init__.py
            hello_world_service.py

Into hello_world_service.py put this code:

    from object_database import Schema, ServiceBase
    import object_database.web.cells as cells
    import time
    import random

    # define a 'schema', which is a collection of classes we can subscribe to as a group
    schema = Schema("hello_world")

    # define a type of entry in odb. We'll have one instance of this class for each
    # message in the database
    @schema.define
    class Message:
        timestamp = float
        message = str
        lifetime = float


    # define a service, which gets to do two things: (1) provide a default UI, and (2) execute
    # code in the background.
    class HelloWorldService(ServiceBase):
        def initialize(self):
            # make sure we're subscribed to all objects in our schema. More complex apps
            # need to be careful what they subscribe to if the number of objects is very large.
            self.db.subscribeToSchema(schema)

        def doWork(self, shouldStop):
            # this is the main entrypoint for the service - it gets to do work here.
            while not shouldStop.is_set():
                # more sophisticated models can be explicit about when they wake up based on
                # changes to objects they're interested in.

                # for now, it is good enough to simply wake up every 100ms and look at the
                # objects in the ODB.
                time.sleep(.1)

                # delete any messages more than 10 seconds old
                with self.db.transaction():
                    # get all the messages
                    messages = Message.lookupAll()

                    for m in messages:
                        if m.timestamp < time.time() - m.lifetime:
                            # this will actually delete the object from the ODB.
                            m.delete()

        @staticmethod
        def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
            # make sure cells has loaded these classes in the database and subscribed
            # to all the objects.
            cells.ensureSubscribedSchema(schema)

            def newMessage():
                # calling the constructor creates a new message object. Even though we
                # orphan it immediately, we can always get it back by calling
                #       Message.lookupAll()
                # because ODB objects have an explicit lifetime (they have to be destroyed)
                Message(timestamp=time.time(), message=editBox.currentText.get(), lifetime=20)

                # reset our edit box so we can type again
                editBox.currentText.set("")

            # define an 'edit box' cell. The user can type into this.
            editBox = cells.SingleLineTextBox(onEnter=lambda newText: newMessage())

            # return the "cell" that models the whole UI. This consists of a panel with
            # an edit box and a button stacked on top of a table showing all the messages
            # that haven't been deleted.
            return cells.Panel(
                editBox >> cells.Button(
                    "New Message",
                    newMessage
                )
            ) + (
                cells.Table(
                    colFun=lambda: ['timestamp', 'lifetime', 'message'],
                    rowFun=lambda: sorted(Message.lookupAll(), key=lambda m: -m.timestamp),
                    headerFun=lambda x: x,
                    rendererFun=lambda m, col: cells.Subscribed(
                        lambda:
                        cells.Timestamp(m.timestamp) if col == 'timestamp' else
                        m.message if col == 'message' else
                        cells.Dropdown(
                            m.lifetime,
                            [1, 2, 5, 10, 20, 60, 300],
                            lambda val: setattr(m, 'lifetime', val)
                        )
                    ),
                    maxRowsPerPage=100,
                    fillHeight=True
                )
            )

then, from within the git repo, run

    # tell object_database_service_config how to authenticate so that it
    export ODB_AUTH_TOKEN=TOKEN

    # install the ActiveWebService, which lets us build a nice web ui
    object_database_service_config install \
        --class object_database.web.ActiveWebService.ActiveWebService \
        --placement Master

    # configure it
    object_database_service_config configure ActiveWebService \
        --port 8080 --hostname localhost --internal-port 8081

    # start it up
    object_database_service_config start ActiveWebService

    # now we should see that its installed
    object_database_service_config list

    # and we should see that there is a running copy of it
    object_database_service_config instances

This has installed the web service. Of course, there's nothing else to
look at yet. Now let's install our service:

    object_database_service_config install \
        --class hello_world.hello_world_service.HelloWorldService \
        --placement Master

This same command will also update the code of the currently running service,
so you can change hello_world_service.py and re-run this to change the
behavior of the system on the fly.

We should now see, in the main ActiveWebService UI, an entry for this new service.
The service is currently not running - if we navigate to the service page
we should be able to type messages for other users to see.  They have a lifetime,
but because the service is not running, there's nothing to delete old messages.

If you run

    object_database_service_config start HelloWorldService

the service should run and clean up behind itself.

If you want to change the behavior of the program or the UI, simply re-run the installation
command after changing the program. The objects in the database will remain the same and
all connected web-clients will rebuild themselves.
