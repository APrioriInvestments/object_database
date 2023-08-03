/**
  * Utilities and helpers for the inspected
  * (target) window. These are callbacks for
  * various messages handled by the CS <-> background
  * port listeners found in the content_script.js file.
  */


const handleBackgroundMessage = (msg) => {
    switch (msg.event) {
    case "mouseover":
        onMouseOver(msg.nodeId);
        break;

    case "mouseleave":
        onMouseLeave();
        break;

    case "click":
        onClick(msg.nodeId);

    case "propChange":
        onPropChange(msg.nodeId, msg.details.name, msg.details.value);
    }

}

// Helpers
const overlayId = "cells-devtools-overlay";

const highlightCellNode = (id) => {
    const cell = document.querySelector(`[data-cell-id="${id}"]`);
    if (cell) {
        const rect = cell.getBoundingClientRect();
        const overlay = document.createElement("div");
        overlay.style.position = "absolute";
        overlay.style.backgroundColor = "#cec848";
        overlay.style.opacity = "0.5";
        overlay.style.left = rect.left + "px";
        overlay.style.top = rect.top + "px";
        overlay.style.height = rect.height + "px";
        overlay.style.width = rect.width + "px";
        overlay.setAttribute("id", overlayId);
        document.body.append(overlay);
    }
}

const clearCellNodeHighlight = () => {
    const overlays = document.querySelectorAll(`#${overlayId}`);
    overlays.forEach((el) => el.remove());
}

// event listeners
const onMouseOver = (id) => {
    highlightCellNode(id);
}

const onMouseLeave = () => {
    clearCellNodeHighlight();
}

const onClick = (id) => {
    // get the source code for the cell and send over the devtools
    const msg = {
        type: "cells_devtools_CS",
        request: "info",
        nodeId: id
    };
    window.postMessage(msg);
}

const onPropChange = (id, name, value) => {
    // get the source code for the cell and send over the devtools
    const msg = {
        type: "cells_devtools_CS",
        request: "propChange",
        nodeId: id,
        name: name,
        value: value
    };
    window.postMessage(msg);
}
