import pytest

from object_database import service_schema
from object_database.service_manager.ServiceManager import ServiceManager
from object_database.web import cells
from object_database.service_manager.ServiceManager_test import HappyService, happy
from .ActiveWebService_util import displayAndHeadersForPathAndQueryArgs


def test_displayAndHeadersForPathAndQueryArgs(in_mem_odb_connection):
    db = in_mem_odb_connection
    db.subscribeToSchema(service_schema)

    # path = []: expect a cells.Traceback
    res = displayAndHeadersForPathAndQueryArgs([], {})
    assert isinstance(res[0], cells.Traceback)
    assert res[1] == []

    # path = ["services"]: check we don't crash
    res = displayAndHeadersForPathAndQueryArgs(["services"], {})
    assert not isinstance(res[0], cells.Traceback)
    assert res[1] == []

    # path = ["services", "BogusService"]: expect a cells.Traceback
    with db.view():
        res = displayAndHeadersForPathAndQueryArgs(["services", "BogusService"], {})
        assert isinstance(res[0], cells.Traceback)
        assert res[1] == []

    # path = ["services", "HappyService"]: check we don't crash
    with db.transaction():
        ServiceManager.createOrUpdateService(HappyService, "HappyService", target_count=1)

    with db.view():
        res = displayAndHeadersForPathAndQueryArgs(["services", "HappyService"], {})
        assert not isinstance(res[0], cells.Traceback)
        assert res[1] == []  # HappyService has no toggles

    # path = ["services", "HappyService", "BogusType"]
    with db.view():
        res = displayAndHeadersForPathAndQueryArgs(
            ["services", "HappyService", "BogusType"], {}
        )
        assert isinstance(res[0], cells.Traceback)
        assert res[1] == []  # HappyService has no toggles

    # path = ["services", "HappyService",  happyType]
    happyType = f"{happy.name}.{happy.Happy.__name__}"

    # we are not subscribed to happy so we expect to fail with SubscribeAndRetry
    with pytest.raises(cells.SubscribeAndRetry) as excinfo:
        with db.view():
            res = displayAndHeadersForPathAndQueryArgs(
                ["services", "HappyService", happyType], {}
            )

    # Performing the subscription that was required and retrying resolves the problem.
    subscribeAndRetryException = excinfo.value
    subscribeAndRetryException.callback(db)
    with db.view():
        res = displayAndHeadersForPathAndQueryArgs(["services", "HappyService", happyType], {})
        assert not isinstance(res[0], cells.Traceback)
        assert res[1] == []  # HappyService has no toggles

    # path = ["services", "HappyService", happyType, "not an int"]: cannot convert to int
    with db.view():
        res = displayAndHeadersForPathAndQueryArgs(
            ["services", "HappyService", happyType, "not an int"], {}
        )
        assert isinstance(res[0], cells.Traceback)
        assert res[1] == []

    # path = ["services", "HappyService", happyType, "0"] (invalid instance ID)
    with db.view():
        res = displayAndHeadersForPathAndQueryArgs(
            ["services", "HappyService", happyType, "0"], {}
        )
        assert isinstance(res[0], cells.Traceback)
        assert res[1] == []

    # path = ["services", "HappyService", happyType, "1"] (valid instance ID)
    with db.transaction():
        instance = happy.Happy()

    with db.view():
        res = displayAndHeadersForPathAndQueryArgs(
            ["services", "HappyService", happyType, str(instance._identity)], {}
        )
        assert not isinstance(res[0], cells.Traceback)
        assert res[1] == []
