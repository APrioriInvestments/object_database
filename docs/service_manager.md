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

### Task Services

A special pair of services is responsible for distributed task execution in odb.
[TaskDispatchService](../object_database/service_manager/Task.py) manages TaskWorkers and subscribes to changes in TaskStatus.
New tasks are assigned to workers round-robin. The tasks are executed by the 
[TaskService](../object_database/service_manager/Task.py). This service instantiates the 
codebase configured in the task, executes each subtask, and updates the TaskStatus.

### Task

Each [Task](../object_database/service_manager/Task.py) is represented an odb object that
contains the required attributes to execute the task.

The core task logic is represented by a `RunningTask` subclass that is instantiated by the
Task's `TaskExecutor` subclass (e.g., a `FunctionTask` simply runs a single function). During
execution, the `TaskContext` containing the db, storage, and the codebase is passed into the executor.

Subtasks are defined as Tasks with a parent Task. TaskStatus is separately updated for each subtask.
The parent task is reset to Unassigned status when all subtasks are DoneCalculating.


### TaskStatus

Unassigned - newly created task that is not associated with a task worker
Assigned - task is associated with a worker but the worker has not begun working on it
Working - when a worker picks up a task and starts to `doTask` on it.
WaitForSubtasks - the parent task is put into this state then subtasks are instantiated.
Sleeping - when a task is explicitly put on pause
Collected - when a subtask is DoneCalculating and has incremented the parent task's subtask completion, then the child task is considered "Collected".
DoneCalculating - the task is finished and the results updated without revision conflicts

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

