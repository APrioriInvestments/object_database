## Cells Development ##

This document is intended for those interested in developing cells. We'll see how to customize currently available cells, as well as develop ones to add to the object database ecosystem. 

We'll assume you have a decent idea about how things fit together (cells, object database, typed python and so on). But if you need a refresher on specifics take a look at the corresponding docs [here](https://github.com/APrioriInvestments/object_database/tree/docs). We'll also assume that you have gone through the [cells.md](./cells.md) doc and will be using the services developed there as a starting point. 


### Basic Overview ###

Leaving the server and related backend infrastructure aside, cells consist of two main components. The [python classes](https://github.com/APrioriInvestments/object_database/tree/dev/object_database/web/cells) which are the cells themselves and the corresponding [JS classes](https://github.com/APrioriInvestments/object_database/tree/dev/object_database/web/content/src/components) which are responsible for generated the html/js/css etc. Every python cell has a corresponding JS cell, but not all of these strictly generate DOM elements. Some are utilities for styling, layouts, events etc. 

For example,
* border: [python](https://github.com/APrioriInvestments/object_database/blob/dev/object_database/web/cells/border.py) and [JS](https://github.com/APrioriInvestments/object_database/blob/dev/object_database/web/content/src/components/Border.js)
* layout/flex: [python](https://github.com/APrioriInvestments/object_database/blob/dev/object_database/web/cells/flex.py) and [JS](https://github.com/APrioriInvestments/object_database/blob/dev/object_database/web/content/src/components/Flex.js)
* key events: [JS](https://github.com/APrioriInvestments/object_database/blob/dev/object_database/web/content/src/components/KeyAction.js)


### Making changes ###

In our [cells.md](./cells.md) doc we made a [__SlightlyMoreInteresting__ service](./examples/cells.py) where we strung together a number of button cells which linked to the different installed services. 

Take a look at the [Button.build()](https://github.com/APrioriInvestments/object_database/blob/dev/object_database/web/content/src/components/Button.js#L32). You'll see that we use 'hyperscript' h() notation to build the actual DOM elements. 

Suppose you decide that all buttons need to have a padding, as a inline style, you can add `style: "padding: 5px"` argument to h(), then rebuild the bundle (`npm run build` in the [content](https://github.com/APrioriInvestments/object_database/tree/dev/object_database/web/content) directory) and refresh. You should see the button names padded with 5px. 

Of course this is a hardcoded change, which you cannot control from the python side, so lets try to make this a bit more configurable. 

Lets go to our [python Button]() class and a `padding="5px"` keyword argument and export the data to the JS side which happens in the `Button.recalculate()` method. 

Your python Button classshould now look like this:
```
class Button(Clickable):
    def __init__(self, *args, small=False, active=True, style="primary",
                 padding="5px", **kwargs):
        Clickable.__init__(self, *args, **kwargs)
        self.small = small
        self.active = active
        self.style = style
        self.padding = padding

    def recalculate(self):
        super().recalculate()

        self.exportData["small"] = bool(self.small)
        self.exportData["active"] = bool(self.active)
        self.exportData["style"] = self.style
        self.exportData["padding"] = self.padding
```

The `padding` argument will now be sent alogn with props and you could handle it on the JS side as you needed. For example, your JS Button class could now look like this:
```
class Button extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.onClick = this.onClick.bind(this);
        this._getHTMLClasses = this._getHTMLClasses.bind(this);

        this.buttonDiv = null;
	// Our new padding arg!
        self.padding = props.padding;
    }

...

    build() {
        this.buttonDiv = h('div', {
            id: this.getElementId(),
            "data-cell-id": this.identity,
            "data-cell-type": "Button",
            class: this._getHTMLClasses(),
            style: `padding: ${self.padding}`, // using padding here!
            onclick: this.onClick,
            tabindex: -1,
            onmousedown: (event) => {
                // prevent the event from causing us to focus since we just want a
                // click
                event.preventDefault();
            }
        }, [this.renderChildNamed('content')]);

        let res = h(
            'div',
            {'class': 'allow-child-to-fill-space button-holder'},
            [this.buttonDiv]
        );

        this.applySpacePreferencesToClassList(this.buttonDiv);
        this.applySpacePreferencesToClassList(res);

        return res;
    }
...
```

Of course you could add more logic, as well as change things beoynd styling (the DOM element itself, event handling and so on). 

### Making a new cell ###

If the current collections of cells is not sufficient for you can make a new one. 

There are three steps here:
* create a Python cells class
* create the corresponding JS cells class
* register the classes at the object database system and module levels, as well as with the web bundle

Lets create an `OurNewCell` cell that displays some text with a few basic options.

Create a file `our_new_cell.py` in the [cells directory](https://github.com/APrioriInvestments/object_database/tree/dev/object_database/web/cells) with the following code:

```
from object_database.web.cells.cell import Cell

class OurNewCell(Cell):
    def __init__(self, text,  makeBold=False):
        super().__init__()
        self.text = test
        self.bold = makeBold

    def recalculate(self):
        self.exportData["text"] = self.text
        self.exportData["bold"] = self.bold
```

Create a file `OurNewCell.js` in the js [components directory](https://github.com/APrioriInvestments/object_database/tree/dev/object_database/web/content/src/components) with the following code:

```
import {ConcreteCell} from './ConcreteCell';
import {makeDomElt as h} from './Cell';

class OurNewCell extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);
		this.bold = props.bold;
		this.text = props.text;
    }

    build() {
		let style = "text-align: center";
		if(this.bold){
			style += "; font-weight: bold";
		};
        let res = h(
            'div',
			{style: style},
            [this.text]
        );
        return res;
    }
}

export {OurNewCell, OurNewCell as default};
```

Update the various registers with your new cells class:
* [JS components registry](https://github.com/APrioriInvestments/object_database/blob/b20b6c280b09f7381c9ac9900945a33e234eb621/object_database/web/content/ComponentRegistry.js)
* [object database module init](https://github.com/APrioriInvestments/object_database/blob/dev/object_database/web/cells/__init__.py)

Now lets update our [cells.py](./examples/cells.py) examples we used in [cells.md](./cells.md) to use our new cell:
```
import object_database.web.cells as cells
from object_database import ServiceBase


class SomethingMoreInteresting(ServiceBase):
    def initialize(self):
        self.buttonName = "click me"
        return

    @staticmethod
    def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
        return cells.Card(
            cells.Panel(
                cells.OurNewCell("This is our new cell", makeBold=True) +
                cells.Button("Reload", lambda: "") +
                cells.Button("Service Base", lambda: "ServiceBase") +
                cells.Button("Active Web Service", lambda: "ActiveWebService")
            ),
            header="This is a 'card' cell with some buttons",
            padding="10px"
        )
```

The last step is to rebuild the bundle `npm run build` in the [componentsi](https://github.com/APrioriInvestments/object_database/tree/dev/object_database/web/content/src/components) directory and then reinstall our service like so:
```
object_database_service_config install --class docs.examples.cells.SomethingMoreInteresting --placement Master
```

You should see your new cell appear when you click on the `SomethingMoreInteresting` service.
