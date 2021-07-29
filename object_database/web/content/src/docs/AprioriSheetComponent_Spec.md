## Sheet component specification

### General Layout

The sheet component consists of 3 main types of objects:
* underlying data frame which represents all data available to the sheet
* active view which represent the subframe of all data displayed at any one moment
* selector which represents a subframe of all data that is labelled as “selected”


#### API:
* rowHeight: height of rows in sixels
* colWidth: width of columns in pixels
* numLockRows: number of top rows that remain locked
* numLockColumns: number of leftmost column that remain locked
* totalRows: totals data rows
* totalColumns: total data columns

#### Events:
| event type | event spec | sheet response | details |
| -------- | ---------- | ---------------- | ------- |
| resize| window or view level | sheet adds or removes columns as necessary | sheet can prepend or append rows/columns depending on whether the resize grows the sheet at the top/left or at the bottom/right|


### View level navigation

#### Events:
| event type | event spec | sheet response | further specs |
| ---------- | ---------- | -------------- | ------------- |
| mouse wheel | up/down wheel  | scroll sheet active view| if selector present shrink it to cursor and move up/down
mouse wheel | up/down wheel  + shiftKey | scroll sheet active view | if selector present grow it up/down
keyboard | pageDown | move down number of rows in sheet active view | if the cursor is out of view translate the view to the cursor |
| keyboard | pageDown + shiftKey | move down number of rows in sheet active view | if selector present expand down by number of row in sheet active view
keyboard | pageUp | move up number of rows in sheet active view | if the cursor is out of view translate the view to the cursor|
|keyboard | pageUp + shiftKey | move up number of rows in sheet active view | if selector present expand up by number of row in sheet active view|
|keyboard | pageDown + altKey (= pageRight) | move right number of columns in sheet active view | if the cursor is out of view translate the view to the cursor|
|keyboard | pageDown + altKey (= pageRight) + shiftKey | move right number of columns in sheet active view | if selector present expand right by number of columns in sheet active view|
|keyboard | pageUp + altKey (= pageLeft) | move left number of columns in sheet active view | if the cursor is out of view translate the view to the cursor|
|keyboard | pageUp + altKey (= pageLeft)  + shiftKey | move left number of columns in sheet active view | if selector present expand left  by number of columns in sheet active view|
|keyboard | arrowUp + ctrlKey | jump to top of the sheet data | if selector is present shrink it to cursor and move cursor to the top of the view frame|
|keyboard | arrowUp + ctrlKey + shiftKey | jump to top of the sheet data | grow selector to the top of the view frame (including the locked rows if any) |
|keyboard | arrowDown + ctrlKey | jump to bottom of the sheet data | if selector is present shrink it to cursor and move cursor to the bottom of the view frame|
|keyboard | arrowDown + ctrlKey + shiftKey | jump to top of the sheet data | grow selector to the bottom of the sheet data |
|keyboard | arrowLeft + ctrlKey | jump to left of the sheet data | if selector is present shrink it to cursor and move cursor to the left of the view frame|
|keyboard | arrowLeft + ctrlKey + shiftKey | jump to left of the sheet data | grow selector to the left of the sheet data (including the locked columns if any) |
|keyboard | arrowRight + ctrlKey | jump to right of the sheet data| if selector is present shrink it to cursor and move cursor to the bottom of the view frame|
|keyboard | arrowRight + ctrlKey + shiftKey | jump to top of the sheet data | grow selector to the bottom of the sheet data|


### Selector
#### Events:
Note: all events below assume that the selector is active
|event type | event spec | sheet response | further specs |
| --------- | ---------- | -------------- | ------------- |
|keyboard | arrowUp | shrink to cursor and move up one row | if the selector is at the top of the view frame shift the view one data row up if possible, else move selector up locked rows until top of the sheet data is reached|
|keyboard | arrowUp + shiftKey | grow selector up one row | if the selector is at the top of the view frame shift the view one data row up if possible, else grow selector up locked rows until top of the sheet data is reached|
|keyboard | arrowDown | shrink to cursor and move down one row | if the selector is at the bottom of the view frame shift the view one data row up if possible|
|keyboard | arrowDown +  shiftKey | grow selector down one row | if the selector is at the bottom of the view frame shift the view one data row up if possible |
|keyboard | arrowLeft | shrink to cursor and move left one column | if the selector is at the left of the view frame shift the view one data column left if possible, else move selector left locked column until leftmost of the sheet data is reached|
|keyboard | arrowLeft + shiftKey | grow selector left one row | if the selector is at the left of the view frame shift the view one data column left if possible, else grow selector left over locked column until leftmost of the sheet data is reached|
|keyboard | arrowRight | shrink to cursor and move right one column | if the selector is at the right of the view frame shift the view one data column right if possible|
|keyboard | arrowRight +  shiftKey | grow selector right one column | if the selector is at the rightmost of the view frame shift the view one data column right if possible |
|keyboard | ctrl + C (=copy to clipboard) | copy all data in selector to system clipboard | if the total size of the selector is > 1,000,000 cells alert the user and abort|
