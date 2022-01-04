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


class SortWrapper:
    def __init__(self, x):
        self.x = x

    def sortsAs(self):
        if hasattr(self.x, "sortsAs"):
            return self.x.sortsAs()
        else:
            return self.x

    def __lt__(self, other):
        if not isinstance(other, SortWrapper):
            other = SortWrapper(other)

        try:
            if isinstance(self.x, (int, float)) and isinstance(other.x, (int, float)):
                return self.x < other.x
        except Exception:
            return False

        try:
            if type(self.x) is type(other.x):  # noqa: E721
                return self.sortsAs() < other.sortsAs()
            else:
                return str(type(self.x)) < str(type(other.x))
        except Exception:
            try:
                return str(self.x) < str(self.other)
            except Exception:
                return False

    def __eq__(self, other):
        if not isinstance(other, SortWrapper):
            other = SortWrapper(other)

        try:
            if isinstance(self.x, (int, float)) and isinstance(other.x, (int, float)):
                return self.x == other.x
        except Exception:
            return True

        try:
            if type(self.x) is type(other.x):  # noqa: E721
                return self.sortsAs() == other.sortsAs()
            else:
                return str(type(self.x)) == str(type(other.x))
        except Exception:
            try:
                return str(self.x) == str(self.other)
            except Exception:
                return True

    def __le__(self, other):
        return self < other or self == other

    def __gt__(self, other):
        return not self <= other

    def __ge__(self, other):
        return not self < other
