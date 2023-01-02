from object_database.schema import Schema

core_schema = Schema("core")


@core_schema.define
class Connection:
    # if nonempty, then lack of heartbeats _dont_ kill this
    # process. This is necessary if you want to attach a debugger
    # and not have the process die
    heartbeats_suspended = bool
