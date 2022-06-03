#   Coyright 2017-2019 Nativepython Authors
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


class NonBuiltinCellDemo(CellsTestPage):
    def cell(self):
        import textwrap

        class MakePink(cells.NonBuiltinCell):
            def __init__(self, subcell):
                super().__init__()

                self.children["child"] = cells.Cell.makeCell(subcell)

            @classmethod
            def getDefinitionalJavascript(cls):
                return textwrap.dedent(
                    """return (CellRegistry) => {
                        let ConcreteCell = CellRegistry['ConcreteCell'];
                        let Cell = CellRegistry['Cell'];

                        const MakePink = class extends CellRegistry['ConcreteCell'] {
                            constructor(props, ...args) {
                                super(props, ... args);
                            }
                            build() {
                                return Cell.makeDomElt(
                                    'div',
                                    {class: 'pink-cell', 'data-cell-type': 'MakePink'},
                                    [this.renderChildNamed('child')]
                                );
                            }
                        }

                        CellRegistry.MakePink = MakePink;
                    }
                    """
                )

            @classmethod
            def getCssRules(cls):
                return textwrap.dedent(
                    """
                    .pink-cell {
                        background-color: pink;
                    }
                """
                )

        return MakePink("some pink text")

    def text(self):
        return "You should see some text in pink."


def test_nonbuiltin_cells(headless_browser):
    headless_browser.load_demo_page(NonBuiltinCellDemo)

    location = (headless_browser.by.CSS_SELECTOR, '[data-cell-type="MakePink"]')

    headless_browser.wait(5).until(
        headless_browser.expect.presence_of_element_located(location)
    )

    somePinkStuff = headless_browser.find_by_css('[data-cell-type="MakePink"]')

    attrs = somePinkStuff.get_attribute("class")

    assert "pink-cell" in attrs


class NonBuiltinPacketCellDemo(CellsTestPage):
    def cell(self):
        import textwrap

        class SendAPacket(cells.NonBuiltinCell):
            def __init__(self):
                super().__init__()

            def recalculate(self):
                self.exportData["packetId"] = self.cells.getPacketId(
                    lambda packetId: b"SOME BYTES"
                )

            @classmethod
            def getDefinitionalJavascript(cls):
                return textwrap.dedent(
                    """return (CellRegistry) => {
                        let ConcreteCell = CellRegistry['ConcreteCell'];
                        let Cell = CellRegistry['Cell'];

                        const SendAPacket = class extends CellRegistry['ConcreteCell'] {
                            constructor(props, ...args) {
                                super(props, ... args);
                            }
                            build() {
                                this.subdiv = Cell.makeDomElt('div', {}, []);

                                if (this.props.packetId) {
                                    this.requestPacket(this.props.packetId,
                                        (packetId, response) => {
                                            this.subdiv.innerText =
                                                "Packet returned buffer: " + response;
                                        }
                                    )
                                }

                                return this.subdiv;
                            }
                        }

                        CellRegistry.SendAPacket = SendAPacket;
                    }
                    """
                )

            @classmethod
            def getCssRules(cls):
                return ""

        return SendAPacket()

    def text(self):
        return "You should see some text indicating that we can load a packet."
