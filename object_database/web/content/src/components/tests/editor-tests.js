/*
 * Tests for Key event binding, listening and related
 */
require('jsdom-global')();
const chai = require('chai');
const assert = chai.assert;
const DataModel = require('../editor/DataModel.js').DataModel;
const Constants = require('../Editor.js').Constants;
const TransactionManager = require('../editor/TransactionManager.js').TransactionManager;

describe("Editor Tests.", () => {
    describe("Undo Redo.", () => {
        before(() => {});
        after(() => {});
        it("Can Undo", () => {
            let dm = new DataModel(new Constants());
            let tm = new TransactionManager(dm, new Constants());
            let cursor = dm.cursors[0];

            dm.insertChar(cursor, 'hi');

            assert.equal(dm.lines[0], 'hi');

            tm.snapshot();
            tm.undo();

            assert.equal(dm.lines[0], '');
        });

        it("Can Undo Twice", () => {
            let dm = new DataModel(new Constants());
            let tm = new TransactionManager(dm, new Constants());
            let cursor = dm.cursors[0];

            dm.insertChar(cursor, 'hi');
            tm.snapshot();

            dm.insertChar(cursor, 'Bye');
            tm.snapshot();

            assert.equal(dm.lines[0], 'hiBye');
            tm.undo();
            assert.equal(dm.lines[0], 'hi');
            tm.undo();
            assert.equal(dm.lines[0], '');
            tm.redo();
            assert.equal(dm.lines[0], 'hi');
            tm.redo();
            assert.equal(dm.lines[0], 'hiBye');
            tm.undo();
            assert.equal(dm.lines[0], 'hi');
            tm.undo();
            assert.equal(dm.lines[0], '');
            tm.redo();
            assert.equal(dm.lines[0], 'hi');
            tm.redo();
            assert.equal(dm.lines[0], 'hiBye');

            // we can't redo
            assert.equal(tm.redo(), false);

            tm.undo();
            assert.equal(dm.lines[0], 'hi');

            dm.insertChar(cursor, 'Blah');
            tm.snapshot();
            assert.equal(dm.lines[0], 'hiBlah');

            tm.undo();
            assert.equal(dm.lines[0], 'hi');

            tm.redo();
            assert.equal(dm.lines[0], 'hiBlah');

            tm.undo();
            tm.undo();
            assert.equal(dm.lines[0], '');
            tm.redo();
            assert.equal(dm.lines[0], 'hi');
            tm.redo();
            assert.equal(dm.lines[0], 'hiBlah');
        });

        it("Correctly calculates the multiline string state", () => {
            let dm = new DataModel(new Constants());
            let tm = new TransactionManager(dm, new Constants());

            dm.replaceLine(0, '"""');
            assert.deepEqual(dm.getIsInMultilineString(), [' ', '"']);
            dm.insertLine(1, "asdf");
            assert.deepEqual(dm.getIsInMultilineString(), [' ', '"', '"']);
            dm.insertLine(2, '"""');
            assert.deepEqual(dm.getIsInMultilineString(), [' ', '"', '"', ' ']);

            dm.replaceLine(0, "'''");
            assert.deepEqual(dm.getIsInMultilineString(), [' ', "'", "'", "'"]);
            // the """ are now ignored because there are ''' above them
            dm.replaceLine(1, '"""');
            assert.deepEqual(dm.getIsInMultilineString(), [' ', "'", "'", "'"]);
            dm.replaceLine(2, "'''");
            assert.deepEqual(dm.getIsInMultilineString(), [' ', "'", "'", " "]);

            // this is a net zero triple quote line
            dm.replaceLine(0, ' """ asdf """ ')
            assert.deepEqual(dm.getIsInMultilineString(), [' ', " ", '"', '"']);

            while (dm.lines.length > 1) {
                dm.removeLine(0)
            }

            dm.replaceLine(0, '')
            assert.deepEqual(dm.getIsInMultilineString(), [' ', ' '])

            dm.insertLine(1, '')
            assert.deepEqual(dm.getIsInMultilineString(), [' ', ' ', ' '])
        });
    });
});
