#   Copyright 2018 Braxton Mckee
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

import logging
import time
import types

def formatTable(rows):
    rows = [[str(r) for r in row] for row in rows]

    cols = [[r[i] for r in rows] for i in range(len(rows[0]))]
    colWidth = [max([len(c) for c in col]) for col in cols]

    formattedRows = [
        "  ".join(row[col] + " " * (colWidth[col] - len(row[col])) for col in range(len(cols)))
            for row in rows
        ]
    formattedRows = formattedRows[:1] + [
        "  ".join("-" * colWidth[col] for col in range(len(cols)))
        ] + formattedRows[1:]

    return "\n".join(formattedRows)

def configureLogging(preamble="", error=False):
    logging.getLogger('botocore.vendored.requests.packages.urllib3.connectionpool').setLevel(logging.CRITICAL)
    logging.getLogger('asyncio').setLevel(logging.CRITICAL)
    logging.basicConfig(format='[%(asctime)s] %(levelname)8s %(filename)30s:%(lineno)4s' 
        + ("|" + preamble if preamble else '') 
        + '| %(message)s', level=logging.INFO if not error else logging.ERROR
        )

def secondsToHumanReadable(seconds):
    if seconds < 120:
        return "%.2f seconds" % (seconds)
    if seconds < 120 * 60:
        return "%.2f minutes" % (seconds / 60)
    if seconds < 120 * 60 * 24:
        return "%.2f hours" % (seconds / 60 / 60)
    return "%.2f days" % (seconds / 60 / 60 / 24)

class Timer:
    granularity = .1

    def __init__(self, message=None, *args):
        self.message = message
        self.args = args
        self.t0 = None

    def __enter__(self):
        self.t0 = time.time()
        return self

    def __exit__(self, a,b,c):
        t1 = time.time()
        if t1 - self.t0 > Timer.granularity:
            m = self.message
            a = []
            for arg in self.args:
                if isinstance(arg, types.FunctionType):
                    try:
                        a.append(arg())
                    except:
                        a.append("<error>")
                else:
                    a.append(arg)

            if a:
                try:
                    m = m % tuple(a)
                except:
                    logging.error("Couldn't format %s with %s", m, a)

            logging.info("%s took %.2f seconds.", m, t1 - self.t0)

    def __call__(self, f):
        def inner(*args, **kwargs):
            with Timer(self.message or f.__name__, *self.args):
                return f(*args, **kwargs)

        inner.__name__ = f.__name__
        return inner

def indent(text, amount=4, ch=' '):
    padding = amount * ch
    return ''.join(padding+line for line in text.splitlines(True))

def distance(s1, s2):
    """Compute the edit distance between s1 and s2"""
    if len(s1) < len(s2):
        return distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    prev = range(len(s2) + 1)

    for i, c1 in enumerate(s1):
        cur = [i + 1]
        for j, c2 in enumerate(s2):
            cur.append(min(prev[j+1]+1, cur[j]+1, prev[j] + (1 if c1 != c2 else 0)))
        prev = cur
    
    return prev[-1]

def closest_in(name, names):
    return sorted((distance(name, x), x) for x in names)[0][1]

def closest_N_in(name, names, count):
    return [x[1] for x in sorted((distance(name, x), x) for x in names)[:count]]
