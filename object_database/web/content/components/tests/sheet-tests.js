/*
 * Tests for Message Handling in NewCellHandler
 */
require('jsdom-global')();
const maquette = require('maquette');
const h = maquette.h;
const NewCellHandler = require('../../NewCellHandler.js').default;
const chai = require('chai');
const assert = chai.assert;
let projector = maquette.createProjector();
const registry = require('../../ComponentRegistry').ComponentRegistry;
const Point = require('../util/SheetUtils.js').Point;
const Frame = require('../util/SheetUtils.js').Frame;
const CompositeFrame = require('../util/SheetUtils.js').CompositeFrame;
const DataFrame = require('../util/SheetUtils.js').DataFrame;

/* Example Messages and Structures */
let simpleRoot = {
    id: "page_root",
    cellType: "RootCell",
    parentId: null,
    nameInParent: null,
    extraData: {},
    namedChildren: {}
};

let simpleSheet = {
    id: 6,
    cellType: "Sheet",
    extraData: {dontFetch: true},
    namedChildren: {}
};

let makeUpdateMessage = (compDescription) => {
    return Object.assign({}, compDescription, {
        channel: "#main",
        type: "#cellUpdated",
        shouldDisplay: true
    });
};

let makeCreateMessage = (compDescription) => {
    return Object.assign({}, compDescription, {
        channel: "#main",
        type: "#cellUpdated",
        shouldDisplay: true
    });
};

let makeDiscardedMessage = (compDescription) => {
    return Object.assign({}, compDescription, {
        channel: "#main",
        type: "#cellDiscarded"
    });
};

describe("Sheet util tests.", () => {
    describe("Point class tests.", () => {
        before(() => {
        });
        after(() => {
        });
        it("Getters", () => {
            let p = new Point([10, 20]);
            assert.equal(p.x, 10);
            assert.equal(p.y, 20);
        })
        it("Setters", () => {
            let p = new Point();
            p.x = 0;
            p.y = 1;
            assert.equal(p.x, 0);
            assert.equal(p.y, 1);
        })
        it("Equals", () => {
            let p = new Point([0, 0]);
            assert.isTrue(p.equals(p));
            let another_p = new Point([0, 0]);
            assert.isTrue(p.equals(another_p));
            another_p = new Point([1, 0]);
            assert.isFalse(p.equals(another_p));
        })
        it("String representation", () => {
            let p = new Point([10, 20]);
            assert.equal(p.toString(), "10,20");
            p = new Point();
            assert.equal(p.toString(), "NaN");
        })
        it("isNaN", () => {
            let p = new Point();
            assert.isTrue(p.isNaN);
            p = new Point(null);
            assert.isTrue(p.isNaN);
            p = new Point(undefined);
            assert.isTrue(p.isNaN);
            p = new Point([0, 0]);
            assert.isFalse(p.isNaN);
            p = new Point([1, 0]);
            assert.isFalse(p.isNaN);
            p = new Point([0, 1]);
            assert.isFalse(p.isNaN);
            p = new Point([1, 1]);
            assert.isFalse(p.isNaN);
        })
        it("Quadrant", () => {
            let p = new Point([1, 1]);
            assert.equal(p.quadrant, 1);
            p = new Point([1, -1]);
            assert.equal(p.quadrant, 2);
            p = new Point([-1, -1]);
            assert.equal(p.quadrant, 3);
            p = new Point([-1, 1]);
            assert.equal(p.quadrant, 4);
        })
        it("Quadrant (edge cases)", () => {
            let p = new Point([0, 0]);
            assert.equal(p.quadrant, 1);
            p = new Point([0, -1]);
            assert.equal(p.quadrant, 2);
            p = new Point([-1, 0]);
            assert.equal(p.quadrant, 3);
        })
        it("Translate", () => {
            let p = new Point([10, 20]);
            p.translate(new Point([1, 2]));
            assert.equal(p.x, 11);
            assert.equal(p.y, 22);
            p.translate([1, 2]);
            assert.equal(p.x, 12);
            assert.equal(p.y, 24);
        })
    })
    describe("Frame class tests.", () => {
        before(() => {
        });
        after(() => {
        });
        it("Name", () => {
            let frame = new Frame([0, 0], [9, 19], name="myframe");
            assert.equal(frame.name, "myframe");
            frame = new Frame([0, 0], [9, 19]);
            frame.setName = "myname";
            assert.equal(frame.name, "myframe");
        })
        it("Dimension", () => {
            let frame = new Frame([0, 0], [9, 19]);
            assert.equal(frame.dim, 2);
            assert.isFalse(isNaN(frame.dim));
        })
        it("Dimension of single point frame", () => {
            let frame = new Frame([0, 0], [0, 0]);
            assert.equal(frame.dim, 0);
            assert.isFalse(isNaN(frame.dim));
        })
        it("Dimension of empty frame", () => {
            frame = new Frame();
            assert.isTrue(isNaN(frame.dim));
            frame = new Frame([0, 0], undefined);
            assert.isTrue(isNaN(frame.dim));
            frame = new Frame(undefined, [0, 0]);
            assert.isTrue(isNaN(frame.dim));
        })
        it("Size", () => {
            frame = new Frame([1, 5], [5, 7]);
            assert.equal(frame.size.x, 5);
            assert.equal(frame.size.y, 3);
        })
        it("Size of empty frame", () => {
            frame = new Frame();
            assert.isTrue(isNaN(frame.size));
            frame = new Frame([0, 0], undefined);
            assert.isTrue(isNaN(frame.size));
            frame = new Frame(undefined, [0, 0]);
            assert.isTrue(isNaN(frame.size));
        })
        it("Equality", () => {
            let frame = new Frame([0, 0], [1, 1]);
            assert.isTrue(frame.equals(frame));
            let another_frame = new Frame([0, 0], [1, 1]);
            assert.isTrue(frame.equals(another_frame));
            another_frame = new Frame([0, 0], [2, 2]);
            assert.isFalse(frame.equals(another_frame));
        })
        it("Invalid dimension frame (negative coordinates)", () => {
            try {
                let frame = new Frame([0, 0], [-1, 0]);
            } catch(e) {
                assert.equal(e,"Both 'origin' and 'corner' must be of non-negative coordinates");
            }
            try {
                let frame = new Frame([-1, 0], [1, 0]);
            } catch(e) {
                assert.equal(e,"Both 'origin' and 'corner' must be of non-negative coordinates");
            }
        })
        it("Invalid dimension frame (reversed corner and origin)", () => {
            try {
                let frame = new Frame([1, 1], [0, 0]);
            } catch(e) {
                assert.equal(e,"Origin must be top-left and corner bottom-right");
            }
        })
        it("Is empty", () => {
            frame = new Frame();
            assert.isTrue(frame.empty);
        })
        it("Setting a new origin", () => {
            let frame = new Frame([0, 0], [7, 9]);
            assert.equal(frame.origin.x, 0);
            assert.equal(frame.origin.y, 0);
            frame.setOrigin = [5, 7];
            assert.equal(frame.origin.x, 5);
            assert.equal(frame.origin.y, 7);
            let coords = [];
            for (let x = 5; x <= 7; x++){
                for (let y = 7; y <= 9; y++){
                    coords.push(new Point([x, y]));
                }
            }
            assert.equal(coords.length, frame.coords.length);
            let coords_str = coords.map((item) => {return item.toString()});
            let frame_coords_str = frame.coords.map((item) => {return item.toString()});
            for (let i = 0; i < coords_str.length; i++){
                assert.isTrue(frame_coords_str.includes(coords_str[i]));
            }
        })
        it("Setting a new corner", () => {
            let frame = new Frame([5, 7], [9, 9]);
            assert.equal(frame.corner.x, 9);
            assert.equal(frame.corner.y, 9);
            frame.setCorner = [7, 9];
            assert.equal(frame.corner.x, 7);
            assert.equal(frame.corner.y, 9);
            let coords = [];
            for (let x = 5; x <= 7; x++){
                for (let y = 7; y <= 9; y++){
                    coords.push(new Point([x, y]));
                }
            }
            assert.equal(coords.length, frame.coords.length);
            let coords_str = coords.map((item) => {return item.toString()});
            let frame_coords_str = frame.coords.map((item) => {return item.toString()});
            for (let i = 0; i < coords_str.length; i++){
                assert.isTrue(frame_coords_str.includes(coords_str[i]));
            }
        })
        it("Coords", () => {
            let frame = new Frame([5, 7], [7, 9]);
            let coords = [];
            for (let x = 5; x <= 7; x++){
                for (let y = 7; y <= 9; y++){
                    coords.push(new Point([x, y]));
                }
            }
            assert.equal(coords.length, frame.coords.length);
            let coords_str = coords.map((item) => {return item.toString()});
            let frame_coords_str = frame.coords.map((item) => {return item.toString()});
            for (let i = 0; i < coords_str.length; i++){
                assert.isTrue(frame_coords_str.includes(coords_str[i]));
            }
        })
        it("Contaiment (array)", () => {
            let frame = new Frame([0, 0], [10, 10]);
            assert.isTrue(frame.contains([5, 5]));
            assert.isFalse(frame.contains([15, 15]));
            assert.isFalse(frame.contains([-5, 5]));
        })
        it("Contaiment (string rep)", () => {
            let frame = new Frame([0, 0], [10, 10]);
            assert.isTrue(frame.contains("5,5"));
            assert.isFalse(frame.contains("15, 15"));
            assert.isFalse(frame.contains("-5, 5"));
        })
        it("Contaiment (point)", () => {
            let frame = new Frame([0, 0], [10, 10]);
            let point = new Point([1, 1]);
            assert.isTrue(frame.contains(point));
            point = new Point([15, 15]);
            assert.isFalse(frame.contains(point));
        })
        it("Contaiment (frame)", () => {
            let frame = new Frame([0, 0], [10, 10]);
            let another_frame = new Frame([1, 1], [9, 9]);
            assert.isTrue(frame.contains(another_frame));
            another_frame = new Frame([0, 0], [10, 10]);
            assert.isTrue(frame.contains(another_frame));
            another_frame = new Frame([1, 1], [19, 19]);
            assert.isFalse(frame.contains(another_frame));
            another_frame = new Frame([11, 11], [19, 19]);
            assert.isFalse(frame.contains(another_frame));
        })
        it("Contaiment (exception)", () => {
            let frame = new Frame([0, 0], [10, 10]);
            try {
                frame.contains("NOT A POINT")
            } catch(e) {
                assert.equal(e, "You must pass a length 2 array, a Point, or a Frame");
            }
        })
        it("Coords of empty frame", () => {
            frame = new Frame();
            assert.equal(0, frame.coords.length);
        })
        it("Coords slice", () => {
            // x-axis
            let frame = new Frame([0, 0], [10, 10]);
            let slice_x = [];
            for (let x = 0; x <= 10; x++){
                slice_x.push(new Point([x, 5]))
            }
            let slice_x_str = slice_x.map((item) => {return item.toString()});
            let frame_slice_x_str = frame.coords_slice(5, "x").map((item) => {return item.toString()});
            assert.equal(slice_x.length, frame_slice_x_str.length);
            for (let i = 0; i < slice_x_str.length; i++){
                assert.isTrue(frame_slice_x_str.includes(slice_x_str[i]));
            }
            // y-axis
            let slice_y = [];
            for (let y = 0; y <= 10; y++){
                slice_y.push(new Point([5, y]))
            }
            assert.equal(slice_x.length, frame.coords_slice(5, "y").length);
            let slice_y_str = slice_y.map((item) => {return item.toString()});
            let frame_slice_y_str = frame.coords_slice(5, "y").map((item) => {return item.toString()});
            for (let i = 0; i < slice_y_str.length; i++){
                assert.isTrue(frame_slice_y_str.includes(slice_y_str[i]));
            }
        })
        it("Coords slice (empty)", () => {
            let frame = new Frame([0, 0], [10, 10]);
            try {
                frame.coords_slice(100, "x")
            } catch(e){
                assert.equal(e, "Index out of range");
            }
            try {
                frame.coords_slice(100, "y")
            } catch(e){
                assert.equal(e, "Index out of range");
            }
        })
        it("Translate up right", () => {
            let frame = new Frame([3, 4], [5, 6]);
            assert.equal(frame.dim, 2);
            let coords = [];
            for (let x = 3; x <= 5; x++){
              for (let y = 4; y <= 6; y++){
                  coords.push(new Point([x, y]));
              }
            }
            assert.equal(coords.length, frame.coords.length);
            let coords_str = coords.map((item) => {return item.toString()});
            let frame_coords_str = frame.coords.map((item) => {return item.toString()});
            for (let i = 0; i < coords_str.length; i++){
                assert.isTrue(frame_coords_str.includes(coords_str[i]));
            }
            // now translate
            frame.translate([2, 3]);
            assert.equal(frame.dim, 2);
            coords = [];
            for (let x = 5; x <= 7; x++){
              for (let y = 7; y <= 9; y++){
                  coords.push(new Point([x, y]));
              }
            }
            assert.equal(coords.length, frame.coords.length);
            coords_str = coords.map((item) => {return item.toString()});
            frame_coords_str = frame.coords.map((item) => {return item.toString()});
            for (let i = 0; i < coords_str.length; i++){
                assert.isTrue(frame_coords_str.includes(coords_str[i]));
            }
        })
        it("Translate none", () => {
            let frame = new Frame([3, 4], [5, 6]);
            assert.equal(frame.dim, 2);
            let coords = [];
            for (let x = 3; x <= 5; x++){
              for (let y = 4; y <= 6; y++){
                  coords.push(new Point([x, y]));
              }
            }
            assert.equal(coords.length, frame.coords.length);
            let coords_str = coords.map((item) => {return item.toString()});
            let frame_coords_str = frame.coords.map((item) => {return item.toString()});
            for (let i = 0; i < coords_str.length; i++){
                assert.isTrue(frame_coords_str.includes(coords_str[i]));
            }
            // now translate
            frame.translate([0, 0]);
            assert.equal(frame.dim, 2);
            assert.equal(coords.length, frame.coords.length);
            coords_str = coords.map((item) => {return item.toString()});
            frame_coords_str = frame.coords.map((item) => {return item.toString()});
            for (let i = 0; i < coords_str.length; i++){
                assert.isTrue(frame_coords_str.includes(coords_str[i]));
            }
        })
        it("Translate down left", () => {
            let frame = new Frame([3, 4], [5, 6]);
            assert.equal(frame.dim, 2);
            let coords = [];
            for (let x = 3; x <= 5; x++){
              for (let y = 4; y <= 6; y++){
                  coords.push(new Point([x, y]));
              }
            }
            assert.equal(coords.length, frame.coords.length);
            let coords_str = coords.map((item) => {return item.toString()});
            let frame_coords_str = frame.coords.map((item) => {return item.toString()});
            for (let i = 0; i < coords_str.length; i++){
                assert.isTrue(frame_coords_str.includes(coords_str[i]));
            }
            // now translate
            frame.translate([-1, -1]);
            coords = [];
            for (let x = 2; x <= 4; x++){
              for (let y = 3; y <= 5; y++){
                  coords.push(new Point([x, y]));
              }
            }
            assert.equal(frame.dim, 2);
            assert.equal(coords.length, frame.coords.length);
            coords_str = coords.map((item) => {return item.toString()});
            frame_coords_str = frame.coords.map((item) => {return item.toString()});
            for (let i = 0; i < coords_str.length; i++){
                assert.isTrue(frame_coords_str.includes(coords_str[i]));
            }
        })
        it("Translate (not in place)", () => {
            let frame = new Frame([3, 4], [5, 6]);
            assert.equal(frame.dim, 2);
            let coords = [];
            for (let x = 3; x <= 5; x++){
              for (let y = 4; y <= 6; y++){
                  coords.push(new Point([x, y]));
              }
            }
            assert.equal(coords.length, frame.coords.length);
            let coords_str = coords.map((item) => {return item.toString()});
            let frame_coords_str = frame.coords.map((item) => {return item.toString()});
            for (let i = 0; i < coords_str.length; i++){
                assert.isTrue(frame_coords_str.includes(coords_str[i]));
            }
            // now translate
            frame = frame.translate([-1, -1], inplace=false);
            coords = [];
            for (let x = 2; x <= 4; x++){
              for (let y = 3; y <= 5; y++){
                  coords.push(new Point([x, y]));
              }
            }
            assert.equal(frame.dim, 2);
            assert.equal(coords.length, frame.coords.length);
            coords_str = coords.map((item) => {return item.toString()});
            frame_coords_str = frame.coords.map((item) => {return item.toString()});
            for (let i = 0; i < coords_str.length; i++){
                assert.isTrue(frame_coords_str.includes(coords_str[i]));
            }
        })
        it("Translate out of quadrant 1", () => {
            let frame = new Frame([3, 4], [5, 6]);
            assert.equal(frame.dim, 2);
            let coords = [];
            for (let x = 3; x <= 5; x++){
              for (let y = 4; y <= 6; y++){
                  coords.push(new Point([x, y]));
              }
            }
            assert.equal(coords.length, frame.coords.length);
            let coords_str = coords.map((item) => {return item.toString()});
            let frame_coords_str = frame.coords.map((item) => {return item.toString()});
            for (let i = 0; i < coords_str.length; i++){
                assert.isTrue(frame_coords_str.includes(coords_str[i]));
            }
            // now translate
            try {
                frame.translate([-10, -1]);
            } catch(e){
                assert.equal(e, "Invalid translation: new 'origin' and 'corner' must be of non-negative coordinates");
            }
        })
        it("Intersect (arrangement A)", () => {
            let frame = new Frame([0, 0], [10, 10]);
            // basic overlap
            let another_frame = new Frame([5, 5], [15, 15]);
            let intersection = frame.intersect(another_frame);
            assert.exists(intersection);
            let test_intersection = new Frame([5, 5], [10, 10]);
            assert.isTrue(intersection.equals(test_intersection));
            // contained
            another_frame = new Frame([1, 1], [9, 9]);
            intersection = frame.intersect(another_frame);
            assert.exists(intersection);
            test_intersection = new Frame([1, 1], [9, 9]);
            assert.isTrue(intersection.equals(test_intersection));
            // not contained
            another_frame = new Frame([11, 11], [19, 19]);
            intersection = frame.intersect(another_frame);
            assert.exists(intersection);
            assert.isTrue(intersection.empty);
        })
        it("Intersect (arrangement B)", () => {
            let frame = new Frame([10, 10], [20, 20]);
            // basic overlap
            let another_frame = new Frame([0, 0], [15, 15]);
            let intersection = frame.intersect(another_frame);
            assert.exists(intersection);
            let test_intersection = new Frame([10, 10], [15, 15]);
            assert.isTrue(intersection.equals(test_intersection));
            // contained
            another_frame = new Frame([11, 11], [19, 19]);
            intersection = frame.intersect(another_frame);
            assert.exists(intersection);
            test_intersection = new Frame([11, 11], [19, 19]);
            assert.isTrue(intersection.equals(test_intersection));
            // not contained
            another_frame = new Frame([0, 0], [5, 5]);
            intersection = frame.intersect(another_frame);
            assert.exists(intersection);
            assert.isTrue(intersection.empty);
        })
        it("Intersect (empty frame)", () => {
            let frame = new Frame([0, 0], [10, 10]);
            let another_frame = new Frame();
            let intersection = frame.intersect(another_frame);
            assert.isTrue(intersection.empty);
            frame = new Frame();
            another_frame = new Frame([0, 0], [10, 10]);
            intersection = frame.intersect(another_frame);
            assert.isTrue(intersection.empty);
        })
        it("Map (not strict)", () => {
            // contained
            let frame = new Frame([0, 0], [10, 10]);
            let anotherFrame = new Frame([5, 4], [9, 10]);
            let mappedFrame = anotherFrame.map(frame, new Point([2, 2]));
            assert.isTrue(mappedFrame.equals(new Frame([2, 2], [6, 8])));
            // not contained
            frame = new Frame([0, 0], [10, 10]);
            anotherFrame = new Frame([5, 4], [20, 20]);
            mappedFrame = anotherFrame.map(frame, new Point([2, 2]));
            assert.isTrue(mappedFrame.equals(new Frame([2, 2], [10, 10])));
        })
        it("Map (strict)", () => {
            // contained
            let frame = new Frame([0, 0], [10, 10]);
            let anotherFrame = new Frame([5, 4], [9, 10]);
            let mappedFrame = anotherFrame.map(frame, new Point([2, 2]), strict=true);
            assert.isTrue(mappedFrame.equals(new Frame([2, 2], [6, 8])));
            // not contained
            frame = new Frame([0, 0], [10, 10]);
            anotherFrame = new Frame([5, 4], [20, 20]);
            mappedFrame = anotherFrame.map(frame, new Point([2, 2]), strict=true);
            assert.isTrue(mappedFrame.equals(new Frame()));
        })
        it("Map (exception)", () => {
            // contained
            let frame = new Frame([0, 0], [10, 10]);
            let anotherFrame = new Frame([5, 4], [9, 10]);
            try {
                let mappedFrame = anotherFrame.map(frame, new Point([20, 30]), strict=true);
            } catch(e) {
                assert.equal(e, "the specified origin is not contained in the provided frame.");
            }
        })
    })
    describe("CompositeFrame class tests.", () => {
        before(() => {
        });
        after(() => {
        });
        it("BaseFrame", () => {
            try {
                new CompositeFrame("a", [])
            } catch(e) {
                assert.equal(e, "baseFrame must be a Fram class object");
            }
            let frame = new DataFrame([0, 0], [10, 10]);
            assert.isTrue(new CompositeFrame(baseFrame=frame, []) instanceof CompositeFrame);
        })
        it("overlayFrames consistency", () => {
            let baseFrame = new DataFrame([0, 0], [10, 10]);
            let overlayFrames = [
                {frame: new Frame([1, 1], [5, 5], "frame0"), origin: new Point([1, 1])},
                {frame: new Frame([0, 0], [1, 1], "frame1"), origin: new Point([0, 0])}
            ]
            assert.exists(new CompositeFrame(baseFrame, overlayFrames));
            overlayFrames.push({frame: new Frame([1, 1], [11, 5], name="badframe"), origin: new Point([1, 1])});
            try {
                new CompositeFrame(baseFrame, overlayFrames);
            } catch (e) {
                assert.equal(e, "frame named 'badframe' will not project/fit into baseFrame");
            }
        })
        it("Translation", () => {
            let baseFrame = new DataFrame([0, 0], [10, 10]);
            let overlayFrames = [
                {frame: new Frame([1, 1], [5, 5], "frame0"), origin: new Point([1, 1])},
                {frame: new Frame([0, 0], [1, 1], "frame1"), origin: new Point([0, 0])}
            ]
            let composition = new CompositeFrame(baseFrame, overlayFrames);
            let p = new Point([10, 10]);
            composition.translate(p);
            assert.isTrue(composition.baseFrame.equals(baseFrame));
            composition.overlayFrames.map((frame, index) => {
                overlayFrames[index]["frame"].translate(p);
                assert.isTrue(frame["frame"].equals(overlayFrames[index]["frame"]));
            })
        })
        it("Translation (with baseFrame)", () => {
            let baseFrame = new DataFrame([0, 0], [10, 10]);
            let overlayFrames = [
                {frame: new Frame([1, 1], [5, 5], "frame0"), origin: new Point([1, 1])},
                {frame: new Frame([0, 0], [1, 1], "frame1"), origin: new Point([0, 0])}
            ]
            let composition = new CompositeFrame(baseFrame, overlayFrames);
            let p = new Point([10, 10]);
            composition.translate(p, true);
            baseFrame.translate(p);
            assert.isTrue(composition.baseFrame.equals(baseFrame));
            composition.overlayFrames.map((frame, index) => {
                overlayFrames[index]["frame"].translate(p);
                assert.isTrue(frame["frame"].equals(overlayFrames[index]["frame"]));
            })
        })
        it("Get Overlay Frame by Name", () => {
            let baseFrame = new DataFrame([0, 0], [10, 10]);
            let overlayFrames = [
                {frame: new Frame([1, 1], [5, 5], "frame0"), origin: new Point([1, 1])},
                {frame: new Frame([0, 0], [1, 1], "frame1"), origin: new Point([0, 0])}
            ]
            let composition = new CompositeFrame(baseFrame, overlayFrames);
            let frame = composition.getOverlayFrame("frame0");
            assert.isTrue(frame.equals(overlayFrames[0]["frame"]));
            frame = composition.getOverlayFrame("noname");
            assert.equal(frame, null);
        })
        it("Equals", () => {
            let baseFrame = new DataFrame([0, 0], [10, 10]);
            let overlayFrames = [
                {frame: new Frame([1, 1], [5, 5], "frame0"), origin: new Point([1, 1])},
                {frame: new Frame([0, 0], [1, 1], "frame1"), origin: new Point([0, 0])}
            ]
            let composition = new CompositeFrame(baseFrame, overlayFrames);
            let anotherComposition = new CompositeFrame(baseFrame, overlayFrames);
            assert.isTrue(composition.equals(anotherComposition));
        })
        it("(not) Equals", () => {
            let baseFrame = new DataFrame([0, 0], [10, 10]);
            let overlayFrames = [
                {frame: new Frame([1, 1], [5, 5], "frame0"), origin: new Point([1, 1])},
                {frame: new Frame([0, 0], [1, 1], "frame1"), origin: new Point([0, 0])}
            ]
            let anotherOverlayFrames = [
                {frame: new Frame([0, 0], [1, 1], "frame1"), origin: new Point([0, 0])}
            ]
            let composition = new CompositeFrame(baseFrame, overlayFrames);
            let anotherComposition = new CompositeFrame(baseFrame, anotherOverlayFrames);
            assert.isFalse(composition.equals(anotherComposition));
            anotherOverlayFrames = [
                {frame: new Frame([0, 0], [1, 1], "frame1"), origin: new Point([0, 0])},
                {frame: new Frame([0, 0], [4, 4], "frame2"), origin: new Point([0, 0])}
            ]
            anotherComposition = new CompositeFrame(baseFrame, anotherOverlayFrames);
            assert.isFalse(composition.equals(anotherComposition));
            let anotherBaseFrame = new DataFrame([0, 0], [11, 13]);
            anotherComposition = new CompositeFrame(anotherBaseFrame, overlayFrames);
            assert.isFalse(composition.equals(anotherComposition));
        })
        it.skip("Map (not strict)", () => {
            // contained
            let frame = new DataFrame([0, 0], [20, 20]);
            let baseFrame = new DataFrame([0, 0], [10, 10]);
            let overlayFrames = [
                {frame: new Frame([1, 1], [5, 5], "frame0"), origin: new Point([1, 1])},
                {frame: new Frame([0, 0], [1, 1], "frame1"), origin: new Point([0, 0])}
            ]
            let composition = new CompositeFrame(baseFrame, overlayFrames);
            let mappedComposition = composition.map(frame, new Point([1, 1]));
            let testBaseFrame = new DataFrame([1, 1], [11, 11]);
            let testOverlayFrames = [
                {frame: new Frame([2, 2], [6, 6], "frame0"), origin: new Point([2, 2])},
                {frame: new Frame([1, 1], [2, 2], "frame1"), origin: new Point([1, 1])}
            ]
            let testComposition = new CompositeFrame(testBaseFrame, testOverlayFrames);
            assert.isTrue(mappedComposition.equals(testComposition));
            // not contained
            baseFrame = new DataFrame([0, 0], [30, 30]);
            overlayFrames = [
                    new Frame([1, 1], [25, 25]),
                    new Frame([0, 0], [1, 1]),
            ]
            composition = new CompositeFrame(baseFrame, overlayFrames);
            mappedComposition = composition.map(frame, new Point([1, 1]));
            testBaseFrame = new DataFrame([1, 1], [20, 20]);
            testOverlayFrames = [
                {frame: new Frame([2, 2], [20, 20], "frame0"), origin: new Point([2, 2])},
                {frame: new Frame([1, 1], [2, 2], "frame1"), origin: new Point([1, 1])}
            ]
            testComposition = new CompositeFrame(testBaseFrame, testOverlayFrames);
            assert.isTrue(mappedComposition.equals(testComposition));
        })
        it.skip("Map (strict)", () => {
            let frame = new DataFrame([0, 0], [20, 20]);
            let baseFrame = new DataFrame([0, 0], [10, 10]);
            let overlayFrames = [
                {frame: new Frame([1, 1], [5, 5], "frame0"), origin: new Point([1, 1])},
                {frame: new Frame([0, 0], [1, 1], "frame1"), origin: new Point([0, 0])}
            ]
            let composition = new CompositeFrame(baseFrame, overlayFrames);
            let mappedComposition = composition.map(frame, new Point([1, 1]), strict=true);
            let testBaseFrame = new DataFrame([1, 1], [11, 11]);
            let testOverlayFrames = [
                {frame: new Frame([2, 2], [6, 6], "frame0"), origin: new Point([2, 2])},
                {frame: new Frame([1, 1], [2, 2], "frame1"), origin: new Point([1, 1])}
            ]
            let testComposition = new CompositeFrame(testBaseFrame, testOverlayFrames);
            assert.isTrue(mappedComposition.equals(testComposition));
            baseFrame = new DataFrame([0, 0], [30, 30]);
            overlayFrames = [
                {frame: new Frame([1, 1], [5, 5], "frame0"), origin: new Point([1, 1])},
                {frame: new Frame([0, 0], [1, 1], "frame1"), origin: new Point([0, 0])}
            ]
            composition = new CompositeFrame(baseFrame, overlayFrames);
            mappedComposition = composition.map(frame, new Point([1, 1]), strict=true);
            testBaseFrame = new DataFrame();
            testOverlayFrames = []
            testComposition = new CompositeFrame(testBaseFrame, testOverlayFrames);
            assert.isTrue(mappedComposition.equals(testComposition));
        })
    })
    describe("DataFrame class tests.", () => {
        before(() => {
        });
        after(() => {
        });
        it("Load data (origin [0, 0])", () => {
            let frame = new DataFrame([0, 0], [10, 10]);
            let data = [
                [0, 0], [0, 1], [1, 1]
            ]
            let origin = new Point([0, 0]);
            frame.load(data, origin);
            for (let y = 0; y < data.length; y++){
                let x_slice = data[y];
                for (let x = 0; x < x_slice.length; x++){
                    let coord = [x + origin.x, y + origin.y];
                    assert.equal(frame.store[coord.toString()], x_slice[x]);
                }
            }
        })
        it("Load data (origin [0, 0] as array)", () => {
            let frame = new DataFrame([0, 0], [10, 10]);
            let data = [
                [0, 0], [0, 1], [1, 1]
            ]
            let origin = [0, 0];
            frame.load(data, origin);
            for (let y = 0; y < data.length; y++){
                let x_slice = data[y];
                for (let x = 0; x < x_slice.length; x++){
                    let coord = [x + origin[0], y + origin[1]];
                    assert.equal(frame.store[coord.toString()], x_slice[x]);
                }
            }
        })
        it("Load data (origin random)", () => {
            let frame = new DataFrame([0, 0], [10, 10]);
            let data = [
                [0, 0], [0, 1], [1, 1]
            ]
            let origin = new Point([5, 5]);
            frame.load(data, origin);
            for (let y = 0; y < data.length; y++){
                let x_slice = data[y];
                for (let x = 0; x < x_slice.length; x++){
                    let coord = [x + origin.x, y + origin.y];
                    assert.equal(frame.store[coord.toString()], x_slice[x]);
                }
            }
        })
        it("Load data (bad origin)", () => {
            let frame = new DataFrame([0, 0], [10, 10]);
            let data = [];
            let origin = new Point([11, 11]);
            try {
                frame.load(data, origin);
            } catch(e){
                assert.equal(e, "Origin is outside of frame.");
            }
        })
        it("Load data (bad y-dim origin)", () => {
            let frame = new DataFrame([0, 0], [10, 10]);
            let data = [
                [0, 0], [0, 1], [1, 1]
            ]
            let origin = new Point([9, 9]);
            try {
                frame.load(data, origin);
            } catch(e){
                assert.equal(e, "Data + origin surpass frame y-dimension.");
            }
        })
        it("Load data (bad y-dim data)", () => {
            let frame = new DataFrame([0, 0], [10, 10]);
            let data = [
                [0, 0], [0, 1], [1, 1],
                [0, 0], [0, 1], [1, 1],
                [0, 0], [0, 1], [1, 1],
                [0, 0], [0, 1], [1, 1],
                [0, 0], [0, 1], [1, 1],
            ]
            let origin = new Point([0, 0]);
            try {
                frame.load(data, origin);
            } catch(e){
                assert.equal(e, "Data + origin surpass frame y-dimension.");
            }
        })
        it("Load data (bad x-dim data)", () => {
            let frame = new DataFrame([0, 0], [10, 10]);
            let data = [
                [0, 0], [0, 1], [1, 1, 1],
            ]
            let origin = new Point([9, 8]);
            try {
                frame.load(data, origin);
            } catch(e){
                assert.equal(e, "Data + origin surpass frame x-dimension.");
            }
        })
        it("Get frame.store value (valid coordinate string)", () => {
            let frame = new DataFrame([0, 0], [10, 10]);
            let data = [
                [0, 0], [0, 1], [1, 1]
            ]
            let origin = new Point([5, 5]);
            frame.load(data, origin);
            assert.equal(frame.get([5, 5].toString()), 0);
            assert.equal(frame.get([6, 6].toString()), 1);
            assert.equal(frame.get([9, 9].toString()), undefined);
        })
        it("Get frame.store value (valid coordinate Array)", () => {
            let frame = new DataFrame([0, 0], [10, 10]);
            let data = [
                [0, 0], [0, 1], [1, 1]
            ]
            let origin = new Point([5, 5]);
            frame.load(data, origin);
            assert.equal(frame.get([5, 5]), 0);
            assert.equal(frame.get([6, 6]), 1);
            assert.equal(frame.get([9, 9]), undefined);
        })
        it("Get frame.store value (valid coordinate Point)", () => {
            let frame = new DataFrame([0, 0], [10, 10]);
            let data = [
                [0, 0], [0, 1], [1, 1]
            ]
            let origin = new Point([5, 5]);
            frame.load(data, origin);
            assert.equal(frame.get(new Point([5, 5])), 0);
            assert.equal(frame.get(new Point([6, 6])), 1);
            assert.equal(frame.get(new Point([9, 9])), undefined);
        })
        it("Get frame.store value (invalid coordinate)", () => {
            let frame = new DataFrame([0, 0], [10, 10]);
            try {
                frame.get([20, 20].toString());
            } catch(e) {
                assert.equal(e, "Coordinate not in frame.");
            }
            try {
                frame.get([20, 20]);
            } catch(e) {
                assert.equal(e, "Coordinate not in frame.");
            }
            try {
                frame.get(new Point([20, 20]));
            } catch(e) {
                assert.equal(e, "Coordinate not in frame.");
            }
        })
    })
})

describe.skip("Sheet and Update Data Tests", () => {
    var handler;
    before(() => {
        handler = new NewCellHandler(h, projector, registry);
        let rootEl = document.createElement('div');
        rootEl.id = "page_root";
        document.body.append(rootEl);
        let createMessage = makeCreateMessage(simpleRoot);
        handler.receive(createMessage);
    });
    after(() => {
        let rootEl = document.getElementById('page_root');
        if(rootEl){
            rootEl.remove();
        }
    });
    it("Creates a Sheet component", () => {
        let child = Object.assign({}, simpleSheet, {
            parentId: simpleRoot.id,
            nameInParent: 'child'
        });
        let updatedParent = Object.assign({}, simpleRoot, {
            namedChildren: {
                child: child
            }
        });
        assert.notExists(handler.activeComponents[child.id]);
        let updateMessage = makeUpdateMessage(updatedParent);
        handler.receive(updateMessage);
        let stored = handler.activeComponents[child.id];
        assert.exists(stored);
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
    });
    it("Loads initial data into a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
        // assert.equal(stored.column_names, null);
        column_names = ["col1", "col2", "col3"],
        data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
            ["index3", 3, 4, 5],
        ]
        let updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "replace",
                column_names : column_names,
                data : data
            }
        }
        handler.receive(updateMessage);
        assert.equal(body.children.length, data.length);
        assert.equal(head.children.length, column_names.length + 1); // recall we always have the placeholder, column 0
    });
    it("Replacing data in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
        column_names = ["col1", "col2", "col3"],
        data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
            ["index3", 3, 4, 5],
            ["index4", 2, 3, 4],
            ["index5", 3, 4, 5],
            ["index6", 4, 5, 6],
        ]
        let updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "replace",
                column_names : column_names,
                data : data
            }
        }
        handler.receive(updateMessage);
        assert.equal(body.children.length, data.length);
        assert.equal(head.children.length, column_names.length + 1); // recall we always have the placeholder, column 0
    });
    it("Row append in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
        column_names = ["col1", "col2", "col3"]
        let data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
            ["index3", 3, 4, 5],
            ["index4", 2, 3, 4],
            ["index5", 3, 4, 5],
            ["index6", 4, 5, 6],
        ]
        let updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "replace",
                column_names : column_names,
                data : data
            }
        }
        handler.receive(updateMessage);
        let new_data = [
            ["index7", 4, 5, 6],
            ["index8", 4, 5, 6],
        ]
        updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "append",
                axis: "row",
                data : new_data
            }
        }
        handler.receive(updateMessage);
        assert.equal(body.children.length, data.length); // recall the total data length is stable
        assert.equal(head.children.length, column_names.length + 1); // recall we always have the placeholder, column 0
        assert.equal(body.firstChild.firstChild.textContent, data[new_data.length][0])
        assert.equal(body.lastChild.firstChild.textContent, new_data[1][0])
    });
    it("Row prepend in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
        column_names = ["col1", "col2", "col3"]
        let data = [
            ["index3", 3, 4, 5],
            ["index4", 2, 3, 4],
            ["index5", 3, 4, 5],
            ["index6", 4, 5, 6],
            ["index7", 4, 5, 6],
            ["index8", 4, 5, 6],
        ]
        let updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "replace",
                column_names : column_names,
                data : data
            }
        }
        handler.receive(updateMessage);
        let new_data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
        ]

        updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "prepend",
                axis: "row",
                data : new_data
            }
        }
        handler.receive(updateMessage);
        assert.equal(body.children.length, data.length); // recall the total data length is stable
        assert.equal(head.children.length, column_names.length + 1); // recall we always have the placeholder, column 0
        assert.equal(body.firstChild.firstChild.textContent, new_data[0][0])
        assert.equal(body.lastChild.firstChild.textContent, data[data.length - new_data.length -1][0])
    });
    it("Column prepend in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
        column_names = ["col3", "col4", "col5"]
        let data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
            ["index3", 3, 4, 5],
        ]
        let updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "replace",
                column_names : column_names,
                data : data
            }
        }
        handler.receive(updateMessage);
        new_column_names = ["col1", "col2"]
        let new_data = [
            ['index1', 'a11', 'a21'],
            ['index2', 'b21', 'b22'],
            ['index3', 'c31', 'c23'],
        ]
        updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "prepend",
                axis: "column",
                column_names: new_column_names,
                data : new_data
            }
        }
        handler.receive(updateMessage);
        assert.equal(body.children.length, data.length); // recall the total data length is stable
        assert.equal(head.children.length, column_names.length + 1); // recall we always have the placeholder, column 0
        assert.equal(head.children[1].textContent, new_column_names[0])
        assert.equal(body.firstChild.children[1].firstChild.textContent, new_data[0][1])
        assert.equal(head.lastChild.textContent, column_names[column_names.length - new_column_names.length - 1])
        assert.equal(body.firstChild.lastChild.firstChild.textContent, data[0][data.length - new_data.length + 1])
    });
    it("Column append in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
        column_names = ["col1", "col2", "col3"]
        let data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
            ["index3", 3, 4, 5],
        ]
        let updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "replace",
                column_names : column_names,
                data : data
            }
        }
        handler.receive(updateMessage);
        new_column_names = ["col4", "col5"]
        let new_data = [
            ['index1', 1, 2],
            ['index2', 1, 2],
            ['index3', 1, 2],
        ]
        updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "append",
                axis: "column",
                column_names: new_column_names,
                data : new_data
            }
        }
        handler.receive(updateMessage);
        assert.equal(body.children.length, data.length); // recall the total data length is stable
        assert.equal(head.children.length, column_names.length + 1); // recall we always have the placeholder, column 0
        assert.equal(head.lastChild.textContent, new_column_names[new_column_names.length - 1])
        assert.equal(body.firstChild.lastChild.firstChild.textContent, new_data[0][new_data[0].length - 1])
        assert.equal(head.children[1].textContent, column_names[new_column_names.length - 1])
        assert.equal(body.firstChild.children[1].firstChild.textContent, data[0][new_data.length - 1])
    });
    it("Column append row number mismatch fail in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
        column_names = ["col1", "col2", "col3"]
        let data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
            ["index3", 3, 4, 5],
        ]
        let updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "replace",
                column_names : column_names,
                data : data
            }
        }
        handler.receive(updateMessage);
        new_column_names = ["col4", "col5"]
        let new_data = [
            ['index1', 1, 2],
            ['index2', 1, 2],
        ]
        updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "append",
                axis: "column",
                column_names: new_column_names,
                data : new_data
            }
        }
        try {
            handler.receive(updateMessage);
        } catch(e) {
            assert.equal(e, "Incoming number of rows don't match current sheet");
        }
    });
    it("Column append row index mismatch fail in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
        column_names = ["col1", "col2", "col3"]
        let data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
            ["index3", 3, 4, 5],
        ]
        let updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "replace",
                column_names : column_names,
                data : data
            }
        }
        handler.receive(updateMessage);
        new_column_names = ["col4", "col5"]
        let new_data = [
            ['index1', 1, 2],
            ['index2', 1, 2],
            ['BAD_INDEX', 1, 2],
        ]
        updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "append",
                axis: "column",
                column_names: new_column_names,
                data : new_data
            }
        }
        try {
            handler.receive(updateMessage);
        } catch(e) {
            assert.equal(e, "Sheet row index index3 does not match incoming row index BAD_INDEX");
        }
    });
});
