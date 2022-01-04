from .sort_wrapper import SortWrapper as SW
from .leaves import Octicon, Text


def test_int_float():
    assert SW(1) < 2
    assert SW(1.0) < 2.0
    assert SW(1) < 2.0
    assert SW(1.0) < 2

    assert not SW(1) < 1
    assert not SW(1.0) < 1.0
    assert not SW(1) < 1.0
    assert not SW(1.0) < 1

    assert SW(1) == 1
    assert SW(1.0) == 1.0
    assert SW(1) == 1.0
    assert SW(1.0) == 1

    assert SW(1) != 2
    assert SW(1.0) != 2.0
    assert SW(1) != 2.0
    assert SW(1.0) != 2

    assert SW("1") != 2
    assert SW(2.0) < "1"
    assert SW(2) < "1"


def test_cells():
    flameO = Octicon("flame")
    flameO2 = Octicon("flame")
    stopO = Octicon("stop")
    shieldO = Octicon("shield")

    assert flameO is not flameO2
    assert SW(flameO) == flameO2
    assert SW(flameO) != stopO
    assert SW(stopO) != shieldO
    assert SW(shieldO) != flameO

    assert SW(flameO) < shieldO
    assert SW(shieldO) < stopO
    assert SW(stopO) != flameO
    assert not SW(stopO) <= flameO
    assert SW(stopO) > flameO
    assert SW(stopO) >= flameO

    textAsdf = Text("asdf")
    textQwer = Text("qwer")

    assert SW(stopO) < textAsdf
    assert SW(textAsdf) < SW(textQwer)
