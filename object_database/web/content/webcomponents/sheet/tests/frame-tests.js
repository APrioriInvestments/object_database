/**
 * APSheet Frame Tests
 */
const Frame = require('../src/Frame').Frame;
const Point = require('../src/Point').Point;
const chai = require('chai');
const assert = chai.assert;

describe('Frame Tests', () => {
    describe('#intersection', () => {
        it('Returns an empty Frame (A and B do not overlap)', () => {
            /* Input:
             *
             * AAAAAA
             * AAAAAA
             * AAAAAA
             * AAAAAA
             *       BBBBBB
             *       BBBBBB
             *       BBBBBB
             *       BBBBBB
             */
            let frameA = new Frame([0,0], [5, 5]);
            let frameB = new Frame([6, 6], [11, 11]);
            let result = frameA.intersection(frameB);
            assert.isTrue(result.isEmpty);
        });

        it('Returns a new Frame of same size when both are equal', () => {
            let frameA = new Frame([0,0], [5, 5]);
            let frameB = new Frame([0, 0], [5, 5]);
            let result = frameA.intersection(frameB);
            assert.isTrue(result.equals(frameA));
            assert.isTrue(result.equals(frameB));

            // Result should not be empty
            assert.isFalse(result.isEmpty);

            // Assert that these are actually different
            // object instances
            assert.isFalse(result == frameA);
            assert.isFalse(result == frameB);
        });

        it('Returns a new correct Frame when B is wholly inside of A', () => {
            /*
             * Input:
             * AAAAA
             * ABBBA
             * ABBBA
             * ABBBA
             * AAAAA
             */
            let frameA = new Frame([0,0], [4,4]);
            let frameB = new Frame([1,1], [3, 3]);
            let result = frameA.intersection(frameB);
            let reverseResult = frameB.intersection(frameA);

            // Neither result should be empty
            assert.isFalse(result.isEmpty);
            assert.isFalse(result.isEmpty);

            // The resulting frame should have
            // same origin and corner as Frame B
            assert.isTrue(result.equals(frameB));
            assert.isTrue(reverseResult.equals(frameB));
            assert.isTrue(result.equals(reverseResult));

            // The resulting Frame should be
            // a new instance
            assert.isFalse(result == frameB);
            assert.isFalse(reverseResult == frameB);
        });

        it('Returns correct Frame when B overlaps at top right of A', () => {
            /*
             * Input:
             *    BBBBBB
             *    BBBBBB
             * AAABBBBBB
             * AAABBBBBB
             * AAAAAA
             * AAAAAA
             *
             */
            let frameA = new Frame([0, 2], [5, 5]);
            let frameB = new Frame([3, 0], [8, 3]);
            let result = frameA.intersection(frameB);
            let reverseResult = frameB.intersection(frameA);
            let expectedResult = new Frame([3, 2], [5, 3]);

            // Assert that both results are equal
            assert.isTrue(result.equals(reverseResult));

            // Assert that the result equals the expected
            // result frame
            assert.isTrue(result.equals(expectedResult));
        });

        it('Returns correct Frame when B overlaps top left of A', () => {
            /*
             * Input:
             * BBBBB
             * BBBBB
             * BBBBBAA
             * BBBBBAA
             *   AAAAA
             *   AAAAA
             */
            let frameA = new Frame([2,2], [6,6]);
            let frameB = new Frame([0,0], [4, 3]);
            let result = frameA.intersection(frameB);
            let reverseResult = frameB.intersection(frameA);
            let expectedResult = new Frame([2,2], [4, 3]);

            // Assert both results equal
            assert.isTrue(result.equals(reverseResult));

            // The result should be equal to the
            // expected frame
            assert.isTrue(result.equals(expectedResult));
        });

        it('Returns correct Frame when B overlaps at top of A but not corners', () => {
            /*
             * Input:
             *  BBBB
             * ABBBBA
             * ABBBBA
             * AAAAAA
             * AAAAAA
             */
            let frameA = new Frame([0,1], [5,4]);
            let frameB = new Frame([1,0], [4,2]);
            let expected = new Frame([1,1],[4,2]);
            let result = frameA.intersection(frameB);
            let reverseResult = frameB.intersection(frameA);

            // Assert that both results are equal
            assert.isTrue(result.equals(reverseResult));

            // Assert that the result equals the
            // expected result
            assert.isTrue(result.equals(expected));
        });

        it('Returns correct Frame when B overlaps at left of A but not corners', () => {
            /*
             * Input:
             *   AAAAAA
             * BBBAAAAA
             * BBBAAAAA
             *   AAAAAA
             */
            let frameA = new Frame([2,0], [7,3]);
            let frameB = new Frame([0,1], [2,2]);
            let expected = new Frame([2,1], [2,2]);
            let result = frameA.intersection(frameB);
            let reverseResult = frameB.intersection(frameA);

            // Assert both results are equal
            assert.isTrue(result.equals(reverseResult));

            // Assert the result is equal to the
            // expected frame
            assert.isTrue(result.equals(expected));
        });

        it('Returns correct Frame when B overlaps at bottom of A but not corners', () => {
            /*
             * Input:
             * AAAAAA
             * AAAAAA
             * AABBAA
             * AABBAA
             *   BB
             */
            let frameA = new Frame([0,0], [5,3]);
            let frameB = new Frame([2,2], [3,4]);
            let expected = new Frame([2,2], [3,3]);
            let result = frameA.intersection(frameB);
            let reverseResult = frameB.intersection(frameA);

            // Assert both results are equal
            assert.isTrue(result.equals(reverseResult));

            // Assert result equals the expected frame
            assert.isTrue(result.equals(expected));
        });

        it('Returns correct Frame when B overlaps at right of A but not corners', () => {
            /*
             * Input:
             * AAAAAA
             * AAAABBBB
             * AAAABBBB
             * AAAAAA
             */
            let frameA = new Frame([0,0], [5,3]);
            let frameB = new Frame([4,1], [7,2]);
            let expected = new Frame([4,1], [5,2]);
            let result = frameA.intersection(frameB);
            let reverseResult = frameB.intersection(frameA);

            // Assert that both results are the same
            assert.isTrue(result.equals(reverseResult));

            // Assert result is equal to expected
            // frame
            assert.isTrue(result.equals(expected));
        });

        it('Returns an empty frame when one of the frames is empty', () => {
            let frameA = new Frame([0,0], [5,3]);
            let frameB = Frame.newEmpty();
            let result = frameA.intersection(frameB);
            let reverseResult = frameB.intersection(frameA);

            // Assert that both results are equal
            assert.isTrue(result.equals(reverseResult));

            // Assert that results are empty
            assert.isTrue(result.isEmpty);
            assert.isTrue(reverseResult.isEmpty);

            // Assert that the result is not the
            // same object as either of the input
            // frames
            assert.isFalse(result == frameA);
            assert.isFalse(result == frameB);
        });

        it('Returns and empty frame when both of the frames are empty', () => {
            let frameA = Frame.newEmpty();
            let frameB = Frame.newEmpty();
            let result = frameA.intersection(frameB);
            let reverseResult = frameB.intersection(frameA);

            // Assert that both results are equal
            assert.isTrue(result.equals(reverseResult));

            // Assert that results are empty
            assert.isTrue(result.isEmpty);
            assert.isTrue(reverseResult.isEmpty);

            // Assert that the result is not the
            // same object as either of the input
            // frames
            assert.isFalse(result == frameA);
            assert.isFalse(result == frameB);
        });
    });
});
