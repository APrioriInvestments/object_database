import {CellsTree} from './tree.js';

// SOME FAKE DATA: TODO!
const cells = {
    name: "root cell",
    children: [
        {
            name: "cell_1_1",
            children: [
                {
                    name: "cell_1_2",
                    children: []
                }
            ]
        },
        {
            name: "cell_2_1",
            children: [
                {
                    name: "cell_2_2",
                    children: []
                }
            ]
        },
        {
            name: "cell_3_1",
            children: [
                {
                    name: "cell_3_2",
                    children: []
                }
            ]
        },
    ]
}

// init and run
const cTree = new CellsTree(cells);
cTree.setupTree();
