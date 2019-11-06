/*
 * Additional Integration Tests for Component Lifecycle
 */
require('jsdom-global')();
const maquette = require('maquette');
const h = maquette.h;
let projector = maquette.createProjector();
const NewCellHandler = require('../NewCellHandler.js').default;
const Component = require('../components/Component.js').default;
const chai = require('chai');
const assert = chai.assert;
const registry = require('../ComponentRegistry').ComponentRegistry;

/** Example Messages **/
const createUpdateMessageFor = (anObject) => {
    return Object.assign({}, anObject, {
        type: '#cellUpdated',
        channel: '#main'
    });
};

let simpleSequence = {
    id: '1',
    cellType: 'Sequence',
    nameInParent: 'child',
    parentId: 'page_root',
    extraData: {},
    namedChildren: {
        elements: []
    }
};

let simpleRoot = {
    id: 'page_root',
    cellType: 'RootCell',
    nameInParent: null,
    parentId: null,
    extraData: {},
    namedChildren: {
        'child': null
    }
};

let initialStructure = Object.assign({}, simpleRoot, {
    namedChildren: {
        child: Object.assign({}, simpleSequence, {
            namedChildren: {
                elements: ['2', '3', '4'].map(id => {
                    return {
                        id: id,
                        cellType: 'LifeCycleTester',
                        parentId: '1',
                        nameInParent: 'elements',
                        extraData: {},
                        namedChildren: {}
                    };
                })
            }
        })
    }
});

let updatedStructure = Object.assign({}, simpleRoot, {
    namedChildren: {
        child: Object.assign({}, simpleSequence, {
            namedChildren: {
                elements: [
                    '2',
                    {
                        id: '3',
                        cellType: 'LifeCycleTester',
                        parentId: '1',
                        nameInParent: 'elements',
                        extraData: {},
                        namedChildren: {}
                    },
                    '4'
                ]
            }
        })
    }
});

let subscribedChild = {
    id: 'subscribedChild',
    cellType: 'LifeCycleTester',
    parentId: 'subscribed',
    nameInParent: 'content',
    namedChildren: {},
    extraData: {}
};

let simpleSubscribed = {
    id: 'subscribed',
    cellType: 'SubscribedTester',
    nameInParent: 'child',
    parentId: 'page_root',
    namedChildren: {
        content: subscribedChild
    }
};

let subscribedCreateStructure = Object.assign({}, simpleRoot, {
    namedChildren: {
        child: simpleSubscribed
    }
});

let subscribedUpdateStructure = Object.assign({}, simpleRoot, {
    namedChildren: {
        child: 'subscribed'
    }
});

class LifeCycleTester extends Component {
    constructor(props){
        super(props);
        this.calledLoaded = false;
        this.calledUpdated = false;

        // Bind methods
        this.reset = this.reset.bind(this);
    }

    componentDidLoad(){
        this.calledLoaded = true;
    }

    componentDidUpdate(){
        this.calledUpdated = true;
    }

    build(){
        return h('div', {id: this.props.id}, []);
    }

    reset(){
        this.calledLoaded = false;
        this.calledUpdated = false;
    }
};

class SubscribedTester extends registry['Subscribed'] {
    constructor(props){
        super(props);
        this.calledLoaded = false;
        this.calledUpdated = false;
        this.reset = this.reset.bind(this);
    }

    componentDidLoad(){
        this.calledLoaded = true;
    }

    componentDidUpdate(){
        this.calledUpdated = true;
    }

    reset(){
        this.calledUpdated = false;
        this.calledLoaded = false;
    }
};
registry['LifeCycleTester'] = LifeCycleTester;
registry['SubscribedTester'] = SubscribedTester;

const createElementChild = (id, parent) => {
    return {
        id: id,
        cellType: 'LifeCycleTester',
        nameInParent: 'elements',
        parentId: parent.id,
        extraData: {},
        namedChildren: {}
    };
};


describe("Component Lifecycle Tests", () => {
    describe("Freshly created:", () => {
        let handler;
        before(() => {
            handler = new NewCellHandler(h, projector, registry);
            let rootEl = document.createElement('div');
            rootEl.id = 'page_root';
            document.body.append(rootEl);
        });
        after(() => {
            let rootEl = document.getElementById('page_root');
            rootEl.remove();
        });
        it('Calls #componentDidLoad', () => {
            let message = createUpdateMessageFor(initialStructure);
            handler.receive(message);
            let elementChildren = Object.keys(handler.activeComponents).map(id => {
                return handler.activeComponents[id];
            }).filter((comp) => { return comp.name == 'LifeCycleTester';});
            assert.equal(elementChildren.length, 3);

            // Ensure that #componentDidLoad was called for this
            // initial render
            elementChildren.forEach(comp => {
                assert.isTrue(comp.calledLoaded);
            });
        });
        it('Did not call #componentDidUpdate', () => {
            let elementChildren = Object.keys(handler.activeComponents).map(id => {
                return handler.activeComponents[id];
            }).filter((comp) => { return comp.name == 'LifeCycleTester';});
            elementChildren.forEach(comp => {
                assert.isFalse(comp.calledUpdated);
            });
        });
    });
    describe("Full update", () => {
        let handler;
        before(() => {
            handler = new NewCellHandler(h, projector, registry);
            let rootEl = document.createElement('div');
            rootEl.id = 'page_root';
            document.body.append(rootEl);
        });
        after(() => {
            let rootEl = document.getElementById('page_root');
            rootEl.remove();
        });
        it('Did not call #componentDidLoad', () => {
            let message = createUpdateMessageFor(initialStructure);
            handler.receive(message);
            Object.keys(handler.activeComponents).forEach(id => {
                let comp = handler.activeComponents[id];
                if(comp.reset){
                    comp.reset();
                }
            });
            handler.receive(message);
            let elementChildren = Object.keys(handler.activeComponents).map(id => {
                return handler.activeComponents[id];
            }).filter((comp) => { return comp.name == 'LifeCycleTester';});

            assert.equal(elementChildren.length, 3);
            elementChildren.forEach(comp => {
                assert.isFalse(comp.calledLoaded);
            });
        });
        it('Called #componentDidUpdate', () => {
            let elementChildren = Object.keys(handler.activeComponents).map(id => {
                return handler.activeComponents[id];
            }).filter((comp) => { return comp.name == 'LifeCycleTester';});

            assert.equal(elementChildren.length, 3);
            elementChildren.forEach(comp => {
                assert.isTrue(comp.calledUpdated);
            });
        });
    });

    /* When we pass only IDs for unaltered children */
    describe("Flattened Update", () => {
        let handler;
        before(() => {
            handler = new NewCellHandler(h, projector, registry);
            let rootEl = document.createElement('div');
            rootEl.id = 'page_root';
            document.body.append(rootEl);
        });
        after(() => {
            let rootEl = document.getElementById('page_root');
            rootEl.remove();
        });

        it('Did not call #componentDidLoad', () => {
            let message = createUpdateMessageFor(initialStructure);
            handler.receive(message);
            Object.keys(handler.activeComponents).forEach(id => {
                let comp = handler.activeComponents[id];
                if(comp.reset){
                    comp.reset();
                }
            });
            let updateMessage = createUpdateMessageFor(updatedStructure);
            handler.receive(message);

            let elementChildren = Object.keys(handler.activeComponents).map(id => {
                return handler.activeComponents[id];
            }).filter((comp) => { return comp.name == 'LifeCycleTester';});

            assert.equal(elementChildren.length, 3);
            elementChildren.forEach(comp => {
                assert.isFalse(comp.calledLoaded);
            });
        });
        it('Called #componentDidUpdate', () => {
            let elementChildren = Object.keys(handler.activeComponents).map(id => {
                return handler.activeComponents[id];
            }).filter((comp) => { return comp.name == 'LifeCycleTester';});

            elementChildren.forEach(comp => {
                assert.isTrue(comp.calledUpdated);
            });
        });
    });

    /**
     * Ensure that Subscribed and the contents
     * of Subscribed Components have the appropriate
     * lifecycle methods called on them.
     * This is necessary becasue the component
     * Subscribed can "mask" calls to #componentDidLoad
     * for contents when its own update message was just
     * an id.
     */
    describe("Subscribed Content Lifecycle Checks", () => {
        let handler;
        before(() => {
            handler = new NewCellHandler(h, projector, registry);
            let rootEl = document.createElement('div');
            rootEl.id = 'page_root';
            document.body.append(rootEl);
        });
        after(() => {
            let rootEl = document.getElementById('page_root');
            rootEl.remove();
        });

        it('Calls #componentDidLoad for both the Subscribed and its content', () => {
            let message = createUpdateMessageFor(subscribedCreateStructure);
            handler.receive(message);
            let subscribed = handler.activeComponents['subscribed'];
            let child = handler.activeComponents['subscribedChild'];
            assert.exists(subscribed);
            assert.exists(child);

            // Lifecycle
            assert.isTrue(subscribed.calledLoaded);
            assert.isTrue(child.calledLoaded);
        });
        it('Does not call #componentDidUpdate for either Subscribed or its content', () => {
            let subscribed = handler.activeComponents['subscribed'];
            let child = handler.activeComponents['subscribedChild'];
            assert.exists(subscribed);
            assert.exists(child);

            // Lifecycle
            assert.isFalse(subscribed.calledUpdated);
            assert.isFalse(child.calledUpdated);
        });
        it('Calls #componentDidUpdate for both the Subscribed and its content', () => {
            let subscribed = handler.activeComponents['subscribed'];
            let child = handler.activeComponents['subscribedChild'];
            assert.exists(subscribed);
            assert.exists(child);

            subscribed.reset();
            child.reset();
            let message = createUpdateMessageFor(subscribedUpdateStructure);
            handler.receive(message);

            // Lifecycle
            assert.isTrue(subscribed.calledUpdated);
            assert.isTrue(child.calledUpdated);
        });
    });
});
