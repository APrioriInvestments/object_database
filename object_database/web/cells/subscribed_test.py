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
from object_database import Schema, InMemServer
from object_database.util import genToken, configureLogging

from object_database.web.cells import Button, Cells, Panel, Slot, Subscribed, Text


import logging
import unittest

test_schema = Schema("core.web.test")


class CellsSubscribedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        configureLogging(preamble="cells_test", level=logging.INFO)
        cls._logger = logging.getLogger(__name__)

    def setUp(self):
        self.token = genToken()
        self.server = InMemServer(auth_token=self.token)
        self.server.start()

        self.db = self.server.connect(self.token)
        self.db.subscribeToSchema(test_schema)
        self.cells = Cells(self.db)

    def tearDown(self):
        self.server.stop()

    def test_basic_change(self):
        slot = Slot(False)
        text = Text("False")
        otherText = Text("True")
        sub = Subscribed(lambda: otherText if slot.get() else text)
        self.cells.withRoot(sub)
        self.cells.renderMessages()

        self.assertEqual(sub.children["content"].text, "False")

        slot.set(True)
        self.cells._recalculateCells()

        self.assertEqual(sub.children["content"].text, "True")

    def test_basic_subscribed_lifecycle(self):
        slot = Slot(True)
        trueContent = Button("Hello", lambda: None)
        falseContent = Text("False")
        sub = Subscribed(lambda: trueContent if slot.get() else falseContent)
        container = Panel(sub)
        self.cells.withRoot(container)
        self.cells._recalculateCells()

        self.assertTrue(container.wasCreated)
        self.assertTrue(sub.wasCreated)
        self.assertTrue(trueContent.wasCreated)

        trueContent.updateLifecycleState()
        container.updateLifecycleState()
        self.cells._root.updateLifecycleState()
        sub.updateLifecycleState()

        slot.set(False)
        self.cells._recalculateCells()

        self.assertFalse(container.wasUpdated)
        self.assertTrue(sub.wasUpdated)
        self.assertTrue(trueContent.wasRemoved)
        self.assertTrue(falseContent.wasCreated)

        self.assertFalse(sub.wasCreated)
        self.assertFalse(trueContent.wasCreated)
        self.assertFalse(trueContent.wasUpdated)
