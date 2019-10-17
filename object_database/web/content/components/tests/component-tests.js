/**
 * Mocha Tests for Base Component Class
 */
require('jsdom-global')();
var Component = require('../Component.js').Component;
var render = require('../Component.js').render;
var chai = require('chai');
var h = require('maquette').h;
var assert = chai.assert;
var expect = chai.expect;
var AllComponents = require('../../ComponentRegistry.js').ComponentRegistry;

class SubComponent extends Component {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return (
            h('div', {
                id: this.props.id,
                class: "test-component subcomponent"
            }, [`Child: ${this.props.id}`])
        );
    }
};

function newPlainComponent(id){
    return new SubComponent({
        id: id
    });
}

describe("Base Component Class", () => {
    describe('Base Component Construction', () => {
        it('Should error if no id is passed with props', () => {
            let fn = function(){
                return new Component({});
            };
            assert.throws(fn, Error);
        });
        it('Should construct with an empty dict of namedChildren if none are passed', () => {
            let instance = new SubComponent({id: 'subcomponent'});
            assert.exists(instance.props.namedChildren);
            assert.typeOf(instance.props.namedChildren, 'object');
        });
    });

    describe('Base Component Relationships', () => {
        it('Plain components have no parent', () => {
            let instance = new SubComponent({id: 'hello'});
            assert.isNull(instance.parent);
        });
        it('Array Child components have parent set correctly', () => {
            let arrayChildren = [
                new SubComponent({id: 'array-child-1'}),
                new SubComponent({id: 'array-child-2'})
            ];
            let parent = new SubComponent({
                id: 'parent',
                children: arrayChildren
            });
            arrayChildren.forEach(arrayChild => {
                assert.equal(arrayChild.parent, parent);
            });
        });
        it('Named Children components have parent set correctly', () => {
            let namedChildren = {
                'namedChild1': new SubComponent({id: 'namedChild1'}),
                'namedChild2': new SubComponent({id: 'namedChild2'})
            };
            let parent = new SubComponent({
                id: 'parent',
                namedChildren: namedChildren
            });
            Object.keys(namedChildren).forEach(key => {
                let child = namedChildren[key];
                assert.equal(child.parent, parent);
            });
        });
    });

    describe('Base Component Accessors', () => {
        it('#name responds with the correct name', () => {
            let instance = new SubComponent({id: 'subcomponent'});
            assert.equal('SubComponent', instance.name);
        });
    });

    describe('Base Component Rendering', () => {
        it('#can render basic', () => {
            let component = new SubComponent({id: 'component'});
            let result = component.render();
            assert.exists(result);
            assert.equal(result.properties.id, 'component');
        });
    });

    /*TODO: add test for more advanced rendering when ready*/

    describe('Base Component Children Utilities', () => {
        it('#renderedChildren provides hyperscripts for children', () => {
            let parent = new Component({
                id:'parent1',
                children: [
                    new SubComponent({id: 'child1'}),
                    new SubComponent({id: 'child2'}),
                    new SubComponent({id: 'child3'})
                ]
            });
            let result = parent.renderedChildren;
            assert.lengthOf(result, 3);
        });
        it('#renderedChildren result objects have appropriately set keys', () => {
            let parent = new Component({
                id:'parent1',
                children: [
                    new SubComponent({id: 'child1'}),
                    new SubComponent({id: 'child2'}),
                    new SubComponent({id: 'child3'})
                ]
            });
            let result = parent.renderedChildren;
            result.forEach((childHyperscript) => {
                let id = childHyperscript.properties.id;
                assert.propertyVal(childHyperscript.properties, 'key', `parent1-child-${id}`);
            });
        });
        it('#renderChildNamed returns hyperscript from child component', () => {
            let child = new SubComponent({id: 'foo'});
            let parent = new Component({
                id: 'parent',
                namedChildren: {'mainChild': child}
            });
            let result = parent.renderChildNamed('mainChild');
            assert.exists(result.properties);
        });
    });
});

describe("Module `render` function", () => {
    var component;
    before(() => {
        component = new SubComponent({id: 'subcomponent'});
    });
    it("Can render a component", () => {
        let result = render(component);
        assert.exists(result);
        assert.equal(result.properties.id, 'subcomponent');
    });
    it("Should have only rendered once for now", () => {
        assert.equal(component.numRenders, 1);
    });
    it("Should have rendered twice for now", () => {
        render(component);
        assert.equal(component.numRenders, 2);
    });
});

describe("Component post-build render functionality", () => {
    it("Should add the `flex-child` CSS class to any component with `flexChild` prop", () => {
        let component = new SubComponent({id: 'subcomponent', flexChild: true});
        let result = render(component);
        let classes = result.properties.class.split(" ");
        assert.include(classes, 'flex-child');
    });
    it("Should not add the `flex-child` CSS class when `flexChild` is explicitly false", () => {
        let component = new SubComponent({id: 'subcomponent', flexChild: false});
        let result = render(component);
        let classes = result.properties.class.split(" ");
        assert.notInclude(classes, 'flex-child');
    });
});

/**
 * All Component building tests
 */
describe('VElement Build Tests for All Components', () => {
    let funcName = 'build'; // Has been 'render' in the past
    before(() => {
        funcName = 'build';
    });

    it('AsyncDropdown can build', () => {
        let comp = new AllComponents.AsyncDropdown({
            id: 'foo',
            namedChildren: {
                content: newPlainComponent(1),
                loadingIndicator: newPlainComponent(2)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Badge can build', () => {
        let comp = new AllComponents.Badge({
            id: 'foo',
            namedChildren: {
                inner: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Button can build', () => {
        let comp = new AllComponents.Button({
            id: 'foo',
            events: {},
            namedChildren: {
                content: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('ButtonGroup can build', () => {
        let comp = new AllComponents.ButtonGroup({
            id: 'foo',
            namedChildren: {
                buttons: [
                    newPlainComponent(1),
                    newPlainComponent(2)
                ]
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Card can build', () => {
        let comp = new AllComponents.Card({
            id: 'foo',
            namedChildren: {
                body: newPlainComponent(1),
                header: newPlainComponent(2)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('CardTitle can build', () => {
        let comp = new AllComponents.CardTitle({
            id: 'foo',
            namedChildren: {
                inner: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('CircleLoader can build', () => {
        let comp = new AllComponents.CircleLoader({
            id: 'foo'
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Clickable can build', () => {
        let comp = new AllComponents.Clickable({
            id: 'foo',
            namedChildren: {
                content: newPlainComponent(1)
            },
            events: {}
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('CodeEditor can build', () => {
        let comp = new AllComponents.CodeEditor({
            id: 'foo'
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Code can build', () => {
        let comp = new AllComponents.Code({
            id: 'foo',
            namedChildren: {
                code: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('CollapsiblePanel can build', () => {
        let comp = new AllComponents.CollapsiblePanel({
            id: 'foo',
            namedChildren: {
                content: newPlainComponent(1),
                panel: newPlainComponent(2)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Columns can build', () => {
        let comp = new AllComponents.Columns({
            id: 'foo',
            namedChildren: {
                elements: [1, 2, 3, 4].map(num => {
                    return newPlainComponent(num);
                })
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Container can build', () => {
        let comp = new AllComponents.Container({
            id: 'foo',
            namedChildren: {
                child: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('ContextualDispay can build', () => {
        let comp = new AllComponents.ContextualDisplay({
            id: 'foo',
            namedChildren: {
                child: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Dropdown can build', () => {
        let comp = new AllComponents.Dropdown({
            id: 'foo',
            namedChildren: {
                title: newPlainComponent(7),
                dropdownItems: [1, 2, 3, 4].map(num => {
                    return newPlainComponent(num);
                })
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Expands can build', () => {
        let comp = new AllComponents.Expands({
            id: 'foo',
            namedChildren: {
                icon: newPlainComponent(1),
                content: newPlainComponent(2)
            }
        });
    });

    it('Grid can build', () => {
        let headers = [4, 5, 6].map(num => {
            return newPlainComponent(num);
        });
        let rowLabels = [1, 2, 3].map(num => {
            return newPlainComponent(num);
        });
        let dataCells = [1, 2, 3].map(colNum => {
            return [1, 2, 3].map(rowNum => {
                return newPlainComponent(`${rowNum}x${colNum}`);
            });
        });
        let comp = new AllComponents.Grid({
            id: 'foo',
            namedChildren: {
                headers: headers,
                rowLabels: rowLabels,
                dataCells: dataCells
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('HeaderBar can build', () => {
        let leftItems = [1, 2].map(num => {
            return newPlainComponent(num);
        });
        let centerItems = [newPlainComponent(3)];
        //No right items
        let comp = new AllComponents.HeaderBar({
            id: 'foo',
            namedChildren: {leftItems, centerItems}
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('HorizontalSequence can build', () => {
        let comp = new AllComponents.HorizontalSequence({
            id: 'foo',
            namedChildren: {
                elements: [1, 2, 3, 4].map(num => {
                    return newPlainComponent(num);
                })
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('KeyAction can build (and returns null)', () => {
        let comp = new AllComponents.KeyAction({id: 'foo'});
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.notExists(result);
    });

    it('LargePendingDownloadDisplay can build', () => {
        let comp = new AllComponents.LargePendingDownloadDisplay({
            id: 'foo'
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('LoadContentsFromUrl can build', () => {
        let comp = new AllComponents.LoadContentsFromUrl({
            id: 'foo'
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Main can build', () => {
        let comp = new AllComponents.Main({
            id: 'main',
            namedChildren: {
                child: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Modal can build', () => {
        let comp = new AllComponents.Modal({
            id: 'foo',
            namedChildren: {
                title: newPlainComponent(1),
                message: newPlainComponent(2),
                buttons: [3, 4, 5].map(num => {
                    return newPlainComponent(num);
                })
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('_NavTab can build', () => {
        let comp = new AllComponents._NavTab({
            id: 'foo',
            namedChildren: {
                child: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Octiton can build', () => {
        let comp = new AllComponents.Octicon({
            id: 'foo',
            octiconClasses: []
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('PageView can build', () => {
        let comp = new AllComponents.PageView({
            id: 'foo',
            namedChildren: {
                main: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Panel can build', () => {
        let comp = new AllComponents.Panel({
            id: 'foo',
            namedChildren: {
                content: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Plot can build', () => {
        let comp = new AllComponents.Plot({
            id: 'foo',
            namedChildren: {
                chartUpdater: newPlainComponent(1),
                error: newPlainComponent(2)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('_PlotUpdater can build', () => {
        let comp = new AllComponents._PlotUpdater({
            id: 'foo'
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Popover can build', () => {
        let comp = new AllComponents.Popover({
            id: 'foo',
            namedChildren: {
                content: newPlainComponent(1),
                detail: newPlainComponent(2),
                title: newPlainComponent(3)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('ResizablePanel can build', () => {
        let comp = new AllComponents.ResizablePanel({
            id: 'foo',
            namedChildren: {
                first: newPlainComponent(1),
                second: newPlainComponent(2)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('RootCell can build', () => {
        let comp = new AllComponents.RootCell({
            id: 'foo',
            namedChildren: {
                child: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Scrollable can build', () => {
        let comp = new AllComponents.Scrollable({
            id: 'foo',
            namedChildren: {
                child: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Sequence can build', () => {
        let comp = new AllComponents.Sequence({
            id: 'foo',
            namedChildren: {
                elements: [1, 2, 3].map(num => {
                    return newPlainComponent(num);
                })
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('SingleLineTextBox can build', () => {
        let comp = new AllComponents.SingleLineTextBox({
            id: 'foo'
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Span can build', () => {
        let comp = new AllComponents.Span({
            id: 'foo'
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('SplitView can build', () => {
        let comp = new AllComponents.SplitView({
            id: 'foo',
            proportions: [1, 1, 1],
            namedChildren: {
                elements: [1, 2, 3].map(num => {
                    return newPlainComponent(num);
                })
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Subscribed can build', () => {
        let comp = new AllComponents.Subscribed({
            id: 'foo',
            namedChildren: {
                content: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('SubscribedSequence can build', () => {
        let comp = new AllComponents.SubscribedSequence({
            id: 'foo',
            namedChildren: {
                elements: [1, 2, 3].map(num => {
                    return newPlainComponent(num);
                })
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Table can build', () => {
        let comp = new AllComponents.Table({
            id: 'foo',
            namedChildren: {
                headers: [1, 2, 3].map(num => {
                    return newPlainComponent(`head-${num}`);
                }),
                dataCells: [1, 2, 3].map(rowNum => {
                    return [1, 2, 3].map(colNum => {
                        return newPlainComponent(`${rowNum}x${colNum}`);
                    });
                }),
                page: newPlainComponent(4),
                left: newPlainComponent(5),
                right: newPlainComponent(6)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Tabs can build', () => {
        let comp = new AllComponents.Tabs({
            id: 'foo',
            namedChildren: {
                display: newPlainComponent(1),
                headers: [2, 3, 4].map(idx => {
                    return newPlainComponent(idx);
                })
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Text can build', () => {
        let comp = new AllComponents.Text({
            id: 'foo'
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Timestamp can build', () => {
        let comp = new AllComponents.Timestamp({
            id: 'foo'
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });

    it('Traceback can build', () => {
        let comp = new AllComponents.Traceback({
            id: 'foo',
            namedChildren: {
                traceback: newPlainComponent(1)
            }
        });
        expect(comp[funcName].bind(comp)).to.not.throw();
        let result = comp[funcName]();
        assert.exists(result);
    });
});
