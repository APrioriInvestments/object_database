#   Copyright 2017-2021 object_database Authors
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


from object_database.web.cells.cell import FocusableCell, Cell


class Octicon(Cell):
    def __init__(self, which, color="black", hoverText=None):
        super().__init__()
        self.whichOcticon = which
        self.color = color
        self.hoverText = hoverText

    def sortsAs(self):
        return self.whichOcticon

    def recalculate(self):
        octiconClasses = ["octicon", ("octicon-%s" % self.whichOcticon)]
        self.exportData["octiconClasses"] = octiconClasses
        self.exportData["color"] = self.color
        self.exportData["hoverText"] = str(self.hoverText or "")


class Badge(Cell):
    def __init__(self, inner, style="primary"):
        super().__init__()
        self.inner = self.makeCell(inner)
        self.style = style
        self.exportData["badgeStyle"] = self.style

    def sortsAs(self):
        return self.inner.sortsAs()

    def recalculate(self):
        self.children["inner"] = self.inner


class Text(Cell):
    def __init__(
        self,
        text,
        text_color=None,
        sortAs=None,
        bold=False,
        italic=False,
        preformatted=False,
        monospace=False,
        fontSize=None,
        nowrap=None,
        selectable=False,
    ):
        super().__init__()
        self.text = str(text)
        self.bold = bold
        self.italic = italic
        self.fontSize = fontSize
        self.nowrap = nowrap
        self.preformatted = preformatted
        self.monospace = monospace
        self.preformatted = preformatted
        self.selectable = selectable
        self._sortAs = sortAs if sortAs is not None else text
        self.text_color = text_color

    def sortsAs(self):
        return self._sortAs

    def recalculate(self):
        self.exportData["rawText"] = self.text

        self.exportData["textColor"] = self.text_color
        self.exportData["bold"] = self.bold
        self.exportData["italic"] = self.italic
        self.exportData["monospace"] = self.monospace
        self.exportData["preformatted"] = self.preformatted
        self.exportData["fontSize"] = self.fontSize
        self.exportData["nowrap"] = self.nowrap
        self.exportData["selectable"] = self.selectable


class Traceback(FocusableCell):
    def __init__(self, traceback):
        super().__init__()
        self.traceback = traceback
        tracebackCell = Cell.makeCell(traceback)
        self.children["traceback"] = tracebackCell

    def sortsAs(self):
        return self.traceback


class Code(FocusableCell):
    def __init__(self, codeContents):
        super().__init__()
        self.codeContents = codeContents
        if isinstance(codeContents, str):
            codeContentsCell = Text(codeContents, selectable=True)
        else:
            codeContentsCell = Cell.makeCell(codeContents)

        self.children["code"] = codeContentsCell

    def sortsAs(self):
        return self.codeContents


class Timestamp(Cell):
    """Display current time zone."""

    def __init__(self, timestamp):
        """
        Parameters:
        ----------
        timestamp: float
            posix timestamp (seconds since jan 1 1970)
        """
        super().__init__()
        if not isinstance(timestamp, (float, int)):
            raise TypeError("expected time since epoch float or int for 'timestamp' argument.")
        self.timestamp = timestamp

    def recalculate(self):
        self.exportData["timestamp"] = self.timestamp

    def sortsAs(self):
        self.timestamp


class Span(Cell):
    def __init__(self, text):
        super().__init__()
        self.exportData["text"] = text

    def sortsAs(self):
        return self.contents
