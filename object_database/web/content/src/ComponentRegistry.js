/**
 * We use a singleton registry object
 * where we make available all possible
 * Cells. This is useful for Webpack,
 * which only bundles explicitly used
 * Cells during build time.
 */

import {Cell} from './components/Cell';
import {ConcreteCell} from './components/ConcreteCell';
import {PassthroughCell} from './components/PassthroughCell';
import {DropdownDrawer} from './components/DropdownDrawer';
import {Badge} from './components/Badge';
import {Button} from './components/Button';
import {ButtonGroup} from './components/ButtonGroup';
import {Card} from './components/Card';
import {CardTitle} from './components/CardTitle';
import {CircleLoader} from './components/CircleLoader';
import {Clickable} from './components/Clickable';
import {Code} from './components/Code';
import {CollapsiblePanel} from './components/CollapsiblePanel';
import {Columns} from './components/Columns';
import {ContextMenu} from './components/ContextMenu';
import {MenuItem} from "./components/MenuItem";
import {Dropdown} from './components/Dropdown';
import {Expands} from './components/Expands';
import {HeaderBar} from './components/HeaderBar';
import {KeyAction} from './components/KeyAction';
import {LargePendingDownloadDisplay} from './components/LargePendingDownloadDisplay';
import {Main} from './components/Main';
import {Modal} from './components/Modal';
import {Octicon} from './components/Octicon';
import {Padding} from './components/Padding';
import {Border} from './components/Border';
import {Panel} from './components/Panel';
import {Highlighted} from './components/Highlighted';
import {Popover} from './components/Popover';
import {ResizablePanel} from './components/ResizablePanel';
import {RootCell} from './components/RootCell';
import {Sequence} from './components/Sequence';
import {Scrollable} from './components/Scrollable';
import {SingleLineTextBox} from './components/SingleLineTextBox';
import {Span} from './components/Span';
import {Subscribed} from './components/Subscribed';
import {Sized} from './components/Sized';
import {Table, TableRow, TableHeader} from './components/Table';
import {Tabs} from './components/Tabs';
import {Terminal} from './components/Terminal';
import {Text} from './components/Text';
import {Editor} from './components/Editor';
import {Traceback} from './components/Traceback';
import {_NavTab} from './components/_NavTab';
import {Flex} from './components/Flex';
import {FillSpace} from './components/FillSpace';
import {Grid} from './components/Grid';
import {Sheet} from './components/Sheet';
import {WebglPlot} from './components/WebglPlot';
import {Timestamp} from './components/Timestamp';
import {SplitView} from './components/SplitView';
import {PageView} from './components/PageView';

const ComponentRegistry = {
    _NavTab,
    DropdownDrawer,
    Badge,
    Button,
    ButtonGroup,
    Card,
    CardTitle,
    Cell,
    CircleLoader,
    Clickable,
    Code,
    CollapsiblePanel,
    Columns,
    ConcreteCell,
    ContextMenu,
    MenuItem,
    Dropdown,
    Expands,
    Flex,
    FillSpace,
    Grid,
    HeaderBar,
    Highlighted,
    KeyAction,
    LargePendingDownloadDisplay,
    Main,
    Modal,
    Octicon,
    Padding,
    PassthroughCell,
    Border,
    PageView,
    Panel,
    Popover,
    ResizablePanel,
    RootCell,
    Scrollable,
    Sequence,
    Sheet,
    SingleLineTextBox,
    Sized,
    Span,
    SplitView,
    Subscribed,
    Table,
    TableHeader,
    TableRow,
    Tabs,
    Terminal,
    Text,
    Timestamp,
    Traceback,
    WebglPlot,
    Editor
};

export {ComponentRegistry, ComponentRegistry as default};
