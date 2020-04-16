"""Messenger: module for formatting Cells socket messages

All messages that are sent over the socket to the UI
should be formatted using functions in this module
"""


def cellUpdated(cell):
    if cell.isMergedIntoParent():
        # check that we're not sending a merged cell over the wire. When we nest
        # two Sequences, for example, we don't actually render the inner one - we rely
        # on the cells to flatten themselves.
        raise Exception(
            f"Cell {cell} was merged into its parent. and shouldn't be sent over the wire."
        )

    structure = getUpdateStructure(cell)

    envelope = {
        "channel": "#main",
        "type": "#cellUpdated",
        "shouldDisplay": cell.shouldDisplay,
        "extraData": cell.getDisplayExportData(),
    }

    structure.update(envelope)
    if cell.postscript:
        structure["postscript"] = cell.postscript

    return structure


def cellDataUpdated(cell):
    """Message of this type reflect updated data in the cells. For example,
    Sheet (table) data pagination.
    """
    # TODO update this
    data = {
        "channel": "#main",
        "type": "#cellDataUpdated",
        "shouldDisplay": cell.shouldDisplay,
        "id": cell.identity,
        "dataInfo": cell.exportData["dataInfo"],
    }
    return data


def cellDataRequested(cell):
    """Message of this type requests data from the client.
    """
    data = {
        "channel": "#main",
        "type": "#cellDataRequested",
        "id": cell.identity,
        "dataInfo": cell.exportData["dataInfo"],
    }
    return data


def cellDiscarded(cell):
    """A lifecycle message formatter
    to be used when a Cell is discarded
    and removed from the session.

    Parameters
    ----------
    cell: Cell
          The Cell instance that is being discarded

    Returns
    -------
    A JSON parsable dictionary that can
    be sent over a websocket
    """
    return {
        "channel": "#main",
        "type": "#cellDiscarded",
        "cellType": cell.__class__.__name__,
        "id": cell.identity,
    }


def cellsDiscarded(aListOfCells):
    """A lifecycle message formatter
    to be used when a collection of Cells
    are all marked to be discarded and
    removed from the session

    Parameters
    ----------
    aListOfCells: list(Cell)
        The collection of Cell
        instances marked for
        removal

    Returns
    -------
    A JSON parsable dictionary that
    can be sent over a websocket
    """
    return {
        "channel": "#main",
        "type": "#cellsDiscarded",
        "ids": [cell.identity for cell in aListOfCells],
    }


def appendPostscript(jsString):
    """A lifecycle message formatter
    to be used when we are appending a
    postscript just by itself

    Parameters
    ----------
    jsString: str
              An appropriately escaped string
              of Javascript to append to the
              current postscripts in the UI

    Returns
    -------
    A JSON parsable dictionary that can
    be sent over a websocket
    """
    return {"channel": "#main", "type": "#appendPostscript", "script": jsString}


def getStructure(parent_id, cell, name_in_parent, expand=False):
    """Responds with a dict structure representative of the
    passed in cell that will be suitable for JSON parsing.

    Notes
    -----
    There are two ways to use this function: expanded
    or not.
    Expanded will return a recursive dict structure where
    each named child is represented also as a complete dict
    along with all of its own namedChildren, and so on.
    Unexpanded will return just the given Cell's structure,
    and it's namedChildren structure will all resolve to
    Cell IDs (rather than expanded dicts)

    Parameters
    ----------
    parent_id: str|integer
        The Cell identity of the passed-in Cell's parent
    cell: Cell
        The target Cell whose structure we will map to
        a dictionary.
    name_in_parent: str
        If the passed-in Cell is a namedChild of another cell,
        we provide that name as this argument
    expand: boolean
        Whether or not to return an 'expanded' dictionary
        meaning all named children of the current cell will
        also have their own dict structures parsed out.
        See the Notes above.
        Defaults to False

    Returns
    -------
    dict: A dictionary representing the Cell structure,
          expanded or otherwise, that can be parsed
          into JSON
    """
    if expand:
        return _getExpandedStructure(parent_id, cell, name_in_parent)
    return _getFlatStructure(parent_id, cell, name_in_parent)


"""Helper Functions"""


def _getFlatStructure(parent_id, cell, name_in_parent):
    own_children = _getFlatChildren(cell)
    return {
        "id": cell.identity,
        "cellType": cell.__class__.__name__,
        "nameInParent": name_in_parent,
        "parentId": parent_id,
        "namedChildren": own_children,
        "extraData": cell.getDisplayExportData(),
    }


def _getFlatChildren(cell):
    own_children = {}
    for child_name, child in cell.getDisplayChildren().items():
        own_children[child_name] = _resolveFlatChild(child)

    return own_children


def _resolveFlatChild(cell_or_list):
    if isinstance(cell_or_list, list):
        return [_resolveFlatChild(cell) for cell in cell_or_list]
    return cell_or_list.identity


def _getExpandedStructure(parent_id, cell, name_in_parent):
    if cell is None:
        return None
    own_children = _getExpandedChildren(cell)
    return {
        "id": cell.identity,
        "cellType": cell.__class__.__name__,
        "extraData": cell.getDisplayExportData(),
        "nameInParent": name_in_parent,
        "parentId": parent_id,
        "namedChildren": own_children,
    }


def _getExpandedChildren(cell):
    own_children = {}
    for child_name, child in cell.getDisplayChildren().items():
        own_children[child_name] = _resolveExpandedChild(cell.identity, child, child_name)
    return own_children


def _resolveExpandedChild(parent_id, cell_or_list, name_in_parent):
    if isinstance(cell_or_list, list):
        return [
            _resolveExpandedChild(parent_id, cell, name_in_parent) for cell in cell_or_list
        ]
    """
    if cell_or_list.__class__.__name__ == "Subscribed":
        next_child = cell_or_list.children["content"]
        return _resolveExpandedChild(parent_id, next_child, name_in_parent)
    """

    return _getExpandedStructure(parent_id, cell_or_list, name_in_parent)


"""New Update Structure Helpers"""


def getUpdateStructure(cell):
    children = cell.getDisplayChildren()
    parent_id = None
    name_in_parent = None
    if cell.parent:
        parent_id = cell.parent.identity
        name_in_parent = cell.parent.children.findNameFor(cell)

    own_children = {}
    for child_name, child in children.items():
        own_children[child_name] = _resolveUpdateChild(child_name, child, cell)

    structure = {
        "id": cell.identity,
        "cellType": cell.__class__.__name__,
        "nameInParent": name_in_parent,
        "parentId": parent_id,
        "namedChildren": own_children,
        "extraData": cell.getDisplayExportData(),
    }

    return structure


def _resolveUpdateChild(name_in_parent, child_or_list, parent_cell):
    if isinstance(child_or_list, list):
        return [
            _resolveUpdateChild(name_in_parent, next_child, parent_cell)
            for next_child in child_or_list
        ]

    # If the child is a Subscribed, we attempt to
    # "see through" it by moving onto its content
    """
    if child_or_list.__class__.__name__ == "Subscribed":
        next_child = child_or_list.children["content"]
        return _resolveUpdateChild(name_in_parent, next_child, parent_cell)
    """

    # If the child was just created, recursively grab
    # the whole subtree for it
    if child_or_list.wasCreated:
        return _getExpandedStructure(parent_cell.identity, child_or_list, name_in_parent)

    # If the child was updated this same cycle,
    # recursively add an abbreviated subtree for it
    if child_or_list.wasUpdated:
        return getUpdateStructure(child_or_list)

    # Otherwise we just return an id
    return child_or_list.identity
