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
// for each point is simply the string representation
// of the Point.
let exampleDataFrame = new DataFrame([0,0], [113, 113]);
exampleDataFrame.forEachPoint(aPoint => {
    let stringRep = aPoint.toString();
    exampleDataFrame.putAt(aPoint, stringRep);
});

describe('Movement Setup', () => {
    it('Has loaded a full DataFrame with stored point information', () => {
        assert.isTrue(exampleDataFrame.isFull);
    });
});

describe('PrimaryFrame with no locked cols or rows', () => {
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





/* Expected move:
         * .......................
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDDDDDDDD
         * ...DDDDDDDDDDDDDAPPPPPB
         * ...DDDDDDDDDDDDDPPPPPPP
         * ...DDDDDDDDDDDDDPPPPPPP
         * ...DDDDDDDDDDDDDCPPPPPE
         *
         * P=PrimaryFrame
         * D=DataFrame
         * A=viewFrame topLeft
         * B=viewFrame topRight
         * C=viewFrame bottomLeft
         * D=viewFrame bottomRight
         */
