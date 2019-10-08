class Children():
    def __init__(self, parent=None):
        self.namedChildren = {}
        self.allChildren = []
        self.parent = parent
        self._reverseLookup = {}


    def addChildNamed(self, name, childStructure):
        if name in self.namedChildren:
            self.removeChildNamed(name)
        self.namedChildren[name] = self._addChildStructure(childStructure, name)

    def removeChildNamed(self, name):
        if not name in self.namedChildren:
            return False
        found = self.namedChildren[name]
        success = self._removeChildStructure(found)
        if not success:
            return False
        del self.namedChildren[name]
        return True

    def dimensionsForChildNamed(self, name):
        found = self.namedChildren[name]
        return self._getDimensions(found)

    def hasChild(self, child):
        return child in self.allChildren

    def findNameFor(self, child):
        if child in self._reverseLookup:
            return self._reverseLookup[child]
        return None

    def _getDimensions(self, item, dimensions=0):
        if isinstance(item, list):
            return self._getDimensions(item[0], dimensions + 1)
        return dimensions

    def _removeChildStructure(self, structure):
        if isinstance(structure, list):
            return [self._removeChildStructure(s) for s in structure]
        else:
            self.allChildren.remove(structure)
            del self._reverseLookup[structure]
            self._unsetParent(structure)
            return True

    def _addChildStructure(self, structure, name):
        if isinstance(structure, list):
            return [self._addChildStructure(item, name) for item in structure]
        else:
            self.allChildren.append(structure)
            self._setParent(structure)
            self._reverseLookup[structure] = name
            return structure

    def _setParent(self, child):
        try:
            child.parent = self.parent
        except:
            pass

    def _unsetParent(self, child):
        try:
            child.parent = None
        except:
            pass

    def __getitem__(self, key):
        return self.namedChildren[key]

    def __setitem__(self, key, value):
        self.addChildNamed(key, value)

    def __delitem__(self, key):
        if key in self.namedChildren:
            self.removeChildNamed(key)
