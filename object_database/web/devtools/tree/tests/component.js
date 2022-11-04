/**
  * Core tests for the Tree component
  **/

import chai from "chai";
const assert = chai.assert;

import { Tree } from '../tree.js';

describe("Tree Component Tests", () => {
    const tree = document.createElement("my-tree");
    beforeEach(() => {
    });
    it("Ok", () => {
        assert.equal(tree.ok, "ok");
    });
})


