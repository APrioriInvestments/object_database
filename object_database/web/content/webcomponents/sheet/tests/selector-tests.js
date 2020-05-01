/**
 * APSheet Selector Tests
 * ----------------`-----------------
 * Tests for Selector navigation, manipulation
 * and layout using various locked rows, locked
 * columns, and dataOffsets in the
 * PrimaryFrame,.
 * Goals:
 * - Ensure that relative points in
 *   the Selector frame are correct
 *   relativer to the underlying DataFrame.
 */
require('jsdom-global')();
const PrimaryFrame = require('../src/PrimaryFrame').PrimaryFrame;
const Frame = require('../src/Frame').Frame;
const DataFrame = require('../src/DataFrame').DataFrame;
const Selector = require('../src/Selector').Selector;
const Point = require('../src/Point').Point;
const chai = require('chai');
const assert = chai.assert;

// Add a special test case for comparing Points
assert.pointsEqual = function(firstPoint, secondPoint, msg){
    const test = chai.Assertion(null, null, chai.assert, true);
    test.assert(
        firstPoint.equals(secondPoint),
        `Expected ${firstPoint} to equal ${secondPoint}`,
        `Expected ${firstPoint} to not equal ${secondPoint}`,
        secondPoint,
        firstPoint,
        true
    );
};

// We initialize a demo DataFrame 113x133 total.
// In this frame, we ensure that the stored value
// for each point is simply the instance of the Point.
let exampleDataFrame = new DataFrame([0,0], [100, 100]);
exampleDataFrame.forEachPoint(aPoint => {
    exampleDataFrame.putAt(aPoint, aPoint);
});


describe('Basic Selector instantiation tests.', () => {
    /*
     * PrimaryFrame Layout
     *
     * VVVVVVV
     * VVVVVVV
     * VVVVVVV
     * VVVVVVV
     *
     * V=Internal View Frame
     * (Note: no locked rows or cols here)
     *
     *
     * Relative to DataFrame:
     *
     * VVVVVVVDDDDDDDDDDD...
     * VVVVVVVDDDDDDDDDDD...
     * VVVVVVVDDDDDDDDDDD...
     * VVVVVVVDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * .......................
     *
     * D=DataFrame
     * V= Relative view frame
     */

    let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,15]);
    let selector = new Selector(primaryFrame);
    it('Has a correct cursor', () => {
        let expected = new Point([0,0]);

        assert.pointsEqual(selector.cursor, expected);
    });
    it('Has a correct anchor', () => {
        let expected = new Point([0,0]);

        assert.pointsEqual(selector.anchor, expected);
    });
    it('Has a correct relativeCursor', () => {
        let expected = new Point([0,0]);

        assert.pointsEqual(selector.relativeCursor, expected);
    });
    it('Has a correct selection frame', () => {
        let expected = new Frame([0, 0], [0, 0]);
        expected.isEmpty = true;

        assert.isTrue(selector.selectionFrame.equals(expected));
    });
    it('Has a correct selection frame', () => {
        let expected = new Frame([0, 0], [0, 0]);
        expected.isEmpty = true;

        assert.isTrue(selector.selectionFrame.equals(expected));
    });
});

describe('Basic Selector instantiation tests (shifted PrimaryFrame).', () => {
    /*
     * PrimaryFrame Layout
     *
     * VVVVVVV
     * VVVVVVV
     * VVVVVVV
     * VVVVVVV
     *
     * V=Internal View Frame
     * (Note: no locked rows or cols here)
     *
     *
     * Relative to DataFrame:
     *
     * DDDDDDDDDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDD...
     * DVVVVVVVDDDDDDDDDDD...
     * DVVVVVVVDDDDDDDDDDD...
     * DVVVVVVVDDDDDDDDDDD...
     * DVVVVVVVDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDD...
     * .......................
     *
     * D=DataFrame
     * V= Relative view frame
     */

    let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,15]);
    primaryFrame.shiftRightBy(1);
    primaryFrame.shiftDownBy(2);
    let selector = new Selector(primaryFrame);
    it('Has a correct cursor', () => {
        let expected = new Point([0,0]);

        assert.pointsEqual(selector.cursor, expected);
    });
    it('Has a correct anchor', () => {
        let expected = new Point([1,2]);

        assert.pointsEqual(selector.anchor, expected);
    });
    it('Has a correct relativeCursor', () => {
        let expected = new Point([1,2]);

        assert.pointsEqual(selector.relativeCursor, expected);
    });
    it('Has a correct selection frame', () => {
        let expected = new Frame([0, 0], [0, 0]);
        expected.isEmpty = true;

        assert.isTrue(selector.selectionFrame.equals(expected));
    });
    it('Has a correct selection frame', () => {
        let expected = new Frame([0, 0], [0, 0]);
        expected.isEmpty = true;

        assert.isTrue(selector.selectionFrame.equals(expected));
    });
});

describe('Selector navigation tests (no locked rows or columns).', () => {
    /*
     * PrimaryFrame Layout
     *
     * VVVVVVV
     * VVVVVVV
     * VVVVVVV
     * VVVVVVV
     *
     * V=Internal View Frame
     * (Note: no locked rows or cols here)
     *
     *
     * Relative to DataFrame:
     *
     * VVVVVVVDDDDDDDDDDD...
     * VVVVVVVDDDDDDDDDDD...
     * VVVVVVVDDDDDDDDDDD...
     * VVVVVVVDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * .......................
     *
     * D=DataFrame
     * V= Relative view frame
     */


    it('Move right within PrimaryFrame (selecting=false)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveRightBy(2);
        let expectedCursor = new Point([2,0]);
        let expectedRelCursor = new Point([2,0]);
        let expectedAnchor = new Point([2,0]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isTrue(selector.selectionFrame.isEmpty);
    });
    it('Move right within PrimaryFrame (selecting=true)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveRightBy(2, true);
        let expectedCursor = new Point([2,0]);
        let expectedRelCursor = new Point([2,0]);
        let expectedAnchor = new Point([0,0]);
        let expectedSelectionFrame = new Frame([0, 0], [2,0]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isFalse(selector.selectionFrame.isEmpty);
        assert.isTrue(selector.selectionFrame.equals(expectedSelectionFrame));
    });
    it('Move right out of the PrimaryFrame (selecting=false)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveRightBy(15);
        let expectedCursor = new Point([10,0]);
        let expectedRelCursor = new Point([15,0]);
        let expectedAnchor = new Point([15,0]);
        let expectedPrimaryFrameOffset = new Point([5,0]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isTrue(selector.selectionFrame.isEmpty);
        assert.isTrue(primaryFrame.dataOffset.equals(expectedPrimaryFrameOffset));
    });
    it('Move right out of the PrimaryFrame (selecting=true)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveRightBy(15, true);
        let expectedCursor = new Point([10,0]);
        let expectedRelCursor = new Point([15,0]);
        let expectedAnchor = new Point([0,0]);
        let expectedSelectionFrame = new Frame([0, 0], [15,0]);
        let expectedPrimaryFrameOffset = new Point([5,0]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isFalse(selector.selectionFrame.isEmpty);
        assert.isTrue(selector.selectionFrame.equals(expectedSelectionFrame));
        assert.isTrue(primaryFrame.dataOffset.equals(expectedPrimaryFrameOffset));
    });
    it('Move left within PrimaryFrame (selecting=false)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveLeftBy(2);
        // nothing should happen here, we are already at the left corner
        let expectedCursor = new Point([0,0]);
        let expectedRelCursor = new Point([0,0]);
        let expectedAnchor = new Point([0,0]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isTrue(selector.selectionFrame.isEmpty);

        // first move a bit to the right then back left
        selector.moveRightBy(4);
        selector.moveLeftBy(2);
        expectedCursor = new Point([2,0]);
        expectedRelCursor = new Point([2,0]);
        expectedAnchor = new Point([2,0]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isTrue(selector.selectionFrame.isEmpty);
    });
    it('Move left within PrimaryFrame (selecting=true)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveLeftBy(2, true);
        // nothing should happen here, we are already at the left corner
        let expectedCursor = new Point([0,0]);
        let expectedRelCursor = new Point([0,0]);
        let expectedAnchor = new Point([0,0]);
        let expectedSelectionFrame = new Frame([0, 0], [0,0]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isFalse(selector.selectionFrame.isEmpty);
        assert.isTrue(selector.selectionFrame.equals(expectedSelectionFrame));

        // first move a bit to the right then back left
        selector.moveRightBy(4);
        selector.moveLeftBy(2, true);
        expectedCursor = new Point([2,0]);
        expectedRelCursor = new Point([2,0]);
        expectedAnchor = new Point([4,0]);
        expectedSelectionFrame = new Frame([2, 0], [4,0]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isFalse(selector.selectionFrame.isEmpty);
        assert.isTrue(selector.selectionFrame.equals(expectedSelectionFrame));
    });
    it('Move left out of the PrimaryFrame (selecting=false)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveRightBy(15);
        selector.moveLeftBy(10);
        let expectedCursor = new Point([0,0]);
        let expectedRelCursor = new Point([5,0]);
        let expectedAnchor = new Point([5,0]);
        let expectedPrimaryFrameOffset = new Point([5,0]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isTrue(selector.selectionFrame.isEmpty);
        assert.isTrue(primaryFrame.dataOffset.equals(expectedPrimaryFrameOffset));
    });
    it('Move left out of the PrimaryFrame (selecting=true)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveRightBy(15);
        selector.moveLeftBy(10, true);
        let expectedCursor = new Point([0,0]);
        let expectedRelCursor = new Point([5,0]);
        let expectedAnchor = new Point([15,0]);
        let expectedSelectionFrame = new Frame([5, 0], [15,0]);
        let expectedPrimaryFrameOffset = new Point([5,0]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isFalse(selector.selectionFrame.isEmpty);
        assert.isTrue(selector.selectionFrame.equals(expectedSelectionFrame));
        assert.isTrue(primaryFrame.dataOffset.equals(expectedPrimaryFrameOffset));
    });
    it('Move down within PrimaryFrame (selecting=false)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveDownBy(2);
        let expectedCursor = new Point([0,2]);
        let expectedRelCursor = new Point([0,2]);
        let expectedAnchor = new Point([0,2]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isTrue(selector.selectionFrame.isEmpty);
    });
    it('Move down within PrimaryFrame (selecting=true)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveDownBy(2, true);
        let expectedCursor = new Point([0,2]);
        let expectedRelCursor = new Point([0,2]);
        let expectedAnchor = new Point([0,0]);
        let expectedSelectionFrame = new Frame([0, 0], [0,2]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isFalse(selector.selectionFrame.isEmpty);
        assert.isTrue(selector.selectionFrame.equals(expectedSelectionFrame));
    });
    it('Move down out of the PrimaryFrame (selecting=false)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveDownBy(25);
        let expectedCursor = new Point([0,20]);
        let expectedRelCursor = new Point([0,25]);
        let expectedAnchor = new Point([0,25]);
        let expectedPrimaryFrameOffset = new Point([0,5]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isTrue(selector.selectionFrame.isEmpty);
        assert.isTrue(primaryFrame.dataOffset.equals(expectedPrimaryFrameOffset));
    });
    it('Move down out of the PrimaryFrame (selecting=true)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveDownBy(25, true);
        let expectedCursor = new Point([0,20]);
        let expectedRelCursor = new Point([0,25]);
        let expectedAnchor = new Point([0,0]);
        let expectedSelectionFrame = new Frame([0, 0], [0,25]);
        let expectedPrimaryFrameOffset = new Point([0,5]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isFalse(selector.selectionFrame.isEmpty);
        assert.isTrue(selector.selectionFrame.equals(expectedSelectionFrame));
        assert.isTrue(primaryFrame.dataOffset.equals(expectedPrimaryFrameOffset));
    });
    it('Move up within PrimaryFrame (selecting=false)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveUpBy(2);
        // nothing should happen here, we are already at the up corner
        let expectedCursor = new Point([0,0]);
        let expectedRelCursor = new Point([0,0]);
        let expectedAnchor = new Point([0,0]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isTrue(selector.selectionFrame.isEmpty);

        // first move a bit to the down then back up
        selector.moveDownBy(4);
        selector.moveUpBy(2);
        expectedCursor = new Point([0,2]);
        expectedRelCursor = new Point([0,2]);
        expectedAnchor = new Point([0,2]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isTrue(selector.selectionFrame.isEmpty);
    });
    it('Move up within PrimaryFrame (selecting=true)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveUpBy(2, true);
        // nothing should happen here, we are already at the up corner
        let expectedCursor = new Point([0,0]);
        let expectedRelCursor = new Point([0,0]);
        let expectedAnchor = new Point([0,0]);
        let expectedSelectionFrame = new Frame([0, 0], [0,0]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isFalse(selector.selectionFrame.isEmpty);
        assert.isTrue(selector.selectionFrame.equals(expectedSelectionFrame));

        // first move a bit to the right then back up
        selector.moveDownBy(4);
        selector.moveUpBy(2, true);
        expectedCursor = new Point([0,2]);
        expectedRelCursor = new Point([0,2]);
        expectedAnchor = new Point([0,4]);
        expectedSelectionFrame = new Frame([0, 2], [0,4]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isFalse(selector.selectionFrame.isEmpty);
        assert.isTrue(selector.selectionFrame.equals(expectedSelectionFrame));
    });
    it('Move up out of the PrimaryFrame (selecting=false)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveDownBy(50);
        selector.moveUpBy(30);
        let expectedCursor = new Point([0,0]);
        let expectedRelCursor = new Point([0,20]);
        let expectedAnchor = new Point([0,20]);
        let expectedPrimaryFrameOffset = new Point([0,20]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isTrue(selector.selectionFrame.isEmpty);
        assert.isTrue(primaryFrame.dataOffset.equals(expectedPrimaryFrameOffset));
    });
    it('Move up out of the PrimaryFrame (selecting=true)', () => {
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [10,20]);
        let selector = new Selector(primaryFrame);
        selector.moveDownBy(50);
        selector.moveUpBy(30, true);
        let expectedCursor = new Point([0,0]);
        let expectedRelCursor = new Point([0,20]);
        let expectedAnchor = new Point([0,50]);
        let expectedSelectionFrame = new Frame([0, 20], [0,50]);
        let expectedPrimaryFrameOffset = new Point([0,20]);

        assert.pointsEqual(selector.cursor, expectedCursor);
        assert.pointsEqual(selector.relativeCursor, expectedRelCursor);
        assert.pointsEqual(selector.anchor, expectedAnchor);
        assert.isFalse(selector.selectionFrame.isEmpty);
        assert.isTrue(selector.selectionFrame.equals(expectedSelectionFrame));
        assert.isTrue(primaryFrame.dataOffset.equals(expectedPrimaryFrameOffset));
    });
});
