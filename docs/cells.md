### Cells ###

Cells represents an abstraction of the web, tightly coupled with object database, which allows you to create "reactive" interface in python....


### Preamble ###

In order to get ourselves up and running we'll need a few things:

* Object Database installed (see the [installation docs](../INSTALLATION.md) for more details)
* an object_database engine service instance (see [here](./object_engine.md) for more information)
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

object_database_service_config instances
```

(NOTE: you might need to change the paths to the [ServiceBase](https://github.com/APrioriInvestments/object_database/blob/dev/object_database/service_manager/ServiceBase.py) file depending on the directory you are running this from.)

If you head to [http://localhost:8080/services/ServiceBase](http://localhost:8080/services/ServiceBase) you will see our really boring service. The simple text holder card is what [ServiceBase.serviceDisplay](https://github.com/APrioriInvestments/object_database/blob/dev/object_database/service_manager/ServiceBase.py#L67) returns. In the next example, we'll subclass `ServiceBase` and change this method to do something more interesting.


#### Running a more interesting web app ####
