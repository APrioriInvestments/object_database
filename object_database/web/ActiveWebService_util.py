#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.
import traceback

from itertools import chain

from object_database.web.ActiveWebServiceSchema import active_webservice_schema

from object_database.web import cells
from object_database.web.cells import (
    Main,
    Subscribed,
    Traceback,
    Span,
    Button,
    Octicon,
    Tabs,
    Table,
    Clickable,
    Dropdown,
    Popover,
    HeaderBar,
    LargePendingDownloadDisplay,
    PageView,
    HorizontalSequence,
    SplitView,
)

from object_database.web.AuthPlugin import AuthPluginBase

from typed_python import OneOf, TupleOf, ConstDict

from object_database import service_schema, Indexed


@active_webservice_schema.define
class LoginPlugin:
    name = Indexed(str)
    # auth plugin
    login_plugin_factory = object  # factory for LoginPluginInterface objects
    auth_plugins = TupleOf(OneOf(None, AuthPluginBase))
    codebase = OneOf(None, service_schema.Codebase)
    config = ConstDict(str, str)


@active_webservice_schema.define
class Session:
    """Model a single ActiveWebService session runnon on a host somewhere."""

    executingInstance = Indexed(service_schema.ServiceInstance)

    # when the service is active, the port on which it's listening
    listening_port = OneOf(None, int)

    # data about the incoming request
    path = str
    queryArgs = ConstDict(str, str)
    sessionId = str
    user = str
    authorized_groups_text = str


@active_webservice_schema.define
class Configuration:
    service = Indexed(service_schema.Service)

    port = int
    hostname = str

    log_level = int

    login_plugin = OneOf(None, LoginPlugin)


def view():
    buttons = HorizontalSequence(
        [
            Button(
                HorizontalSequence([Octicon("shield", color="green"), Span("Lock ALL")]),
                lambda: [s.lock() for s in service_schema.Service.lookupAll()],
            ),
            Button(
                HorizontalSequence([Octicon("shield", color="orange"), Span("Prepare ALL")]),
                lambda: [s.prepare() for s in service_schema.Service.lookupAll()],
            ),
            Button(
                HorizontalSequence([Octicon("stop", color="red"), Span("Unlock ALL")]),
                lambda: [s.unlock() for s in service_schema.Service.lookupAll()],
            ),
        ],
        margin=1,
    )
    tabs = Tabs(Services=servicesTable(), Hosts=hostsTable())
    return SplitView([(buttons, 1), (tabs, 10)], split="horizontal")


def hostsTable():
    hosts = Table(
        colFun=lambda: [
            "Connection",
            "PlacementGroup",
            "Hostname",
            "RAM ALLOCATION",
            "CORE ALLOCATION",
            "SERVICE COUNT",
            "CPU USE",
            "RAM USE",
        ],
        rowFun=lambda: sorted(
            service_schema.ServiceHost.lookupAll(), key=lambda s: s.hostname
        ),
        headerFun=lambda x: x,
        rendererFun=lambda s, field: Subscribed(lambda: hostsTableDataPrep(s, field)),
        maxRowsPerPage=50,
    )
    return hosts


def hostsTableDataPrep(s, field):
    """Prep data for display in hosts table.

    s : service object
        service data dictionary
    field : str
    """
    if field == "Connection":
        data = s.connection._identity
    elif field == "PlacementGroup":
        data = str(s.placementGroup)
    elif field == "Hostname":
        data = s.hostname
    elif field == "RAM ALLOCATION":
        data = "%.1f / %.1f" % (s.gbRamUsed, s.maxGbRam)
    elif field == "CORE ALLOCATION":
        data = "%s / %s" % (s.coresUsed, s.maxCores)
    elif field == "SERVICE COUNT":
        data = str(len(service_schema.ServiceInstance.lookupAll(host=s)))
    elif field == "CPU USE":
        data = "%2.1f" % (s.cpuUse * 100) + "%"
    elif field == "RAM USE":
        data = ("%2.1f" % s.actualMemoryUseGB) + " GB"
    else:
        data = ""
    return data


def servicesTable():

    serviceCountsChain = chain(
        range(5), range(10, 100, 10), range(100, 400, 25), range(400, 1001, 100)
    )
    serviceCounts = [val for val in serviceCountsChain]

    table = Table(
        colFun=lambda: [
            "Service",
            "Codebase Status",
            "Codebase",
            "Module",
            "Class",
            "Placement",
            "Active",
            "TargetCount",
            "Cores",
            "RAM",
            "Boot Status",
        ],
        rowFun=lambda: sorted(service_schema.Service.lookupAll(), key=lambda s: s.name),
        headerFun=lambda x: x,
        rendererFun=lambda s, field: Subscribed(
            lambda: servicesTableDataPrep(s, field, serviceCounts)
        ),
        maxRowsPerPage=50,
    )
    return table


def __serviceCountSetter(service, ct):
    """Helper function for servicesTableDataPrep. """

    def f():
        service.target_count = ct

    return f


def servicesTableDataPrep(s, field, serviceCounts):
    """Prep data for display in services table.

    s : service object
        service data dictionary
    field : str
    serviceCounts : list of ints
    """

    if field == "Service":
        data = Clickable(s.name, "/services/" + s.name)
    elif field == "Codebase Status":
        data = (
            Clickable(
                HorizontalSequence([Octicon("stop", color="red"), Span("Unlocked")]),
                lambda: s.lock(),
            )
            if s.isUnlocked
            else Clickable(
                HorizontalSequence([Octicon("shield", color="green"), Span("Locked")]),
                lambda: s.prepare(),
            )
            if s.isLocked
            else Clickable(
                HorizontalSequence([Octicon("shield", color="orange"), Span("Prepared")]),
                lambda: s.unlock(),
            )
        )
    elif field == "Codebase":
        data = str(s.codebase) if s.codebase else ""
    elif field == "Module":
        data = s.service_module_name
    elif field == "Class":
        data = s.service_class_name
    elif field == "Placement":
        data = ",".join(s.validPlacementGroups)
    elif field == "Active":
        data = Subscribed(lambda: len(service_schema.ServiceInstance.lookupAll(service=s)))
    elif field == "TargetCount":
        data = Dropdown(
            s.target_count, [(str(ct), __serviceCountSetter(s, ct)) for ct in serviceCounts]
        )
    elif field == "Cores":
        data = str(s.coresUsed)
    elif field == "RAM":
        data = str(s.gbRamUsed)
    elif field == "Boot Status":
        data = (
            Popover(Octicon("alert"), "Failed", Traceback(s.lastFailureReason or "<Unknown>"))
            if s.isThrottled()
            else ""
        )
    else:
        data = ""
    return data


def makeServiceDropdown(services):
    """Creates a dropdown menu of available
    services.

    Parameters
    ----------
    services ServiceSchema - A collection of services

    Returns
    -------
    A Subscribed Cell whose lambda returns
    a dropdown of service items
    """
    return [
        Subscribed(
            lambda: Dropdown(
                "Service",
                [("All", "/services")]
                + [
                    (s.name, "/services/" + s.name)
                    for s in sorted(services.Service.lookupAll(), key=lambda s: s.name)
                ],
            )
        )
    ]


def makeMainHeader(toggles, current_username, authorized_groups_text):
    """Creates the main view's header

    Parameters
    ----------
    toggles - A list of serviceToggles
    current_username str - The name of the current
              user for display
    authorized_groups_text str - Text to display
              about the user's authorized groups

    Returns
    -------
    A HeaderBar Cell configured as the main view's header
    """
    serviceDropdown = makeServiceDropdown(service_schema)
    return HeaderBar(
        serviceDropdown,
        toggles,
        [
            LargePendingDownloadDisplay(),
            Octicon("person") >> Span(current_username),
            Span("Authorized Groups: {}".format(authorized_groups_text)),
            Button(Octicon("sign-out"), "/logout"),
        ],
    )


def makeMainView(display, toggles, current_username, authorized_groups_text):
    """Creates a PageView configured as the
    application's primary view with header etc.

    Parameters
    ----------
    display Cell - The content Cell that will be displayed in the
            Main display area of the view
    toggles list - A list of serviceToggles
    current_username str - The current user's name
    authorized_groups_text str - Text about auth groups for user

    Returns
    -------
    A configured PageView Cell for use as the application's
    primary view container, with configured header
    """
    header = makeMainHeader(toggles, current_username, authorized_groups_text)
    return PageView(Main(display), header=header)


def displayAndHeadersForPathAndQueryArgs(path, queryArgs):
    """ Calls the correct service's display with the right arguments

    Requirements:
        - Must be called from within an ODB view (or transaction)
        - The ODB connection must be subscribed to the service_schema

    Args:
        path: a list of strings constructed from the URL
        query: a dictionary of queries constructed from the URL

    Returns:
        a tuple made of a cell.Cell and a list of toggles for the
        appropriate rervice

    Raises: SubscribeAndRetry if the odb connection is not subscribed
        to the schema of the typeObj (c.f., call to
        cells.ensureSubscribedSchema)
    """

    if len(path) and path[0] == "services":
        if len(path) == 1:
            return view(), []

        serviceObj = service_schema.Service.lookupAny(name=path[1])

        if serviceObj is None:
            return Traceback("Unknown service %s" % path[1]), []

        serviceType = serviceObj.instantiateServiceType()

        serviceToggles = serviceType.serviceHeaderToggles(serviceObj)

        if len(path) == 2:
            return (
                Subscribed(
                    lambda: serviceType.serviceDisplay(serviceObj, queryArgs=queryArgs)
                ),
                serviceToggles,
            )

        typename = path[2]

        schemas = serviceObj.findModuleSchemas()
        typeObj = None
        for s in schemas:
            typeObj = s.lookupFullyQualifiedTypeByName(typename)
            if typeObj:
                cells.ensureSubscribedSchema(s)
                break

        if typeObj is None:
            return Traceback("Can't find fully-qualified type %s" % typename), []

        if len(path) == 3:
            return (
                serviceType.serviceDisplay(serviceObj, objType=typename, queryArgs=queryArgs),
                serviceToggles,
            )

        try:
            identity = int(path[3])
        except ValueError as e:
            return (
                Traceback(f"Invalid object ID {path[3]}: {e}:\n{traceback.format_exc()}"),
                [],
            )

        instance = typeObj.fromIdentity(identity)
        if instance.exists():
            return (
                serviceType.serviceDisplay(serviceObj, instance=instance, queryArgs=queryArgs),
                serviceToggles,
            )

        else:
            return (
                Traceback(
                    f"Invalid instance ID {instance._identity} for type {typename}: "
                    "Instance does not exist"
                ),
                [],
            )

    return Traceback("Invalid url path: %s" % path), []
