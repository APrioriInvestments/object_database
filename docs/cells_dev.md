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


