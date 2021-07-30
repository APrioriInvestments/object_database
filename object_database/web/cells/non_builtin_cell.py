from object_database.web.cells.cell import Cell


class NonBuiltinCell(Cell):
    """Base class for all cells that are not built into the core javascript.

    These cells are 'dynamically defined' which means we send javascript and CSS to support
    them.
    """

    @classmethod
    def isBuiltinCell(cls):
        return False

    @classmethod
    def getDefinitionalJavascript(cls):
        """Return the javascript source for the class object that our cells contain.

        This function should return javascript source code for a function that takes
        'Cell' and 'ComponentRegistry' as arguments and installs new cell handlers
        into 'ComponentRegistry'.

        This code will execute execute exactly once per distinct cell that gets used,
        in the order in which the cell is first encountered in the cells tree.
        """
        raise NotImplementedError()

    @classmethod
    def getCssRules(cls):
        """Return a collection of CSS rules that need to be active for this cell."""
        raise NotImplementedError()
