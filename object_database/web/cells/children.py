#   Copyright 2017-2019 Nativepython Authors
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


class Children:
    """A 'Collection-Like' object that holds Cell child references.

    By 'Collection-like' we mean that this object maintains
    some polymorphism with collections like Dictionaries and
    Lists.

    Children maintains an internal dictionary that maps child
    names to either a Cell instance, a list of Cell instances,
    or an n-dimensional (list of list, etc) of Cell instances.
    For the purposes of recalculation and rendering, it also
    maintains a flat list of all contained Cell instance children
    regardless of what name they appear under in the current dict.

    Convenience methods for adding and removing maintain the
    integrity of both the flat list and the internal dict.

    Overrides like `__setitem__` etc simply wrap the explicit
    convenience methods in more list/dictionary like syntax.

    Properties
    ----------
    namedChildren: dict
        A dictionary that maps unique names to
        a Cell instance, a list of Cell instances,
        or an n-dimensional (list of list, etc)
        list of Cell instances
    allChildren: list
        A flat list of all child Cell instances,
        regardless of their place in namedChildren
    _reverseLookup: dict
        A dictionary that maps Cell instances to
        the key where the instance appears in
        namedChildren. Used for reverse lookups.
    """

    def __init__(self):
        self.namedChildren = {}
        self.allChildren = []
        self._reverseLookup = {}

    def addChildNamed(self, name, childStructure):
        """Adds a child with the given name.

        If the name is already set in the internal
        dictionary, we call `removeChildNamed first.

        We use a recursive call to `_addChildstructure` in
        order to deal with multi-dimensional values.

        Notes
        -----
        Using helper functions, this method will:
        * Add the structure to the internal dict
        * Add any encountered Cell instance child
          to the reverse lookup dictionary
        * Add any incoming Cell instance to the
          flat list of all children

        Parameters
        ----------
        name: str
            The name to give the child, which can be referenced
            later
        childStructure: (Cell || list || list(list))
            A Cell instance, list of Cell instances, or
            n-dimensional (list of list, etc) list of
            Cell instances
        """
        if name in self.namedChildren:
            self.removeChildNamed(name)

        if childStructure is None:
            return

        self.namedChildren[name] = self._addChildStructure(childStructure, name)

    def addFromDict(self, childrenDict):
        """Adds all elements from an incoming dict.

        Will overwrite any existing entries, which
        is normal behavior for `addChildNamed`.

        Parameters
        ----------
        childrenDict: dict
            A dictionary mapping names to children.
        """
        for key, val in childrenDict.items():
            self[key] = val

    def removeChildNamed(self, name):
        """Removes the child or child structure of the given name.

        If there is no child with the given name, it
        will return False. Likewise, if removal fails
        for some reason, it will also return False.

        Makes a recursive call to `_removechildStructure`
        in order to deal with the possibility of
        multidimensional child structures.

        Notes
        -----
        Using helper functions, this method will:
        * Remove the given entry from the internal dict
        * Remove the removed Cell instances from the
          reverse lookup dictionary
        * Remove the removed Cell instances from the
          flat list of children (`allChildren`)

        Parameters
        ----------
        name: str
            The key to lookup for which all children
            should be removed.
        """
        if name not in self.namedChildren:
            return False
        found = self.namedChildren[name]
        success = self._removeChildStructure(found)
        if not success:
            return False
        del self.namedChildren[name]
        return True

    def removeAll(self):
        """Removes all children and child structures.
        """
        self.namedChildren = {}
        self.allChildren = []

    def dimensionsForChildNamed(self, name):
        """Returns the number of dimensions for a named entry.

        Notes
        -----
        Some named children are lists of Cells or n-dimension
        nested (ie list of list of list etc) of Cells. This
        method will return the number of dimensions for a given
        child entry in the Children collection.

        Parameters
        ----------
        name: str
            The key name of the child.

        Returns
        -------
        int: The number of dimensions
        """
        found = self.namedChildren[name]
        return self._getDimensions(found)

    def hasChild(self, child):
        """Returns true if child Cell is in this Children.

        Parameters
        ----------
        child: Cell
            The child Cell instance to look for.

        Returns
        -------
        Boolean: True if the Cell is a child present in this
            Children.
        """
        return child in self.allChildren

    def hasChildNamed(self, name):
        """Returns True if this instance has a child with the name.

        Parameters
        ----------
        name: str
            The name of the child (key) to lookup.

        Returns
        -------
        Boolean: True if the name is in the internal dict
            (and therefore child is present)
        """
        return name in self.namedChildren

    def findNameFor(self, child):
        """Returns the name for a given child Cell, if present.

        Parameters
        ----------
        child: Cell
            A Cell instance to lookup

        Returns
        -------
        str | None: Returns the string of the name (key)
            where the instance resides in the internal dict,
            or None if it is not found.
        """
        if child in self._reverseLookup:
            return self._reverseLookup[child]
        return None

    def items(self):
        """Wrapper for internal dict's `items()` method"""
        return self.namedChildren.items()

    def _getDimensions(self, item, dimensions=0):
        """Recursively counts the num of dimensions
        for a multidimensional child structure.
        """
        if isinstance(item, list):
            return self._getDimensions(item[0], dimensions + 1)
        return dimensions

    def _removeChildStructure(self, structure):
        """Recursively iterates through a possible
        multidimensional child structure, removing any found
        Cell instances to the various internal collections.
        """
        if isinstance(structure, list):
            return [self._removeChildStructure(s) for s in structure]
        else:
            self.allChildren.remove(structure)
            del self._reverseLookup[structure]
            return True

    def _addChildStructure(self, structure, name):
        """Recursively iterates through a possible
        multidimensional child structure, adding any found
        Cell instances to the various internal collections.
        """
        if isinstance(structure, list):
            return [self._addChildStructure(item, name) for item in structure]
        else:
            self.allChildren.append(structure)
            self._reverseLookup[structure] = name
            return structure

    def __contains__(self, key):
        return key in self.namedChildren

    def __getitem__(self, key):
        """Override that wraps access to namedChildren"""
        return self.namedChildren[key]

    def __setitem__(self, key, value):
        """Override that wraps `addChildNamed`"""
        self.addChildNamed(key, value)

    def __delitem__(self, key):
        """Override that wraps `removeChildNamed`"""
        if key in self.namedChildren:
            self.removeChildNamed(key)
