# Defining and Managing Object Database Services

Object Database (ODB) service framework is defined and managed in
[the service_manager package](../object_database/service_manager)

## Services

ODB services extends `object_database.service_manager.ServiceBase.Servicebase`.
The [ServiceBase](../object_database/service_manager/ServiceBase.py) super class
manages configurations, resources, introspection, and start/stop/setup/teardown.

ODB comes with a set of default services for convenience and testing purposes.
 - [AwsWorkerBootService](../object_database/service_manager/aws/AwsWorkerBootService.py)
manages launching and shutdown of AWS ec2 instances.
 - [ActiveWebService](../object_database/web/ActiveWebService.py) launches a sockets/Cells-based reactive web service
 - [CellsTestService](../object_database/web/CellsTestService.py) tests display and navigation of cells.

## Service Managers

Services are created using `ServiceManager` and managed as
[Service](../object_database/service_manager/ServiceInstance.py) odb objects,
which stores configuration and stats and is associated with a particular
[Codebase](../object_database/service_manager/Codebase.py) that corresponds with a particular ServiceBase subclass defined in a
particular git ref.

ServiceManager can be subclassed to use different strategies for launching / managing
ServiceWorkers. [SubprocessServiceManager](../object_database/service_manager/SubprocessServiceManager.py)
uses subprocesses to launch workers. [InProcessServiceManager](../object_database/service_manager/InProcessServiceManager.py)
manages workers within the same python process as itself.

## Instances and workers

A given Service can have multiple
[ServiceInstance's](../object_database/service_manager/ServiceInstance.py) running on
different `ServiceHost`'s. The ServiceManager uses a separate
[ServiceWorker](../object_database/service_manager/ServiceWorker.py) to
(possibly asynchronously) instantiate, launch, and manage each ServiceInstance.

