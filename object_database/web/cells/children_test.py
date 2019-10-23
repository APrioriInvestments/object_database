import unittest
from object_database.web.cells.children import Children


class DummyObject:
    def __init__(self):
        self.parent = None


class CellChildrenTests(unittest.TestCase):
    def test_get_dimensions_zero(self):
        item = DummyObject()
        children = Children()
        result = children._getDimensions(item)
        self.assertEqual(result, 0)

    def test_get_dimensions_one(self):
        item = [DummyObject() for d in range(20)]
        children = Children()
        result = children._getDimensions(item)
        self.assertEqual(result, 1)

    def test_get_dimensions_two(self):
        item = [[DummyObject() for d in range(20)] for c in range(20)]
        children = Children()
        result = children._getDimensions(item)
        self.assertEqual(result, 2)

    def test_get_dimensions_three(self):
        item = [[[DummyObject() for a in range(20)] for b in range(20)] for c in range(20)]
        children = Children()
        result = children._getDimensions(item)
        self.assertEqual(result, 3)

    def test_add_child_zero_dm(self):
        child = DummyObject()
        children = Children()
        children.addChildNamed("first", child)
        self.assertTrue("first" in children.namedChildren)
        self.assertTrue(child in children.allChildren)
        self.assertEqual(child, children.namedChildren["first"])

    def test_basic_add_child_one_dm(self):
        child = [DummyObject(), DummyObject(), DummyObject()]
        children = Children()
        children.addChildNamed("first", child)
        self.assertEqual(len(children.allChildren), 3)
        for item in children.allChildren:
            self.assertIsInstance(item, DummyObject)

    def test_add_child_one_dm(self):
        child = [DummyObject() for d in range(20)]
        children = Children()
        children.addChildNamed("first", child)
        self.assertTrue("first" in children.namedChildren)
        for item in child:
            self.assertTrue(item in children.allChildren)
        self.assertEqual(child, children.namedChildren["first"])
        self.assertEqual(len(children.allChildren), 20)
        for item in children.allChildren:
            self.assertIsInstance(item, DummyObject)

    def test_add_child_two_dm(self):
        child = [[DummyObject() for d in range(20)] for c in range(30)]
        children = Children()
        children.addChildNamed("first", child)
        self.assertTrue("first" in children.namedChildren)
        for outerItem in child:
            for innerItem in outerItem:
                self.assertTrue(innerItem in children.allChildren)
        self.assertEqual(child, children.namedChildren["first"])
        self.assertEqual(len(children.allChildren), 600)

    def test_remove_child_zero_dm(self):
        child = DummyObject()
        children = Children()
        children.addChildNamed("first", child)
        self.assertEqual(len(children.allChildren), 1)
        children.removeChildNamed("first")
        self.assertEqual(len(children.allChildren), 0)
        self.assertFalse("first" in children.namedChildren)

    def test_remove_child_one_dm(self):
        child = [DummyObject() for d in range(10)]
        children = Children()
        children.addChildNamed("first", child)
        self.assertEqual(len(children.allChildren), 10)
        children.removeChildNamed("first")
        self.assertEqual(len(children.allChildren), 0)
        self.assertFalse("first" in children.namedChildren)

    def test_remove_child_two_dm(self):
        child = [[DummyObject() for d in range(5)] for c in range(10)]
        children = Children()
        children.addChildNamed("first", child)
        self.assertEqual(len(children.allChildren), 50)
        children.removeChildNamed("first")
        self.assertEqual(len(children.allChildren), 0)
        self.assertFalse("first" in children.namedChildren)

    def test_setitem_zero_dm(self):
        child = DummyObject()
        children = Children()
        children["first"] = child
        self.assertTrue("first" in children.namedChildren)
        self.assertEqual(children.namedChildren["first"], child)
        self.assertEqual(len(children.allChildren), 1)
        self.assertEqual(children.dimensionsForChildNamed("first"), 0)

    def test_setitem_one_dm(self):
        child = [DummyObject() for d in range(10)]
        children = Children()
        children["first"] = child
        self.assertTrue("first" in children.namedChildren)
        self.assertEqual(child, children.namedChildren["first"])
        self.assertEqual(len(children.allChildren), 10)
        self.assertEqual(children.dimensionsForChildNamed("first"), 1)

    def test_setitem_two_dm(self):
        child = [[DummyObject() for d in range(10)] for c in range(10)]
        children = Children()
        children["first"] = child
        self.assertTrue("first" in children.namedChildren)
        self.assertEqual(len(children.allChildren), 100)
        self.assertEqual(child, children.namedChildren["first"])
        self.assertEqual(children.dimensionsForChildNamed("first"), 2)

    def test_add_reverse_lookup_zero_dm(self):
        children = Children()
        child = DummyObject()
        otherChild = DummyObject()
        children["test"] = child
        children["other_test"] = otherChild
        self.assertTrue(child in children._reverseLookup)
        self.assertEqual(children._reverseLookup[child], "test")
        self.assertTrue(otherChild in children._reverseLookup)
        self.assertEqual(children._reverseLookup[otherChild], "other_test")

    def test_add_reverse_lookup_one_dm(self):
        children = Children()
        child = [DummyObject() for d in range(5)]
        children["test"] = child
        other_child = [DummyObject() for d in range(6)]
        children["other_test"] = other_child
        for item in child:
            self.assertTrue(item in children._reverseLookup)
            self.assertEqual(children._reverseLookup[item], "test")
        for item in other_child:
            self.assertTrue(item in children._reverseLookup)
            self.assertEqual(children._reverseLookup[item], "other_test")

    def test_add_reverse_lookup_two_dm(self):
        children = Children()
        child = [[DummyObject() for d in range(5)] for c in range(10)]
        children["test"] = child
        for outer in child:
            for inner in outer:
                self.assertTrue(inner in children._reverseLookup)
                self.assertEqual(children._reverseLookup[inner], "test")

    def test_remove_all(self):
        # One dimensional child
        zero_dm = DummyObject()

        # Two dimensional child
        one_dm = [DummyObject() for d in range(10)]

        # Three dimensional child
        two_dm = [[DummyObject() for d in range(10)] for c in range(10)]

        # Add the children
        children = Children()
        children["zero"] = zero_dm
        children["one"] = one_dm
        children["two"] = two_dm
        self.assertEqual(len(children.allChildren), 111)
        self.assertEqual(len(children.namedChildren.keys()), 3)

        # Now remove all and ensure children
        # is zeroed out
        children.removeAll()
        self.assertEqual(len(children.allChildren), 0)
        self.assertEqual(len(children.namedChildren.keys()), 0)
