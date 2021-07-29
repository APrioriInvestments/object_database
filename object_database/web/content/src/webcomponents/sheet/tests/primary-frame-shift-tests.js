/**
 * APSheet PrimaryFrame Movement Tests
 * -----------------------------------
 * Tests concerning the movement of the PrimaryFrame over
 * its given DataFrame
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
// for each point is simply the Point itself
let exampleDataFrame = new DataFrame([0,0], [113, 113]);
exampleDataFrame.forEachPoint(aPoint => {
    exampleDataFrame.putAt(aPoint, aPoint);
});

describe('Movement Setup', () => {
    it('Has loaded a full DataFrame with stored point information', () => {
        assert.isTrue(exampleDataFrame.isFull);
    });
});

describe('PrimaryFrame Shifting with no locked cols or rows', () => {
    it('Can move right by 1 from origin position', () => {
        /* Expected move:
         * DAPPPPPBDDDDDDDDDDDD...
         * DPPPPPPPDDDDDDDDDDDD...
         * DPPPPPPPDDDDDDDDDDDD...
         * DCPPPPPEDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * P=PrimaryFrame
         * D=DataFrame
         * A=viewFrame topLeft
         * B=viewFrame topRight
         * C=viewFrame bottomLeft
         * E=viewFrame bottomRight
         */
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
        let expectedA = new Point([1, 0]);
        let expectedB = new Point([7, 0]);
        let expectedC = new Point([1, 3]);
        let expectedE = new Point([7, 3]);
        primaryFrame.shiftRightBy(1);

        let viewFrame = primaryFrame.relativeViewFrame;

        assert.pointsEqual(viewFrame.topLeft, expectedA);
        assert.pointsEqual(viewFrame.topRight, expectedB);
        assert.pointsEqual(viewFrame.bottomLeft, expectedC);
        assert.pointsEqual(viewFrame.bottomRight, expectedE);
    });

    it('Shifting right beyond DataFrame right limit results in final full viewFrame', () => {
        /* Expected move:
         * ...DDDDDDDDDDDDDAPPPPPB
         * ...DDDDDDDDDDDDDPPPPPPP
         * ...DDDDDDDDDDDDDPPPPPPP
         * ...DDDDDDDDDDDDDCPPPPPE
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * .......................
         *
         *
         * P=PrimaryFrame
         * D=DataFrame
         * A=viewFrame topLeft
         * B=viewFrame topRight
         * C=viewFrame bottomLeft
         * D=viewFrame bottomRight
         */
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
        let expectedA = new Point([
            exampleDataFrame.corner.x - primaryFrame.viewFrame.size.x,
            0
        ]);
        let expectedB = exampleDataFrame.topRight;
        let expectedC = new Point([
            exampleDataFrame.right - 6,
            3
        ]);
        let expectedE = new Point([
            exampleDataFrame.right,
            3
        ]);

        primaryFrame.shiftRightBy(exampleDataFrame.right * 3);
        let viewFrame = primaryFrame.relativeViewFrame;

        assert.pointsEqual(viewFrame.topLeft, expectedA);
        assert.pointsEqual(viewFrame.topRight, expectedB);
        assert.pointsEqual(viewFrame.bottomLeft, expectedC);
        assert.pointsEqual(viewFrame.bottomRight, expectedE);
    });

    it('Can move left by 1 from a set position in middle of DataFrame', () => {
        /* From:
         * DDDDDPPPPPPPDDDDDDDD...
         * DDDDDPPPPPPPDDDDDDDD...
         * DDDDDPPPPPPPDDDDDDDD...
         * DDDDDPPPPPPPDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * To:
         * DDDDAPPPPPBDDDDDDDDD...
         * DDDDPPPPPPPDDDDDDDDD...
         * DDDDPPPPPPPDDDDDDDDD...
         * DDDDCPPPPPEDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         * P=PrimaryFrame
         * D=DataFrame
         * A=viewFrame topLeft
         * B=viewFrame topRight
         * C=viewFrame bottomLeft
         * E=viewFrame bottomRight
         */
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
        primaryFrame.dataOffset = new Point([5, 0]); // starting point
        let expectedA = new Point([4,0]);
        let expectedB = new Point([10,0]);
        let expectedC = new Point([4,3]);
        let expectedE = new Point([10,3]);

        primaryFrame.shiftLeftBy(1);
        let viewFrame = primaryFrame.relativeViewFrame;

        assert.pointsEqual(viewFrame.topLeft, expectedA);
        assert.pointsEqual(viewFrame.topRight, expectedB);
        assert.pointsEqual(viewFrame.bottomLeft, expectedC);
        assert.pointsEqual(viewFrame.bottomRight, expectedE);
    });

    it('Shifting left beyond the dataFrame/true viewFrame left adjusts to leftmost view', () => {
        /* From:
         *
         * DDDDDPPPPPPPDDDDDDDD...
         * DDDDDPPPPPPPDDDDDDDD...
         * DDDDDPPPPPPPDDDDDDDD...
         * DDDDDPPPPPPPDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * To:
         *
         * APPPPPBDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * CPPPPPEDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         * P=PrimaryFrame
         * D=DataFrame
         * A=viewFrame topLeft
         * B=viewFrame topRight
         * C=viewFrame bottomLeft
         * E=viewFrame bottomRight
         */
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
        // Start the view at some middle point
        primaryFrame.dataOffset.x = 5;
        let expectedA = new Point([0,0]);
        let expectedB = new Point([6,0]);
        let expectedC = new Point([0,3]);
        let expectedE = new Point([6,3]);

        // Now shift an impossible amount
        // to the left.
        primaryFrame.shiftLeftBy(1000);
        let viewFrame = primaryFrame.relativeViewFrame;

        assert.pointsEqual(viewFrame.topLeft, expectedA);
        assert.pointsEqual(viewFrame.topRight, expectedB);
        assert.pointsEqual(viewFrame.bottomLeft, expectedC);
        assert.pointsEqual(viewFrame.bottomRight, expectedE);
    });

    it('Can shift down by 1 from origin position', () => {
        /* From:
         *
         * PPPPPPPDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * To:
         *
         * DDDDDDDDDDDDDDDDDDDD...
         * APPPPPBDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * CPPPPPEDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * P=PrimaryFrame
         * D=DataFrame
         * A=viewFrame topLeft
         * B=viewFrame topRight
         * C=viewFrame bottomLeft
         * D=viewFrame bottomRight
         */
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
        let expectedA = new Point([0,1]);
        let expectedB = new Point([6,1]);
        let expectedC = new Point([0,4]);
        let expectedE = new Point([6,4]);

        primaryFrame.shiftDownBy(1);
        let viewFrame = primaryFrame.relativeViewFrame;

        // Ensure all the expected points are equal
        assert.pointsEqual(viewFrame.topLeft, expectedA);
        assert.pointsEqual(viewFrame.topRight, expectedB);
        assert.pointsEqual(viewFrame.bottomLeft, expectedC);
        assert.pointsEqual(viewFrame.bottomRight, expectedE);
    });

    it('Shifting down beyond limit of dataFrame adjusts to bottom-most full view', () => {
        /* From:
         * DPPPPPPPDDDDDDDDDDDD...
         * DPPPPPPPDDDDDDDDDDDD...
         * DPPPPPPPDDDDDDDDDDDD...
         * DPPPPPPPDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * To:
         *
         * .......................
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DAPPPPPBDDDDDDDDDDDD...
         * DPPPPPPPDDDDDDDDDDDD...
         * DPPPPPPPDDDDDDDDDDDD...
         * DCPPPPPEDDDDDDDDDDDD...
         *
         * P=PrimaryFrame
         * D=DataFrame
         * A=viewFrame topLeft
         * B=viewFrame topRight
         * C=viewFrame bottomLeft
         * D=viewFrame bottomRight
         */
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
        // We start with right + 1
        primaryFrame.dataOffset.x = 1;

        let expectedA = new Point([
            1,
            exampleDataFrame.bottom - primaryFrame.viewFrame.size.y
        ]);
        let expectedB = new Point([
            7,
            exampleDataFrame.bottom - primaryFrame.viewFrame.size.y
        ]);
        let expectedC = new Point([
            1,
            exampleDataFrame.bottom
        ]);
        let expectedE = new Point([
            7,
            exampleDataFrame.bottom
        ]);

        // Now shift down by an impossible
        // amount.
        primaryFrame.shiftDownBy(exampleDataFrame.bottom * 4);
        let viewFrame = primaryFrame.relativeViewFrame;

        assert.pointsEqual(viewFrame.topLeft, expectedA);
        assert.pointsEqual(viewFrame.topRight, expectedB);
        assert.pointsEqual(viewFrame.bottomLeft, expectedC);
        assert.pointsEqual(viewFrame.bottomRight, expectedE);
    });

    it('Can shift up by 1', () => {
        /* From:
         *
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * To:
         *
         * DDDDDDDDDDDDDDDDDDDD...
         * APPPPPBDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * CPPPPPEDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * P=PrimaryFrame
         * D=DataFrame
         * A=viewFrame topLeft
         * B=viewFrame topRight
         * C=viewFrame bottomLeft
         * D=viewFrame bottomRight
         */
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
        // We start from a position that is
        // shifted down by two
        primaryFrame.dataOffset.y = 2;

        let expectedA = new Point([0,1]);
        let expectedB = new Point([6,1]);
        let expectedC = new Point([0,4]);
        let expectedE = new Point([6,4]);

        primaryFrame.shiftUpBy(1);
        let viewFrame = primaryFrame.relativeViewFrame;

        assert.pointsEqual(viewFrame.topLeft, expectedA);
        assert.pointsEqual(viewFrame.topRight, expectedB);
        assert.pointsEqual(viewFrame.bottomLeft, expectedC);
        assert.pointsEqual(viewFrame.bottomRight, expectedE);
    });

    it('Shifting up beyond limit of dataFrame adjusts to top-most view', () => {
        /* From:
         * DDDDDDDDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * To:
         *
         * APPPPPBDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * PPPPPPPDDDDDDDDDDDDD...
         * CPPPPPEDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * P=PrimaryFrame
         * D=DataFrame
         * A=viewFrame topLeft
         * B=viewFrame topRight
         * C=viewFrame bottomLeft
         * D=viewFrame bottomRight
         */
        let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
        // We begin offset down by 1
        primaryFrame.dataOffset.y = 1;

        let expectedA = new Point([0,0]);
        let expectedB = new Point([6,0]);
        let expectedC = new Point([0,3]);
        let expectedE = new Point([6,3]);

        // Shift up by an impossible
        // amount
        primaryFrame.shiftUpBy(5000);
        let viewFrame = primaryFrame.relativeViewFrame;

        assert.pointsEqual(viewFrame.topLeft, expectedA);
        assert.pointsEqual(viewFrame.topRight, expectedB);
        assert.pointsEqual(viewFrame.bottomLeft, expectedC);
        assert.pointsEqual(viewFrame.bottomRight, expectedE);
    });
});


describe('PrimaryFrame Shifting with 2 locked rows', () => {
    let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
    primaryFrame.lockRows(2);
    it('Initial view and locked row frames have correct positions', () => {
        /*
         * Setup:
         *
         * RRRRRRRDDDDDDDDDDDDD...
         * RRRRRRRDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         * V=Relative ViewFrame
         * D=DataFrame
         * R=Relative Locked rows frame
         * A=viewFrame topLeft
         * B=viewFrame topRight
         * C=viewFrame bottomLeft
         * D=viewFrame bottomRight
         */
        let relLockedRows = primaryFrame.relativeLockedRowsFrame;
        let relView = primaryFrame.relativeViewFrame;
        let expectedRowsOrigin = new Point([0,0]);
        let expectedViewOrigin = new Point([0,2]);
        let expectedRowsCorner = new Point([6,1]);
        let expectedViewCorner = new Point([6,3]);
        let expectedViewFrameSize = new Point([6,1]);

        assert.pointsEqual(relLockedRows.origin, expectedRowsOrigin);
        assert.pointsEqual(relLockedRows.corner, expectedRowsCorner);
        assert.pointsEqual(relView.origin, expectedViewOrigin);
        assert.pointsEqual(relView.corner, expectedViewCorner);
        assert.pointsEqual(primaryFrame.viewFrame.size, expectedViewFrameSize);
    });
    describe('Can shift right by 1', () => {
        /* From:
         *
         * RRRRRRRDDDDDDDDDDDDD...
         * RRRRRRRDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * To:
         *
         * DRRRRRRRDDDDDDDDDDDD...
         * DRRRRRRRDDDDDDDDDDDD...
         * DVVVVVVVDDDDDDDDDDDD...
         * DVVVVVVVDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * V=Relative ViewFrame
         * D=DataFrame
         * R=Locked rows frame
         * A=viewFrame topLeft
         * B=viewFrame topRight
         * C=viewFrame bottomLeft
         * D=viewFrame bottomRight
         */
        before(() => {
            primaryFrame.shiftRightBy(1);
        });

        it('Has correct dataOffset of (1,0)', () => {
            let expectedOffset = new Point([1,0]);
            assert.pointsEqual(primaryFrame.dataOffset, expectedOffset);
        });

        it('Has correct origin and corner for relative view', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([1,2]);
            let expectedCorner = new Point([7,3]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has correct origin and corner for relative rows frame', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOrigin = new Point([1,0]);
            let expectedCorner = new Point([7,1]);

            assert.pointsEqual(relativeRows.origin, expectedOrigin);
            assert.pointsEqual(relativeRows.corner, expectedCorner);
        });

        it('Has correct data from dataFrame at relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([1,2]);
            let expectedCornerData = new Point([7,3]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has correct data from dataFrame at relative row corners', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOriginData = new Point([1,0]);
            let expectedCornerData = new Point([7,1]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeRows.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeRows.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });

    describe('Shifting right beyond DataFrame boundary gives correct rightmost view', () => {
        /* From:
         *
         * DRRRRRRRDDDDDDDDDDDD...
         * DRRRRRRRDDDDDDDDDDDD...
         * DVVVVVVVDDDDDDDDDDDD...
         * DVVVVVVVDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * To:
         *
         * ...DDDDDDDDDDDDDRRRRRRR
         * ...DDDDDDDDDDDDDRRRRRRR
         * ...DDDDDDDDDDDDDVVVVVVV
         * ...DDDDDDDDDDDDDVVVVVVV
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * .......................
         *
         * D=DataFrame
         * V=Relative ViewFrame
         * R=Relative Locked Rows Frame
         */
        before(() => {
            primaryFrame.shiftRightBy(primaryFrame.dataFrame.right * 5);
        });

        it('Has the correct origin and corner for the relative view frame', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([
                (primaryFrame.dataFrame.right - relativeView.size.x),
                2
            ]);
            let expectedCorner = new Point([
                primaryFrame.dataFrame.right,
                3
            ]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has the correct origin and corner for the relative locked rows frame', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOrigin = new Point([
                (primaryFrame.dataFrame.right - relativeRows.size.x),
                0
            ]);
            let expectedCorner = new Point([
                (primaryFrame.dataFrame.right),
                1
            ]);

            assert.pointsEqual(relativeRows.origin, expectedOrigin);
            assert.pointsEqual(relativeRows.corner, expectedCorner);
        });

        it('Has the correct data from dataFrame at relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([
                (primaryFrame.dataFrame.right - relativeView.size.x),
                2
            ]);
            let expectedCornerData = new Point([
                primaryFrame.dataFrame.right,
                3
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);
        });

        it('Has the correct data from dataFrame at relative locked rows corners', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOriginData = new Point([
                (primaryFrame.dataFrame.right - relativeRows.size.x),
                0
            ]);
            let expectedCornerData = new Point([
                (primaryFrame.dataFrame.right),
                1
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeRows.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeRows.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });

    describe('Can shift left by 1', () => {
        /* From:
         *
         * ...DDDDDDDDDDDDDRRRRRRR
         * ...DDDDDDDDDDDDDRRRRRRR
         * ...DDDDDDDDDDDDDVVVVVVV
         * ...DDDDDDDDDDDDDVVVVVVV
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * .......................*
         *
         * To:
         *
         * ...DDDDDDDDDDDDRRRRRRRD
         * ...DDDDDDDDDDDDRRRRRRRD
         * ...DDDDDDDDDDDDVVVVVVVD
         * ...DDDDDDDDDDDDVVVVVVVD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * .......................
         *
         * D=DataFrame
         * V=Relative ViewFrame
         * R=Relative LockedRows Frame
         */
        before(() => {
            primaryFrame.shiftLeftBy(1);
        });

        it('Has correct origin and corner for relative view frame', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([
                (primaryFrame.dataFrame.right - relativeView.size.x) - 1,
                2
            ]);
            let expectedCorner = new Point([
                primaryFrame.dataFrame.right - 1,
                3
            ]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has correct origin and corner for relative locked rows frame', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOrigin = new Point([
                (primaryFrame.dataFrame.right - relativeRows.size.x) - 1,
                0
            ]);
            let expectedCorner = new Point([
                primaryFrame.dataFrame.right - 1,
                1
            ]);

            assert.pointsEqual(relativeRows.origin, expectedOrigin);
            assert.pointsEqual(relativeRows.corner, expectedCorner);
        });

        it('Has correct data from dataFrame at relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([
                (primaryFrame.dataFrame.right - relativeView.size.x) - 1,
                2
            ]);
            let expectedCornerData = new Point([
                primaryFrame.dataFrame.right - 1,
                3
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has correct data from dataFrame at relative rows frame corners', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOriginData = new Point([
                (primaryFrame.dataFrame.right - relativeRows.size.x) - 1,
                0
            ]);
            let expectedCornerData = new Point([
                primaryFrame.dataFrame.right - 1,
                1
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeRows.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeRows.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });

    describe('Shifting left beyond DataFrame boundary gives correct leftmost view', () => {
        /* From:
         *
         * ...DDDDDDDDDDDDRRRRRRRD
         * ...DDDDDDDDDDDDRRRRRRRD
         * ...DDDDDDDDDDDDVVVVVVVD
         * ...DDDDDDDDDDDDVVVVVVVD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * .......................
         *
         * To:
         *
         * RRRRRRRDDDDDDDDDDDDD...
         * RRRRRRRDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * D=DataFrame
         * V=Relative ViewFrame
         * R=Relative Locked Rows Frame
         */
        before(() => {
            // Attempt to shift left by an
            // impossible amount
            primaryFrame.shiftLeftBy(5000);
        });

        it('Has the correct origin and corner for relative view frame', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([0,2]);
            let expectedCorner = primaryFrame.corner;

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has the correct origin and corner for the relative locked rows frame', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOrigin = primaryFrame.origin;
            let expectedCorner = new Point([
                primaryFrame.corner.x,
                1
            ]);

            assert.pointsEqual(relativeRows.origin, expectedOrigin);
            assert.pointsEqual(relativeRows.corner, expectedCorner);
        });

        it('Has the correct data from dataFrame at relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([0,2]);
            let expectedCornerData = primaryFrame.corner;
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has the correct data from dataFrame at relative rows frame corners', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOriginData = primaryFrame.origin;
            let expectedCornerData = new Point([
                primaryFrame.corner.x,
                1
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeRows.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeRows.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });

    describe('Can shift down by 1', () => {
        /* From:
         *
         * RRRRRRRDDDDDDDDDDDDD...
         * RRRRRRRDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * To:
         *
         * RRRRRRRDDDDDDDDDDDDD...
         * RRRRRRRDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * D=DataFrame
         * V=Relative ViewFrame
         * R=Relative Locked Rows Frame
         */
        before(() => {
            primaryFrame.shiftDownBy(1);
        });


        it('Has the correct origin and corner for relative view', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([0,3]);
            let expectedCorner = new Point([6,4]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has the correct origin and corner for the relative locked rows frame', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOrigin = new Point([0,0]);
            let expectedCorner = new Point([6,1]);

            assert.pointsEqual(relativeRows.origin, expectedOrigin);
            assert.pointsEqual(relativeRows.corner, expectedCorner);
        });

        it('Has the correct data from dataFrame at relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([0,3]);
            let expectedCornerData = new Point([6,4]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has the correct data from dataFrame at relative locked rows corners', () =>{
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOriginData = new Point([0,0]);
            let expectedCornerData = new Point([6,1]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeRows.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeRows.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });

    describe('Shifting down beyond DataFrame boundary gives correct bottom-most view', () => {
        /* From:
         *
         * RRRRRRRDDDDDDDDDDDDD...
         * RRRRRRRDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * To:
         *
         * RRRRRRRDDDDDDDDDDDDD...
         * RRRRRRRDDDDDDDDDDDDD...
         * .......................
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         *
         * D=DataFrame
         * R=Relative Locked Rows Frame
         * V=Relative ViewFrame
         */
        before(() => {
            // Attempt to shift an impossible
            // amount downward
            primaryFrame.shiftDownBy(5000, true);
        });

        it('Has the correct dataOffset', () => {
            let totalRows = (primaryFrame.numLockedRows + primaryFrame.viewFrame.size.y);
            let yOffset = primaryFrame.dataFrame.bottom - totalRows;
            let expectedOffset = new Point([0, yOffset]);
            assert.pointsEqual(primaryFrame.dataOffset, expectedOffset);
        });

        it('Has the correct origin and corner for the relative view', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([
                0,
                primaryFrame.dataFrame.bottom - primaryFrame.viewFrame.size.y
            ]);
            let expectedCorner = new Point([
                primaryFrame.viewFrame.size.x,
                primaryFrame.dataFrame.bottom
            ]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has the correct origin and corner for the relative locked rows', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOrigin = new Point([0,0]);
            let expectedCorner = new Point([
                primaryFrame.size.x,
                1
            ]);

            assert.pointsEqual(relativeRows.origin, expectedOrigin);
            assert.pointsEqual(relativeRows.corner, expectedCorner);
        });

        it('Has the correct data from dataFrame at relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([
                0,
                primaryFrame.dataFrame.bottom - primaryFrame.viewFrame.size.y
            ]);
            let expectedCornerData = new Point([
                primaryFrame.viewFrame.size.x,
                primaryFrame.dataFrame.bottom
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has the correct data from dataFrame at relative locked rows corners', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOriginData = new Point([0,0]);
            let expectedCornerData = new Point([
                primaryFrame.size.x,
                1
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeRows.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeRows.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });

    describe('Can shift up by 1', () => {
        /* From:
         *
         * RRRRRRRDDDDDDDDDDDDD...
         * RRRRRRRDDDDDDDDDDDDD...
         * .......................
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         *
         * To:
         *
         * RRRRRRRDDDDDDDDDDDDD...
         * RRRRRRRDDDDDDDDDDDDD...
         * .......................
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         *
         * D=DataFrame
         * R=Relative Locked Rows Frame
         * V=Relative ViewFrame
         */
        before(() => {
            primaryFrame.shiftUpBy(1);
        });

        it('Has the correct origin and corner for the relative view', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([
                0,
                primaryFrame.dataFrame.bottom - 2
            ]);
            let expectedCorner = new Point([
                primaryFrame.size.x,
                primaryFrame.dataFrame.bottom - 1
            ]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has the correct origin and corner for the relative locked rows', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOrigin = new Point([0,0]);
            let expectedCorner = new Point([
                primaryFrame.size.x,
                1
            ]);

            assert.pointsEqual(relativeRows.origin, expectedOrigin);
            assert.pointsEqual(relativeRows.corner, expectedCorner);
        });

        it('Has the correct data from dataFrame at relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([
                0,
                primaryFrame.dataFrame.bottom - 2
            ]);
            let expectedCornerData = new Point([
                primaryFrame.size.x,
                primaryFrame.dataFrame.bottom - 1
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has the correct data from dataFrame at relative locked rows corners', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOriginData = new Point([0,0]);
            let expectedCornerData = new Point([
                primaryFrame.size.x,
                1
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeRows.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeRows.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });

    describe('Shifting up beyond DataFrame boundary gives correct top-most view', () => {
        /* From:
         *
         * RRRRRRRDDDDDDDDDDDDD...
         * RRRRRRRDDDDDDDDDDDDD...
         * .......................
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         *
         * To:
         *
         * RRRRRRRDDDDDDDDDDDDD...
         * RRRRRRRDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * VVVVVVVDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * D=DataFrame
         * R=Relative Locked Rows Frame
         * V=Relative ViewFrame
         */
        before(() => {
            // Attempt to shift up an
            // impossible amount
            primaryFrame.shiftUpBy(5000);
        });

        it('Has the correct dataOffset of (0,0)', () => {
            let expectedOffset = new Point([0,0]);
            assert.pointsEqual(primaryFrame.dataOffset, expectedOffset);
        });

        it('Has the correct origin and corner for the relative view', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([0,2]);
            let expectedCorner = primaryFrame.corner; // (6,3)

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has the correct origin and corner for the relative locked rows', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOrigin = new Point([0,0]);
            let expectedCorner = new Point([
                primaryFrame.size.x,
                1
            ]);

            assert.pointsEqual(relativeRows.origin, expectedOrigin);
            assert.pointsEqual(relativeRows.corner, expectedCorner);
        });

        it('Has the correct data from dataFrame for relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([0,2]);
            let expectedCornerData = primaryFrame.corner; // (6,3)
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has the correct data from dataFrame for the relative locked rows corners', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOriginData = new Point([0,0]);
            let expectedCornerData = new Point([
                primaryFrame.size.x,
                1
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeRows.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeRows.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });
});

describe('PrimaryFrame Shifting with 2 locked columns and no locked rows dataOffset(1,2)', () => {
    let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
    primaryFrame.lockColumns(2);
    primaryFrame.dataOffset.x = 1;
    primaryFrame.dataOffset.y = 2;

    describe('Can shift right by 1', () => {
        /* From:
         *
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * CCDVVVVVDDDDDDDDDDDD...
         * CCDVVVVVDDDDDDDDDDDD...
         * CCDVVVVVDDDDDDDDDDDD...
         * CCDVVVVVDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * To:
         *
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * CCDDVVVVVDDDDDDDDDDD...
         * CCDDVVVVVDDDDDDDDDDD...
         * CCDDVVVVVDDDDDDDDDDD...
         * CCDDVVVVVDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * D=DataFrame
         * V=Relative View Frame
         * C=Relative Locked Columns Frame
         */
        before(() => {
            primaryFrame.shiftRightBy(1);
        });

        it('Has the correct dataOffset', () => {
            let expectedOffset = new Point([2,2]);
            assert.pointsEqual(primaryFrame.dataOffset, expectedOffset);
        });

        it('Has the correct origin and corner for the relative view frame', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([4,2]);
            let expectedCorner = new Point([8,5]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has the correct origin and corner for the relative columns frame', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOrigin = new Point([0,2]);
            let expectedCorner = new Point([1,5]);

            assert.pointsEqual(relativeColumns.origin, expectedOrigin);
            assert.pointsEqual(relativeColumns.corner, expectedCorner);
        });

        it('Has the correct data from dataFrame at relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([4,2]);
            let expectedCornerData = new Point([8,5]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has the correct data from dataFrame at relative columns corners', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOriginData = new Point([0,2]);
            let expectedCornerData = new Point([1,5]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeColumns.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeColumns.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });

    describe('Shifting past DataFrame right limit gives us right-most view', () => {
        /* From:
         *
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * CCDDVVVVVDDDDDDDDDDD...
         * CCDDVVVVVDDDDDDDDDDD...
         * CCDDVVVVVDDDDDDDDDDD...
         * CCDDVVVVVDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * To:
         *
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * .......................
         *
         * D=DataFrame
         * V=Relative View Frame
         * C=Relative Locked Columns Frame
         */
        before(() => {
            // Shift an impossible amount to
            // the right
            primaryFrame.shiftRightBy(exampleDataFrame.right * 5);
        });

        it('Has the correct origin and corner values for relative view', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([
                primaryFrame.dataFrame.right - 4,
                2
            ]);
            let expectedCorner = new Point([
                primaryFrame.dataFrame.right,
                5
            ]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has the correct origin and corner values for relative locked columns', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOrigin = new Point([0,2]);
            let expectedCorner = new Point([1,5]);

            assert.pointsEqual(relativeColumns.origin, expectedOrigin);
            assert.pointsEqual(relativeColumns.corner, expectedCorner);
        });

        it('Has correct data from dataFrame for relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([
                primaryFrame.dataFrame.right - 4,
                2
            ]);
            let expectedCornerData = new Point([
                primaryFrame.dataFrame.right,
                5
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has correct data from dataFrame for relative columns corners', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOriginData = new Point([0,2]);
            let expectedCornerData = new Point([1,5]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeColumns.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeColumns.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });

    describe('Can shift down by 1', () => {
        /* From:
         *
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * .......................
         *
         * To:
         *
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...DDDDDDDDDDDDDDDDDDDD
         * .......................
         *
         * D=DataFrame
         * V=Relative View Frame
         * C=Relative Locked Columns Frame
         */
        before(() => {
            primaryFrame.shiftDownBy(1);
        });

        it('Has correct origin and corner for relative view', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([
                primaryFrame.dataFrame.right - 4,
                3
            ]);
            let expectedCorner = new Point([
                primaryFrame.dataFrame.right,
                6
            ]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has correct origin and corner for relative locked columns frame', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOrigin = new Point([0,3]);
            let expectedCorner = new Point([1,6]);

            assert.pointsEqual(relativeColumns.origin, expectedOrigin);
            assert.pointsEqual(relativeColumns.corner, expectedCorner);
        });

        it('Has correct data from dataFrame at relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([
                primaryFrame.dataFrame.right - 4,
                3
            ]);
            let expectedCornerData = new Point([
                primaryFrame.dataFrame.right,
                6
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has correct data from dataFrame at relative locked columns corners', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOriginData = new Point([0,3]);
            let expectedCornerData = new Point([1,6]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeColumns.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeColumns.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });

    describe('Shifting down past DataFrame bottom gives us bottom-most view', () => {
        /* From:
         *
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...DDDDDDDDDDDDDDDDDDDD
         * .......................
         *
         * To:
         *
         * .......................
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         *
         * D=DataFrame
         * V=Relative View Frame
         * C=Relative Locked Columns Frame
         */
        before(() => {
            // Shift down by an impossible amount
            primaryFrame.shiftDownBy(primaryFrame.dataFrame.bottom * 5);
        });

        it('Has the correct origin and corner for relative view', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([
                primaryFrame.dataFrame.right - 4,
                primaryFrame.dataFrame.bottom - 3
            ]);
            let expectedCorner = primaryFrame.dataFrame.corner;

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has the correct origin and corner for relative locked columns frame', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOrigin = new Point([
                0,
                primaryFrame.dataFrame.bottom - 3
            ]);
            let expectedCorner = new Point([
                1,
                primaryFrame.dataFrame.bottom
            ]);

            assert.pointsEqual(relativeColumns.origin, expectedOrigin);
            assert.pointsEqual(relativeColumns.corner, expectedCorner);
        });

        it('Has correct data from dataFrame at relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([
                primaryFrame.dataFrame.right - 4,
                primaryFrame.dataFrame.bottom - 3
            ]);
            let expectedCornerData = primaryFrame.dataFrame.corner;
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has correct data from dataFrame at relative locked columns corners', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOriginData = new Point([
                0,
                primaryFrame.dataFrame.bottom - 3
            ]);
            let expectedCornerData = new Point([
                1,
                primaryFrame.dataFrame.bottom
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeColumns.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeColumns.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });

    describe('Can shift left by 1', () => {
        /* From:
         *
         * .......................
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         * ...CCDDDDDDDDDDDDDVVVVV
         *
         * To:
         *
         * .......................
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...CCDDDDDDDDDDDDVVVVVD
         * ...CCDDDDDDDDDDDDVVVVVD
         * ...CCDDDDDDDDDDDDVVVVVD
         * ...CCDDDDDDDDDDDDVVVVVD
         *
         * D=DataFrame
         * V=Relative View Frame
         * C=Relative Locked Columns Frame
         */
        before(() => {
            primaryFrame.shiftLeftBy(1);
        });

        it('Has the correct origin and corner at relative view', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([
                primaryFrame.dataFrame.right - 5,
                primaryFrame.dataFrame.bottom - 3
            ]);
            let expectedCorner = new Point([
                primaryFrame.dataFrame.right - 1,
                primaryFrame.dataFrame.bottom
            ]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has the correct origin and corner at relative locked columns frame', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOrigin = new Point([
                0,
                primaryFrame.dataFrame.bottom - 3
            ]);
            let expectedCorner = new Point([
                1,
                primaryFrame.dataFrame.bottom
            ]);

            assert.pointsEqual(relativeColumns.origin, expectedOrigin);
            assert.pointsEqual(relativeColumns.corner, expectedCorner);
        });

        it('Has correct data from dataFrame at relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([
                primaryFrame.dataFrame.right - 5,
                primaryFrame.dataFrame.bottom - 3
            ]);
            let expectedCornerData = new Point([
                primaryFrame.dataFrame.right - 1,
                primaryFrame.dataFrame.bottom
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has correct data from dataFrame for relative locked columns corners', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOriginData = new Point([
                0,
                primaryFrame.dataFrame.bottom - 3
            ]);
            let expectedCornerData = new Point([
                1,
                primaryFrame.dataFrame.bottom
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeColumns.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeColumns.corner);
        });
    });

    describe('Shifting left beyond DataFrame left limit gives us left-most view', () => {
        /* From:
         *
         * .......................
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...CCDDDDDDDDDDDDVVVVVD
         * ...CCDDDDDDDDDDDDVVVVVD
         * ...CCDDDDDDDDDDDDVVVVVD
         * ...CCDDDDDDDDDDDDVVVVVD
         *
         * To:
         *
         * .......................
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         *
         * D=DataFrame
         * V=Relative View Frame
         * C=Relative Locked Columns Frame
         */
        before(() => {
            // Attempt to shift left by an
            // impossible amount
            primaryFrame.shiftLeftBy(50000);
        });

        it('Has the correct origin and corner at the relative view', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([
                2,
                primaryFrame.dataFrame.bottom - 3
            ]);
            let expectedCorner = new Point([
                6,
                primaryFrame.dataFrame.bottom
            ]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has correct origin and corner at relative locked columns frame', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOrigin = new Point([
                0,
                primaryFrame.dataFrame.bottom - 3
            ]);
            let expectedCorner = new Point([
                1,
                primaryFrame.dataFrame.bottom
            ]);

            assert.pointsEqual(relativeColumns.origin, expectedOrigin);
            assert.pointsEqual(relativeColumns.corner, expectedCorner);
        });

        it('Has correct data from dataFrame at relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([
                2,
                primaryFrame.dataFrame.bottom - 3
            ]);
            let expectedCornerData = new Point([
                6,
                primaryFrame.dataFrame.bottom
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has correct data from dataFrame at relative locked columns corners', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOriginData = new Point([
                0,
                primaryFrame.dataFrame.bottom - 3
            ]);
            let expectedCornerData = new Point([
                1,
                primaryFrame.dataFrame.bottom
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeColumns.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeColumns.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });

    describe('Can shift up by 1', () => {
        /* From:
         *
         * .......................
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         *
         * To:
         *
         * .......................
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         *
         * D=DataFrame
         * V=Relative View Frame
         * C=Relative Locked Columns Frame
         */
        before(() => {
            primaryFrame.shiftUpBy(1);
        });

        it('Has correct origin and corner for relative view', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([
                2,
                primaryFrame.dataFrame.bottom - 4
            ]);
            let expectedCorner = new Point([
                6,
                primaryFrame.dataFrame.bottom - 1
            ]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has correct origin and corner for relative locked columns frame', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOrigin = new Point([
                0,
                primaryFrame.dataFrame.bottom - 4
            ]);
            let expectedCorner = new Point([
                1,
                primaryFrame.dataFrame.bottom - 1
            ]);

            assert.pointsEqual(relativeColumns.origin, expectedOrigin);
            assert.pointsEqual(relativeColumns.corner, expectedCorner);
        });

        it('Has correct data from dataFrame for relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([
                2,
                primaryFrame.dataFrame.bottom - 4
            ]);
            let expectedCornerData = new Point([
                6,
                primaryFrame.dataFrame.bottom - 1
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has correct data from dataFrame for relative locked columns corners', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOriginData = new Point([
                0,
                primaryFrame.dataFrame.bottom - 4
            ]);
            let expectedCornerData = new Point([
                1,
                primaryFrame.dataFrame.bottom - 1
            ]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeColumns.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeColumns.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });

    describe('Shifting up beyond DataFrame top gives us the top-most view', () => {
        /* From:
         *
         * .......................
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         *
         * To:
         *
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * CCVVVVVDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * D=DataFrame
         * V=Relative View Frame
         * C=Relative Locked Columns Frame
         */
        before(() => {
            // Attempt to shift up by
            // an impossible amount
            primaryFrame.shiftUpBy(50000);
        });

        it('Has the correct origin and corner for the relative view', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            console.log(primaryFrame.dataOffset);
            let expectedOrigin = new Point([2,0]);
            let expectedCorner = new Point([6,3]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Has the correct origin and corner for relative locked columnsf frame', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOrigin = new Point([0,0]);
            let expectedCorner = new Point([1,3]);

            assert.pointsEqual(relativeColumns.origin, expectedOrigin);
            assert.pointsEqual(relativeColumns.corner, expectedCorner);
        });

        it('Has the correct data from dataFrame at relative view corners', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOriginData = new Point([2,0]);
            let expectedCornerData = new Point([6,3]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeView.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeView.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });

        it('Has the correct data from dataFrame at relative locked columns corners', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOriginData = new Point([0,0]);
            let expectedCornerData = new Point([1,3]);
            let actualOriginData = primaryFrame.dataFrame.getAt(relativeColumns.origin);
            let actualCornerData = primaryFrame.dataFrame.getAt(relativeColumns.corner);

            assert.pointsEqual(actualOriginData, expectedOriginData);
            assert.pointsEqual(actualCornerData, expectedCornerData);
        });
    });
});

describe('PrimaryFrame Shifting Tests 2 locked rows 1 locked column dataOffset(4,4)', () => {
    it.skip('Should be implemented!');
});

describe('Miscallaneous from Origin Position, 1 locked col 2 locked rows, no dataOffset', () => {
    /* Starting with:
       *
       * URRRRRRDDDDDDDDDDDDD...
       * URRRRRRDDDDDDDDDDDDD...
       * CVVVVVVDDDDDDDDDDDDD...
       * CVVVVVVDDDDDDDDDDDDD...
       * DDDDDDDDDDDDDDDDDDDD...
       * DDDDDDDDDDDDDDDDDDDD...
       * DDDDDDDDDDDDDDDDDDDD...
       * DDDDDDDDDDDDDDDDDDDD...
       * .......................
       *
       * D=DataFrame
       * V=Relative View Frame'
       * C=Relative Locked Columns Frame
       * R=Relative Locked Rows Frame
       * U=Intersect of Locked rows and columns
       */
    let primaryFrame = new PrimaryFrame(exampleDataFrame, [6,3]);
    primaryFrame.lockRows(2);
    primaryFrame.lockColumns(1);

    it('Should have the correct dataOffset of (0,0)', () => {
        let expectedOffset = new Point([0,0]);
        assert.pointsEqual(primaryFrame.dataOffset, expectedOffset);
    });

    it('Should have the correct origin and corner for relative view', () => {
        let relativeView = primaryFrame.relativeViewFrame;
        let expectedOrigin = new Point([1,2]);
        let expectedCorner = new Point([6,3]);

        assert.pointsEqual(relativeView.origin, expectedOrigin);
        assert.pointsEqual(relativeView.corner, expectedCorner);
    });

    it('Should have correct origin and corner for relative rows frame', () => {
        let relativeRows = primaryFrame.relativeLockedRowsFrame;
        let expectedOrigin = new Point([1,0]);
        let expectedCorner = new Point([6,1]);

        assert.pointsEqual(relativeRows.origin, expectedOrigin);
        assert.pointsEqual(relativeRows.corner, expectedCorner);
    });

    it('Should have correct origin and corner for locked columns frame', () => {
        let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
        let expectedOrigin = new Point([0,2]);
        let expectedCorner = new Point([0,3]);

        assert.pointsEqual(relativeColumns.origin, expectedOrigin);
        assert.pointsEqual(relativeColumns.corner, expectedCorner);
    });

    it('Should have correct origin and corner for locked intersect frame', () => {
        let intersectFrame = primaryFrame.lockedFramesIntersect;
        assert.isFalse(intersectFrame.isEmpty);
        let expectedOrigin = new Point([0,0]);
        let expectedCorner = new Point([0,1]);

        assert.pointsEqual(intersectFrame.origin, expectedOrigin);
        assert.pointsEqual(intersectFrame.corner, expectedCorner);
    });

    describe('Shift right by 1', () => {
        /* From:
         *
         * URRRRRRDDDDDDDDDDDDD...
         * URRRRRRDDDDDDDDDDDDD...
         * CVVVVVVDDDDDDDDDDDDD...
         * CVVVVVVDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * To:
         *
         * UDRRRRRRDDDDDDDDDDDD...
         * UDRRRRRRDDDDDDDDDDDD...
         * CDVVVVVVDDDDDDDDDDDD...
         * CDVVVVVVDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * DDDDDDDDDDDDDDDDDDDD...
         * .......................
         *
         * D=DataFrame
         * V=Relative View Frame'
         * C=Relative Locked Columns Frame
         * R=Relative Locked Rows Frame
         * U=Intersect of Locked rows and columns
         */
        before(() => {
            primaryFrame.shiftRightBy(1);
        });

        it('Should have correct dataOffset of (1,0)', () => {
            let expectedOffset = new Point([1,0]);
            assert.pointsEqual(primaryFrame.dataOffset, expectedOffset);
        });

        it('Should have correct origin and corner for relative view', () => {
            let relativeView = primaryFrame.relativeViewFrame;
            let expectedOrigin = new Point([2,2]);
            let expectedCorner = new Point([7,3]);

            assert.pointsEqual(relativeView.origin, expectedOrigin);
            assert.pointsEqual(relativeView.corner, expectedCorner);
        });

        it('Should have correct origin and corner for relative locked rows frame', () => {
            let relativeRows = primaryFrame.relativeLockedRowsFrame;
            let expectedOrigin = new Point([2,0]);
            let expectedCorner = new Point([7,1]);

            assert.pointsEqual(relativeRows.origin, expectedOrigin);
            assert.pointsEqual(relativeRows.corner, expectedCorner);
        });

        it('Should have correct origin and corner for relative locked columns frame', () => {
            let relativeColumns = primaryFrame.relativeLockedColumnsFrame;
            let expectedOrigin = new Point([0,2]);
            let expectedCorner = new Point([0,3]);
        });

        it('Should have correct origin and corner for locked frames intersect frame', () => {
            let intersectFrame = primaryFrame.lockedFramesIntersect;
            let expectedOrigin = new Point([0,0]);
            let expectedCorner = new Point([0,1]);

            assert.pointsEqual(intersectFrame.origin, expectedOrigin);
            assert.pointsEqual(intersectFrame.corner, expectedCorner);
        });
    });
});


// Init an example 1000x1000 dataFrame
const bigDataFrame = new DataFrame([0,0], [999,999]);
describe('Misc Shift Tests', () => {
    describe('Shifting right twice', () => {
        // 20x20 primaryFrame
        let primaryFrame = new PrimaryFrame(bigDataFrame, [19,19]);
        primaryFrame.lockRows(2);
        primaryFrame.lockColumns(2);
        it('Initial shift to total right puts us at the data end', () => {
            // Shift an impossible amount right
            // (should take us to the end)
            primaryFrame.shiftRightBy(bigDataFrame.corner.x * 3);
            let expectedRelX = primaryFrame.dataFrame.corner.x;

            assert.equal(primaryFrame.relativeViewFrame.corner.x, expectedRelX);
            assert.equal(primaryFrame.relativeLockedRowsFrame.corner.x, expectedRelX);
        });

        it('Attempting to shift to right again by 1 shouldnt change anything', () => {
            primaryFrame.shiftRightBy(1);
            let expectedRelX = primaryFrame.dataFrame.corner.x;

            assert.equal(primaryFrame.relativeViewFrame.corner.x, expectedRelX);
            assert.equal(primaryFrame.relativeLockedRowsFrame.corner.x, expectedRelX);
        });
    });

    describe('Shifting down twice', () => {
        // 20x20 primaryFrame
        let primaryFrame = new PrimaryFrame(bigDataFrame, [19,19]);
        primaryFrame.lockRows(2);
        primaryFrame.lockColumns(2);
        it('Initial shift to bottom puts us at data bottom', () => {
            // Shift down by an impossible amount.
            // (should stop us at bottom)
            primaryFrame.shiftDownBy(bigDataFrame.corner.y * 3);
            let expectedRelY = primaryFrame.dataFrame.corner.y;

            assert.equal(
                primaryFrame.relativeViewFrame.corner.y,
                expectedRelY
            );
            assert.equal(
                primaryFrame.relativeLockedColumnsFrame.corner.y,
                expectedRelY
            );
        });

        it('Attempting to shift down by 1 shouldnt change anything', () => {
            primaryFrame.shiftDownBy(1);
            let expectedRelY = primaryFrame.dataFrame.corner.y;

            assert.equal(
                primaryFrame.relativeViewFrame.corner.y,
                expectedRelY
            );
            assert.equal(
                primaryFrame.relativeLockedColumnsFrame.corner.y,
                expectedRelY
            );
        });
    });
});
