#   Coyright 2017-2022 Nativepython Authors
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

from object_database.web import cells as cells
from object_database.web.CellsTestPage import CellsTestPage


class EditorDemo(CellsTestPage):
    def cell(self):
        sequenceCell = cells.Slot(0)

        edState = cells.SlotEditorState()

        e1 = cells.Editor(editorState=edState, commitDelay=2000, username="A")

        def makeEd2():
            ed2 = cells.Editor(
                editorState=edState, commitDelay=1000, username="B" + str(sequenceCell.get())
            )

            return ed2 + cells.KeyAction(
                "ctrlKey+2",
                lambda event: ed2.focus(),
                stopPropagation=True,
                preventDefault=True,
            )

        e2 = cells.Subscribed(makeEd2)

        return (
            (e1 >> e2)
            + cells.KeyAction(
                "ctrlKey+1",
                lambda event: e1.focus(),
                stopPropagation=True,
                preventDefault=True,
            )
            + cells.Button("Rebuild Ed 2", lambda: sequenceCell.set(sequenceCell.get() + 1))
            + cells.Button(
                "Add a line at top",
                lambda: e1.setContents("line at top\n" + e1.getCurrentContents()),
            )
            + cells.Button(
                "Add a line at bottom",
                lambda: e1.setContents(e1.getCurrentContents() + "\nline at bottom"),
            )
        )

    def text(self):
        return "You should see text editor."


class EditorSectionDemo(CellsTestPage):
    def cell(self):
        slotState = cells.Slot(0)

        edState = cells.SlotEditorState("#-asdf\n\n#-bsdf\n\n")

        def sectionDisplayFun(sectionName, sectionNumber):
            if slotState.get() % 3 == 0:
                return cells.Text(sectionName + ", " + str(sectionNumber))
            if slotState.get() % 3 == 1:
                return None
            return slotState.get()

        return cells.Editor(
            editorState=edState, username="A", sectionDisplayFun=sectionDisplayFun
        ) + cells.Button(
            "change the section headers", lambda: slotState.set(slotState.get() + 1)
        )

    def text(self):
        return "You should see text editor."
