/**
 * APSheet PrimaryFrame Layout Tests
 * ---------------------------------
 * Tests for accuracy of layouts when
 * using various locked rows, locked
 * columns, and dataOffsets in the
 * PrimaryFrame.
 * Goals:
 * - Ensure that relative points in
 *   the PrimaryFrame are correct
 *   for each part (viewFrame etc)
 * - Ensure that the dataOffset
 *   is appropriate and returns
 *   correct data in a given
 *   sub-frame (viewFrme or a locked
 *   frame).
 */
require('jsdom-global')();
const PrimaryFrame = require('../src/PrimaryFrame').PrimaryFrame;
const DataFrame = require('../src/DataFrame').DataFrame;
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
let exampleDataFrame = new DataFrame([0,0], [113, 113]);
exampleDataFrame.forEachPoint(aPoint => {
    exampleDataFrame.putAt(aPoint, aPoint);
});


describe('PrimaryFrame Layout with no locked rows or columns and dataOffset (2,2)', () => {
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
     * DDDDDDDDDDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * DDVVVVVVVDDDDDDDDDDD...
     * DDVVVVVVVDDDDDDDDDDD...
     * DDVVVVVVVDDDDDDDDDDD...
     * DDVVVVVVVDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * .......................
     *
     * D=DataFrame
     * V= Relative view frame
     */

    let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
    primaryFrame.dataOffset.x = 2;
    primaryFrame.dataOffset.y = 2;
    it('Has a correct origin and corner for the internal viewFrame', () => {
        let expectedOrigin = new Point([0,0]);
        let expectedCorner = primaryFrame.corner;

        assert.pointsEqual(primaryFrame.viewFrame.origin, expectedOrigin);
        assert.pointsEqual(primaryFrame.viewFrame.corner, expectedCorner);
    });

    it('Has correct origin and corner for relative view frame (dataOffset adjusted)', () => {
        let relativeView = primaryFrame.relativeViewFrame;
        let expectedOrigin = new Point([2,2]);
        let expectedCorner = new Point([
            primaryFrame.corner.x + primaryFrame.dataOffset.x,
            primaryFrame.corner.y + primaryFrame.dataOffset.y
        ]);

        assert.pointsEqual(relativeView.origin, expectedOrigin);
        assert.pointsEqual(relativeView.corner, expectedCorner);
    });

    it('Has correct data values at relative view corners', () => {
        let relativeView = primaryFrame.relativeViewFrame;
        let expectedDataOrigin = new Point([2,2]);
        let expectedDataCorner = new Point([8,5]);
        let actualDataOrigin = exampleDataFrame.getAt(relativeView.origin);
        let actualDataCorner = exampleDataFrame.getAt(relativeView.corner);

        assert.pointsEqual(actualDataOrigin, expectedDataOrigin);
        assert.pointsEqual(actualDataCorner, expectedDataCorner);
    });
});

describe('PrimaryFrame Layout with 2 locked rows, no columns and dataOffset(2,1)', () => {
    /*
     * PrimaryFrame Layout:
     *
     * RRRRRRR
     * RRRRRRR
     * VVVVVVV
     * VVVVVVV
     *
     * R=Internal LockedRows Frame
     * V=Internal View Frame
     *
     * Relative to DataFrame:
     *
     * DDRRRRRRRDDDDDDDDDDD...
     * DDRRRRRRRDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * DDVVVVVVVDDDDDDDDDDD...
     * DDVVVVVVVDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * .......................
     * R=Relative LockedRowsFrame
     * V=Relative ViewFrame
     * D=DataFrame
     */
    let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
    primaryFrame.lockRows(2);
    primaryFrame.dataOffset.x = 2;
    primaryFrame.dataOffset.y = 1;
    it('Has correct origin and corner for internal viewFrame', () => {
        let expectedOrigin = new Point([0,2]); // Pushed down by 2 lockrows
        let expectedCorner = primaryFrame.corner;

        assert.pointsEqual(primaryFrame.viewFrame.origin, expectedOrigin);
        assert.pointsEqual(primaryFrame.viewFrame.corner, expectedCorner);
    });

    it('Has correct origin and corner for the internal lockedRowsFrame', () => {
        let expectedOrigin = new Point([0,0]);
        let expectedCorner = new Point([
            primaryFrame.corner.x,
            primaryFrame.numLockedRows - 1
        ]);

        assert.pointsEqual(primaryFrame.lockedRowsFrame.origin, expectedOrigin);
        assert.pointsEqual(primaryFrame.lockedRowsFrame.corner, expectedCorner);
    });

    it('Has correct origin and corner for relative view frame', () => {
        let relativeView = primaryFrame.relativeViewFrame;
        let expectedOrigin = new Point([2,3]);
        let expectedCorner = new Point([8,4]);
        console.log(relativeView);

        assert.pointsEqual(relativeView.origin, expectedOrigin);
        assert.pointsEqual(relativeView.corner, expectedCorner);
    });

    it('Has correct origin and corner for the relative locked rows frame', () => {
        let relativeRows = primaryFrame.relativeLockedRowsFrame;
        let expectedOrigin = new Point([2,0]);
        let expectedCorner = new Point([8,1]);

        assert.pointsEqual(relativeRows.origin, expectedOrigin);
        assert.pointsEqual(relativeRows.corner, expectedCorner);
    });

    it('Has correct data values in corners of relative locked rows frame', () => {
        let expectedOriginData = new Point([2,0]);
        let expectedCornerData = new Point([8,1]);
        let relativeRows = primaryFrame.relativeLockedRowsFrame;
        let actualOriginData = exampleDataFrame.getAt(relativeRows.origin);
        let actualCornerData = exampleDataFrame.getAt(relativeRows.corner);

        assert.pointsEqual(actualOriginData, expectedOriginData);
        assert.pointsEqual(actualCornerData, expectedCornerData);
    });

    it('Has correct data values in corners of the relative view frame', () => {
        let relativeView = primaryFrame.relativeViewFrame;
        let expectedOriginData = new Point([2,3]);
        let expectedCornerData = new Point([8,4]);
        let actualOriginData = exampleDataFrame.getAt(relativeView.origin);
        let actualCornerData = exampleDataFrame.getAt(relativeView.corner);

        assert.pointsEqual(actualOriginData, expectedOriginData);
        assert.pointsEqual(actualCornerData, expectedCornerData);
    });
});


describe('PrimaryFrame Layout with 2 locked rows, 2 locked columns, and dataOffset(1,2)', () => {
    /*
     * PrimaryFrame Layout:
     *
     * UURRRRR
     * UURRRRR
     * CCVVVVV
     * CCVVVVV
     *
     * R=Internal LockedRowsFrame
     * C=Internal LockedColumnsFrame
     * V=Internal ViewFrame
     * U=Columns/Rows Overlap
     *
     *
     * Relative to DataFrame:
     *
     * DDDRRRRRRRDDDDDDDDDD...
     * DDDRRRRRRRDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * CCDVVVVVDDDDDDDDDDDD...
     * CCDVVVVVDDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * .......................
     * D=DataFrame
     * R=Relative LockedRows Frame
     * C=Relative LockedColumns Frame
     * V=Relative ViewFrame
     */
    let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
    primaryFrame.lockRows(2);
    primaryFrame.lockColumns(2);
    primaryFrame.dataOffset.x = 1;
    primaryFrame.dataOffset.y = 2;

    it('Has correct origin and corner for internal viewFrame', () => {
        let expectedOrigin = new Point([2,2]);
        let expectedCorner = new Point([6,3]);

        assert.pointsEqual(
            primaryFrame.viewFrame.origin,
            expectedOrigin
        );
        assert.pointsEqual(
            primaryFrame.viewFrame.corner,
            expectedCorner
        );
    });

    it('Has correct origin and corner for internal lockedRowsFrame', () => {
        let expectedOrigin = new Point([0,0]);
        let expectedCorner = new Point([
            primaryFrame.corner.x,
            1
        ]);
        let lockedRows = primaryFrame.lockedRowsFrame;

        assert.pointsEqual(lockedRows.origin, expectedOrigin);
        assert.pointsEqual(lockedRows.corner, expectedCorner);
    });

    it('Has correct origin and corner for internal lockedColumnsFrame', () => {
        let expectedOrigin = new Point([0,0]);
        let expectedCorner = new Point([
            1,
            primaryFrame.corner.y
        ]);
        let lockedColumns = primaryFrame.lockedColumnsFrame;

        assert.pointsEqual(lockedColumns.origin, expectedOrigin);
        assert.pointsEqual(lockedColumns.corner, expectedCorner);
    });

    it('Has correct origin and corner for relative view frame', () => {
        let relativeView = primaryFrame.relativeViewFrame;
        let expectedOrigin = new Point([3,4]);
        let expectedCorner = new Point([7,5]);

        assert.pointsEqual(relativeView.origin, expectedOrigin);
        assert.pointsEqual(relativeView.corner, expectedCorner);
    });

    it('Has correct data values at corners for relative view frame', () => {
        let relativeView = primaryFrame.relativeViewFrame;
        let expectedOriginData = new Point([3,4]);
        let expectedCornerData = new Point([7,5]);
        let actualOriginData = exampleDataFrame.getAt(relativeView.origin);
        let actualCornerData = exampleDataFrame.getAt(relativeView.corner);

        assert.pointsEqual(actualOriginData, expectedOriginData);
        assert.pointsEqual(actualCornerData, expectedCornerData);
    });

    it('Has correct origin and corner for relative locked rows frame', () => {
        let relativeRows = primaryFrame.relativeLockedRowsFrame;
        let expectedOrigin = new Point([3,0]);
        let expectedCorner = new Point([
            primaryFrame.corner.x + primaryFrame.dataOffset.x,
            1
        ]);

        assert.pointsEqual(relativeRows.origin, expectedOrigin);
        assert.pointsEqual(relativeRows.corner, expectedCorner);
    });

    it('Has correct data values at corners for relative locked rows frame', () => {
        let relativeRows = primaryFrame.relativeLockedRowsFrame;
        let expectedOriginData = new Point([3,0]);
        let expectedCornerData = new Point([
            primaryFrame.corner.x + primaryFrame.dataOffset.x,
            1
        ]);
        let actualOriginData = exampleDataFrame.getAt(relativeRows.origin);
        let actualCornerData = exampleDataFrame.getAt(relativeRows.corner);

        assert.pointsEqual(actualOriginData, expectedOriginData);
        assert.pointsEqual(actualCornerData, expectedCornerData);
    });

    it('Has correct origin and corner for relative locked columns frame', () => {
        let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
        let expectedOrigin = new Point([0,4]);
        let expectedCorner = new Point([1,5]);

        assert.pointsEqual(relativeColumns.origin, expectedOrigin);
        assert.pointsEqual(relativeColumns.corner, expectedCorner);
    });

    it('Has correct data values at corners for relative locked columns frame', () => {
        let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
        let expectedOriginData = new Point([0,4]);
        let expectedCornerData = new Point([1,5]);
        let actualOriginData = exampleDataFrame.getAt(relativeColumns.origin);
        let actualCornerData = exampleDataFrame.getAt(relativeColumns.corner);

        assert.pointsEqual(actualOriginData, expectedOriginData);
        assert.pointsEqual(actualCornerData, expectedCornerData);
    });
});

describe('Larger PrimaryFrame with 3 locked rows test dataOffset(0,1)', () => {
    /* DataFrame Relative:
     *
     * RRRRRRRRDDDDDDDDDDDD...
     * RRRRRRRRDDDDDDDDDDDD...
     * RRRRRRRRDDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * VVVVVVVVDDDDDDDDDDDD...
     * VVVVVVVVDDDDDDDDDDDD...
     * VVVVVVVVDDDDDDDDDDDD...
     * VVVVVVVVDDDDDDDDDDDD...
     * VVVVVVVVDDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * DDDDDDDDDDDDDDDDDDDD...
     * .......................
     *
     * V=Relative ViewFrame
     * D=DataFrame
     * R=Relative LockedRows Frame
     */
    let primaryFrame = new PrimaryFrame(exampleDataFrame, [7,7]);
    primaryFrame.lockRows(3);
    primaryFrame.dataOffset.y = 1;
    it('Has correct origin and corner for relative view frame', () => {
        let relativeView = primaryFrame.relativeViewFrame;
        let expectedOrigin = new Point([0,4]);
        let expectedCorner = new Point([7,8]);

        assert.pointsEqual(relativeView.origin, expectedOrigin);
        assert.pointsEqual(relativeView.corner, expectedCorner);
    });
});
