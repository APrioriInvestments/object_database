## Active Web Service startup script

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
