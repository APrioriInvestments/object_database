### Cells ###

Cells represents an abstraction of the web, tightly coupled with object database, which allows you to create "reactive" interface in python....


### Preamble ###

In order to get ourselves up and running we'll need a few things:

* Object Database installed (see the [installation docs](../INSTALLATION.md) for more details)
* an object_database engine service instance (see [here](./object_engine.md) for more information)
* build the bundle for the services landing page
  * `cd object_database/object_database/web/content`
  * create a node environment and source it
  * run `npm install && npm run build`
* a configured and installed web service instance, which will be responsible for building and serving the web application
* and an installed instance of the service we'd like to run

After this we can start up our web server and service.

Lets walk through it (as in the other examples we'll use "TOKEN" for our special token):

In a python virtual environment boot up Object Database engine like so:
```
  object_database_service_manager \
        localhost \
        localhost \
        8000 \
        Master \
        --run_db \
        --service-token TOKEN \
        --source ./odb/source \
        --storage ./odb/storage
```

In another python virtual environment instance run the following:
```
# export our special Object Database token
export ODB_AUTH_TOKEN=TOKEN

# install the ActiveWebService
object_database_service_config install \
--class object_database.web.ActiveWebService.ActiveWebService \
--placement Master

# configure ActiveWebService
object_database_service_config configure ActiveWebService \
--port 8080 --hostname localhost --internal-port 8081

# check to make sure it is listed
object_database_service_config list

# start it up
object_database_service_config start ActiveWebService

# check to see that it is running
object_database_service_config instances
```

NOTE: you can always open [http://localhost:8080/](http://localhost:8080/) in your browser to see the running services and click to see what they are. Also, if you get tired of running the above commands, there is a small bash script found [here](./examples/aws_start.sh).

#### Running a boring web app ####

Run the following in your virtual environment:

```
object_database_service_config install --class object_database.service_manager.ServiceBase.ServiceBase --placement Master
# check to see it is installed
object_database_service_config list
# start
object_database_service_config start ServiceBase
# check to see it is running
object_database_service_config instances
```

(NOTE: you might need to change the paths to the [ServiceBase](https://github.com/APrioriInvestments/object_database/blob/dev/object_database/service_manager/ServiceBase.py) file depending on the directory you are running this from.)

If you head to [http://localhost:8080/services/ServiceBase](http://localhost:8080/services/ServiceBase) you will see our really boring service. The simple text holder card is what [ServiceBase.serviceDisplay](https://github.com/APrioriInvestments/object_database/blob/dev/object_database/service_manager/ServiceBase.py#L67) returns. In the next example, we'll subclass `ServiceBase` and change this method to do something more interesting.


#### Running a more interesting web app ####

Take a look at [cells.py]('./examples/cells.py'). You'll see we made a subclass of `ServiceBase` and overrode its `.serviceDisplay` method. There is card with a header and some buttons which all route you to the corresponding URI (in our case the list of services we have running), plus a little bit of styling. 

Lets install our more interesting app like above:
```
object_database_service_config install --class docs.examples.cells.SomethingMoreInteresting --placement Master
object_database_service_config start SomethingMoreInteresting
```

Note: when you make changes to `SomethingMoreInteresting` you need to reinstall it, with the above command. If you see a message like `Cannot set codebase of locked service 'SomethingMoreInteresting'` then click the "Locked" icon in [http://localhost:8080/services]([http://localhost:8080/services) to unlock it, then reinstall.


You can learn more about cells by perusing the [cells](https://github.com/APrioriInvestments/object_database/tree/dev/object_database/web/cells) directory or taking a look at the [cells test example](https://github.com/APrioriInvestments/object_database/blob/dev/object_database/web/CellsTestService.py#L63)

#### Running an ODB web app ####

But before we wrap up, we should really build a cells examples which works with Object Database, since that's the main point here.

I am going to skip over details of how ODB works. Please here [here](https://github.com/APrioriInvestments/object_database/blob/dev/docs/object_engine.md) for an introduction. 

We'll be building an `AnODBService` which you can find [here](https://github.com/APrioriInvestments/object_database/blob/daniel-examples/docs/examples/cells_odb.py). You'll see we need to define 
* a [schema](https://github.com/APrioriInvestments/object_database/blob/daniel-examples/docs/examples/cells_odb.py#L12)
* how our app will [interact with ODB](https://github.com/APrioriInvestments/object_database/blob/daniel-examples/docs/examples/cells_odb.py#L23)
* and the [UI](https://github.com/APrioriInvestments/object_database/blob/daniel-examples/docs/examples/cells_odb.py#L40) for the app itself. 

The app will send and recieve messages from the database, and update the UI which consists largely of a Panel and Table cell. The key departure here from the previous examples is the lambda functions passed to the cells. Instead of returning something like a string (which then tells the service to route to the correponding URI), these interact with the DB via the `Message` class. 

As before we'll need to install and start the service:
Lets install our more interesting app like above:
```
object_database_service_config install --class docs.examples.cells_db.AnODBService --placement Master
object_database_service_config start AnODBService
```

We'll learn more about cells and how to develop them in the upcoming `cells_dev.md` doc. 


#### ODB Cells Playground ####

ODB provides a playground where you can explore and see examples of various cells in action. Running `object_database_webtest` and then heading to [http://localhost:8000/services](http://localhost:8000) you will see a cells test service. If you update the code in the editor and press ctrl-n-enter the cell will refresh in the browser. This is one of the better way to explore cells. 
