/**
 * APSheet DataFrame data loading/copying tests
 * --------------------------------------------
 * This module tests the loading (from arrays)
 * and projecting (to arrays) of data from a
 * DataFrame
 */
require('jsdom-global')();
const Frame = require('../src/Frame').Frame;
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

describe('Projecting total source frame to dest frame', () => {
    let sourceFrame = new DataFrame([0,0], [1000,1000]);
    sourceFrame.forEachPoint(aPoint => {
        sourceFrame.putAt(aPoint, aPoint);
    });
    let destFrame = new DataFrame([0,0], [2000,2000]);
    let desiredSubframe = new Frame([50,30], [100,100]);

    it('Can output array data of correct size', () => {
        let arrayData = sourceFrame.getDataArrayForFrame(
            desiredSubframe
        );

        assert.equal(arrayData.length, desiredSubframe.size.y + 1);
        assert.equal(arrayData[0].length, desiredSubframe.size.x + 1);
    });

    it('Can load the arrayed data correctly into the dest data frame', () => {
        let arrayData = sourceFrame.getDataArrayForFrame(
            desiredSubframe
        );
        destFrame.loadFromArray(
            arrayData,
            desiredSubframe.origin
        );

        assert.pointsEqual(
            sourceFrame.getAt(desiredSubframe.origin),
            destFrame.getAt(desiredSubframe.origin)
        );

        assert.pointsEqual(
            sourceFrame.getAt(desiredSubframe.corner),
            destFrame.getAt(desiredSubframe.corner)
        );
    });
});
