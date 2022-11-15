/**
  * Core tests for the Tree component
  **/

import chai from "chai";
import crypto from 'crypto';
import { Tree } from '../tree.js';
const assert = chai.assert;

const treeMaker = function(depth, maxChildNum){
    let rootNode = {
        name: "root",
        id: "roodID",
        order: -1,
        children: []
    };
    rootNode = addChildren(rootNode, 0, depth, maxChildNum);
    return rootNode;
}

const addChildren = (node, depth, totalDepth, maxChildNum) => {
    const numChildren = Math.ceil(Math.random()* maxChildNum);
    if (depth <= totalDepth) {
        for (let i = 1; i <= numChildren; i++){
            const child = {
                name: `node_${depth}_${i}`,
                id: "id-" + crypto.randomUUID(),
                order: i,
                children: []
            };
            node.children.push(
                addChildren(child, depth + 1, totalDepth, maxChildNum)
            );

        }
    }
    return node;
}


describe("Tree Component Tests", () => {
    let tree;
    let data
    before(() => {
        tree = document.createElement("tree-graph");
        data = treeMaker(3, 2);
        tree.setup(data);
        document.body.append(tree);
    });
    it("Assert the tree exists", () => {
        assert.exists(tree);
    });
    it("Tree has a node for each element in the data", () => {
        const nodeCheck = (nodeData) => {
            if (nodeData) {
                const node = tree.shadowRoot.querySelector(`#${nodeData.id}`);
                assert.exists(node);
                nodeData.children.forEach((childData) => {
                    const childNode = tree.shadowRoot.querySelector(`#${childData.id}`);
                    assert.exists(childNode);
                    nodeCheck(childData);
                })
            }
        }
        nodeCheck(data);
    });
    it("Tree has leaderlines for every parent-child node", () => {
        const leaderlineCheck = (nodeData) => {
            if (nodeData) {
                nodeData.children.forEach((childData) => {
                    const svg = tree.shadowRoot.querySelector(
                        `svg[data-start-node-id="${nodeData.id}"][data-end-node-id="${childData.id}"]`
                    );
                    assert.exists(svg);
                    leaderlineCheck(childData);
                })
            }
        }
        leaderlineCheck(data);
    });
})


