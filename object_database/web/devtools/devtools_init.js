// Create a new panel
chrome.devtools.panels.create(
    "Cells",
    null,
    "cells_panel.html",
    function(panel){
        console.log("ok");
        console.log(panel);
    }
);
