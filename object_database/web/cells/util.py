#   Copyright 2017-2019 object_database Authors
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

import time

from object_database.web.cells import Cells


def waitForCellsCondition(cells: Cells, condition, timeout=10.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        condRes = condition()

        if not condRes:
            time.sleep(0.1)
            cells.renderMessages()
        else:
            return condRes

    exceptions = cells.childrenWithExceptions()
    if exceptions:
        raise Exception("\n\n".join([e.childByIndex(0).contents for e in exceptions]))

    return None


class CellDecorator(object):
    """ A Cell -> Cell function that can be applied with the '*' operator. """

    def __init__(self, cellFunction, name):
        self.cellFunction = cellFunction
        self.name = name

    def __mul__(self, aCell):
        return aCell.applyCellDecorator(self.cellFunction)

    def __str__(self):
        return self.name


def ShrinkWrap(aCell):
    """Cell modifier function
    that marks the cell as shrinkwrapped.

    Parameters
    ----------
    aCell: Cell
        The Cell instance that will be marked
        as shrinkwrapped (for frontend)

    Returns
    -------
    The modified Cell instance
    """
    aCell.isShrinkWrapped = True
    aCell.exportData["shrinkwrap"] = True
    return aCell


def Flex(aCell):
    """Cell modifier function
    that marks the cell as flexed.

    Parameters
    ----------
    aCell: Cell
        The Cell instance that will be marked
        as flexed (for frontend)

    Returns
    -------
    The modified Cell instance
    """
    aCell.isFlex = True
    aCell.exportData["flexChild"] = True
    return aCell


def CustomInset(aCell, kind="padding", top=None, right=None, bottom=None, left=None):
    """Cell modifier function that sets
    insets across varying dimensions of
    the visible Cell component.

    Notes
    -----
    This convenience function is designed to
    be used by simpler helper functions like
    `Padding()` and `Margin()`.
    However, consumers can use it directly
    in order to provide very specific
    insets on the given sides.

    Parameters
    ----------
    aCell: Cell
        The Cell instance whose resulting
        visual component will be given inset
        values on the desired dimension(s)
    kind: str
        Whether the inset is `padding` or
        `margin`. Defaults to `padding`
    top: integer
        The number of pixels of the inset
        (specified by `kind`) at the top
        dimension. Defaults to None.
    right: integer
        The number of pixels of the inset
        (specified by `kind`) at the right
        dimension. Defaults to None.
    bottom: integer
        The number of pixels of the inset
        (specified by `kind`) at the bottom
        dimension. Defaults to None.
    left: integer
        The number of pixels of the inset
        (specified by `kind`) at the left
        dimension. Defaults to None.
    """
    dimensions = {"top": top, "right": right, "bottom": bottom, "left": left}

    if "customStyle" not in aCell.exportData:
        aCell.exportData["customStyle"] = {}

    assert kind in ["padding", "margin"], "Inset kind must be 'padding' or 'margin'"

    # Check if all values are the same.
    # If so, we only set the global inset
    # value instead of doing so by dimension
    vals = set(dimensions.values())
    if len(vals) == 1:
        inset_val = "{}px".format(list(vals)[0])
        aCell.exportData["customStyle"][kind] = inset_val
    # Otherwise we set the value
    # on a per-dimension basis
    else:
        for dimension, val in dimensions.items():
            inset_val = "{}px".format(val)
            inset_name = "{}-{}".format(kind, dimension)
            aCell.exportData["customStyle"][inset_name] = inset_val

    return aCell


def Padding(amount, cell=None):
    """Cell modifier function that
    adds Padding on all dimensions
    to the resulting Cell component.

    Parameters
    ----------
    amount: integer
        The number of pixels in padding
        on all sides that the resulting
        cell's component will display with
    cell: Cell
        The Cell instance that will be
        modified. If 'None', then return a
        'CellDecorator' instead.

    Returns
    -------
    A modified Cell instance
    """
    if cell is None:
        return CellDecorator(lambda cell: Padding(amount, cell), f"Padding({amount})")

    return CustomInset(cell, "padding", top=amount, right=amount, bottom=amount, left=amount)


def PaddingDimension(amount, direction, cell=None):
    assert direction in [
        "top",
        "right",
        "left",
        "bottom",
    ], f"Padding dimension error: {direction}"
    if cell is None:
        return CellDecorator(
            lambda cell: PaddingDimension(amount, direction, cell),
            f"PaddingDimension({amount}, {direction})",
        )
    dimensions = {"top": 0, "right": 0, "bottom": 0, "left": 0}
    dimensions[direction] = amount
    return CustomInset(cell, "padding", **dimensions)


def PaddingRight(amount, cell=None):
    return PaddingDimension(amount, "right", cell)


def PaddingLeft(amount, cell=None):
    return PaddingDimension(amount, "left", cell)


def Margin(amount, cell=None):
    """Cell modifier function that
    adds Margin on all dimensions
    to the resulting Cell component.

    Parameters
    ----------
    amount: integer
        The number of pixels in margin
        on all sides that the resulting
        cell's component will display with
    cell: Cell
        The Cell instance that will be
        modified. If None, then return a
        CellDecorator.

    Returns
    -------
    A modified Cell instance
    """
    if cell is None:
        return CellDecorator(lambda cell: Margin(amount, cell), f"Margin({amount})")

    return CustomInset(cell, "margin", top=amount, right=amount, bottom=amount, left=amount)


def MarginRight(amount, cell=None):
    """Cell modifier function that
    will add Margin on the right side
    of the resulting Cellc component.

    Parameters
    ----------
    amount: integer
        The number of pixels in margin
        that will be added to the right
        side of the resulting Cell's
        component
    cell: Cell
        The Cell instance that will be
        modified. If None, then returns
        a CellDecorator

    Returns
    -------
    A modified Cell instance or
        CellDecorator instance
    """
    if cell is None:
        return CellDecorator(lambda cell: MarginSides(amount, cell), f"MarginRight({amount})")

    return CustomInset(cell, "margin", top=0, right=amount, bottom=0, left=0)


def MarginLeft(amount, cell=None):
    """Cell modifier function that
    will add Margin on the left side
    of the resulting Cell component.

    Parameters
    ----------
    amount: integer
        The number of pixels in margin
        that will be added to the left
        side of the resulting Cell's
        component
    cell: Cell
        The Cell instance that will be
        modified. If None, then returns
        a CellDecorator

    Returns
    -------
    A modified Cell instance or
        CellDecorator instance
    """
    if cell is None:
        return CellDecorator(lambda cell: MarginSides(amount, cell), f"MarginRight({amount})")

    return CustomInset(cell, "margin", top=0, right=0, bottom=0, left=amount)


def MarginSides(amount, cell=None):
    """Cell modifier function that
    will add Margin on the left and right
    sides to the resulting Cell component.

    Parameters
    ----------
    amount: integer
        The number of pxels in margin
        that will be on the left and
        right sides of the resulting
        Cell's component
    cell: Cell
        The Cell instance that will be
        modified. If None, then return
        a CellDecorator

    Returns
    -------
    A modified Cell instance or CellDecorator
    """
    if cell is None:
        return CellDecorator(lambda cell: MarginSides(amount, cell), f"MarginSides({amount})")

    return CustomInset(cell, "margin", top=0, right=amount, bottom=0, left=amount)
