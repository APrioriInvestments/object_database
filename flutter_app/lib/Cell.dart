import 'package:flutter/material.dart';
import 'octicons.dart';
import 'CellConnectionState.dart';


class Cell extends StatefulWidget {
  String cellId;
  CellConnectionState connState;
  CellWireState state;

  Cell(CellConnectionState connState, String cellId) : 
      super(key: connState.getCellWireState(cellId).key) {
    this.state = connState.getCellWireState(cellId);
    this.connState = connState;
    this.cellId = cellId;
  }

  String get cellType { return state.cellType; }
  Map get extraData { return state.extraData; }
  String get nameInParent { return state.nameInParent; }
  Map<String, CellWireState> get namedChildren { return state.namedChildren; }
  Map<String, List<CellWireState> > get namedChildLists { return state.namedChildLists; }
  Map<String, List<List<CellWireState> > > get namedChildListOfLists { return state.namedChildListOfLists; }

  CellState createState() {
    if (cellType == 'Traceback') {
      return TracebackCellState(this);
    }

    if (cellType == 'Text') {
      return TextCellState(this);
    }

    if (cellType == 'Table') {
      return TableCellState(this);
    }

    if (cellType == 'Span') {
      return TextCellState(this);
    }

    if (cellType == 'Button') {
      return ButtonCellState(this);
    }

    if (cellType == 'LargePendingDownloadDisplay') {
      return LargePendingDownloadDisplayCellState(this);
    }

    if (cellType == 'Subscribed') {
      return SubscribedCellState(this);
    }

    if (cellType == "Card") {
      return CardCellState(this);
    }

    if (cellType == "Octicon") {
      return OcticonCellState(this);
    }

    if (cellType == "HorizontalSequence") {
      return HorizontalSequenceCellState(this);
    }

    if (cellType == "HeaderBar") {
      return HeaderBarCellState(this);
    }

    if (cellType == "_NavTab") {
      return NavTabCellState(this);
    }

    if (cellType == "SplitView") {
      return SplitViewCellState(this);
    }

    if (cellType == "PageView") {
      return PageViewCellState(this);
    }

    if (cellType == "RootCell" || cellId == 'page_root') {
      return RootCellState(this);
    }

    if (cellType == "Main") {
      return MainCellState(this);
    }

    if (cellType == "Tabs") {
      return TabsCellState(this);
    }

    if (cellType == "Dropdown") {
      return DropdownCellState(this);
    }

    if (cellType == "Clickable") {
      return ClickableCellState(this);
    }

    if (cellType == "Padding") {
      return PaddingCellState(this);
    }

    return CellState(this);
  }
}

class CellState extends State<Cell> {
  Cell cell;

  CellState(this.cell);

  Widget makeCell(CellWireState state) {
    if (state == null) {
      return Text("<null>");
    }
    print("BUILD CELL FOR " + state.cellId + ": " + state.cellType);
    return Cell(cell.connState, state.cellId);
  }

  @override
  Widget build(BuildContext context) {
    Widget res;

    if (cell.namedChildren != null && cell.namedChildren.length > 0 ||
        cell.namedChildLists != null && cell.namedChildLists.length > 0) {
      List<Cell> children = List<Cell>();
      cell.namedChildren.forEach((key, val) {
        if (val != null) {
          children.add(makeCell(val));
        }
      });

      cell.namedChildLists.forEach((key, val) {
        val.forEach((child) { if (child != null) { children.add(makeCell(child)); }; });
      });

      res = Container(
        decoration: BoxDecoration(border: Border.all(width: 2.0)),
        child: Row(children: [
          Align(alignment: Alignment.topLeft, child: Text(cell.cellType)), 
          Align(alignment: Alignment.topLeft, child: 
            Align(alignment: Alignment.topLeft, child: Column(children: children))
          )
        ])
      );
    } else {
      res = Text(cell.cellType ?? "<empty>");
    }

    return Padding(
      padding: EdgeInsets.all(2), 
      child: Align(alignment: Alignment.topLeft, child: res)
    );
  }
}

class RootCellState extends CellState {
  RootCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    if (cell == null || cell.namedChildren == null) {
      return Text("");
    }

    if (cell.namedChildren['child'] == null) {
      return Text("");
    }

    return Scaffold(body: Container(child: makeCell(cell.namedChildren['child'])));
  }
}

class MainCellState extends CellState {
  MainCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    if (cell == null || cell.namedChildren == null) {
      return Text("");
    }

    if (cell.namedChildren['child'] == null) {
      return Text("");
    }

    return Container(child: makeCell(cell.namedChildren['child']));
  }
}

class DropdownCellState extends CellState {
  DropdownCellState(Cell cell) : super(cell) {}

  bool open = false;

  @override
  Widget build(BuildContext context) {
    if (cell.namedChildLists == null) {
      return Text("");
    }

    var items = List<DropdownMenuItem>();

    int i = 0;
    while (i < cell.namedChildLists['dropdownItems'].length) {
      items.add(
        DropdownMenuItem(
          child: Container(child: makeCell(cell.namedChildLists['dropdownItems'][i])),
          value: i
        )
      );
      i = i + 1;
    }

    return DropdownButton(
      hint: makeCell(cell.namedChildren['title']),
      items: items,
      onChanged: (value) {
        print("SET TO " + value.toString());
      });
  }
}

class TracebackCellState extends CellState {
  TracebackCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    return Card(child: makeCell(cell.namedChildren['traceback']));
  }
}

class TextCellState extends CellState {
  TextCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    return Text(cell.extraData['rawText'] ?? cell.extraData['text'] ?? "");
  }
}

class PaddingCellState extends CellState {
  PaddingCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    return SizedBox(width: 10, height: 10);
  }
}

class ClickableCellState extends CellState {
  ClickableCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    return InkWell(child: 
      makeCell(cell.namedChildren['content']), onTap: () {
      cell.connState.sendMessage(
        {'event': 'click', 'target_cell': cell.cellId}
      );
    });
  }
}

class TableCellState extends CellState {
  TableCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    if (cell.namedChildListOfLists['dataCells'] == null) {
      return Text("");
    }

    return Column(
      children: cell.namedChildListOfLists['dataCells'].map<Widget>(
        (children) => Row(
          children: children.map<Widget>(
            (cell) => makeCell(cell)
          ).toList()
        )
      ).toList()
    );
    //return Table(
    //  border: TableBorder.all(),
    //  children: cell.namedChildListOfLists['dataCells'].map<TableRow>(
    //    (children) => TableRow(
    //      children: children.map<Widget>(
    //        (cell) => TableCell(child: makeCell(cell) ?? Text("<EMPTY>"))
    //      ).toList()
    //    )
    //  ).toList()
    //);
  }
}

class SubscribedCellState extends CellState {
  SubscribedCellState(Cell cell) : super(cell) {}

  int times = 0;

  @override
  Widget build(BuildContext context) {
    times = times + 1;
    print(
      "Subscribed rebuilding " + cell.cellId + ": " 
      + cell.namedChildren['content'].cellId + " " + times.toString()
    );
    return makeCell(
      cell.namedChildren['content']
    );
  }
}

class CardCellState extends CellState {
  CardCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    return Card(child: makeCell(cell.namedChildren['body']));
  }
}

class OcticonCellState extends CellState {
  OcticonCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    if (cell.extraData['octicon'] == null) {
      return Text("");
    }

    return Icon(
      octicons[cell.extraData['octicon'].replaceAll('-', '_')],
      size: 18
      // color: Colors.green,
    );
  }
}

class HorizontalSequenceCellState extends CellState {
  HorizontalSequenceCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    if (cell.namedChildLists['elements'] == null) {
      return Text("");
    }
    return Row(
      children: cell.namedChildLists['elements'].map(makeCell).toList()
    );
  }
}

class ButtonCellState extends CellState {
  ButtonCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    if (cell.namedChildren['content'] == null) {
      return Text("");
    }

    return ElevatedButton(
      child: makeCell(cell.namedChildren['content']),
      onPressed: () {
        cell.connState.sendMessage(
          {'event': 'click', 'target_cell': cell.cellId}
        );
      }
    );
  }
}

class PageViewCellState extends CellState {
  PageViewCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    if (cell.namedChildren['main'] == null) {
      return Text("");
    }

    var children = List<Widget>();

    if (cell.namedChildren['header'] != null) {
      children.add(
        Expanded(child: makeCell(cell.namedChildren['header']))
      );
    }

    if (cell.namedChildren['main'] != null) {
      children.add(
        Expanded(child: makeCell(cell.namedChildren['main']), flex: 10)
      );
    }

    if (cell.namedChildren['footer'] != null) {
      children.add(
        Expanded(child: makeCell(cell.namedChildren['footer']))
      );
    }

    return Column(children: children);
  }
}

class LargePendingDownloadDisplayCellState extends CellState {
  LargePendingDownloadDisplayCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    return Text("");
  }
}

class HeaderBarCellState extends CellState {
  HeaderBarCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    if (cell.namedChildLists['leftItems'] == null) {
      return Text("");
    }

    var leftChildren = List<Widget>();
    var centerChildren = List<Widget>();
    var rightChildren = List<Widget>();    

    leftChildren = (cell.namedChildLists['leftItems'] ?? List<Widget>()).map((m) {
      return Expanded(child: makeCell(m));
    }).toList();

    centerChildren = (cell.namedChildLists['centerItems'] ?? List<Widget>()).map((m) {
      return Expanded(child: makeCell(m));
    }).toList();
    
    rightChildren = (cell.namedChildLists['rightItems'] ?? List<Widget>()).map((m) {
      return Expanded(child: makeCell(m));
    }).toList();

    return Row(children: [
      Expanded(child: Row(children: leftChildren)),
      Expanded(child: Row(children: centerChildren)),
      Expanded(child: Row(children: rightChildren)),
    ]);

  }
}

class SplitViewCellState extends CellState {
  SplitViewCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    if (cell.namedChildLists['elements'] == null) {
      return Text("");
    }

    var elts = cell.namedChildLists['elements'];

    var children = [
      for(int index = 0; index < elts.length; index++)
        Expanded(child: makeCell(elts[index]), flex: cell.extraData['proportions'][index])
    ];

    if (cell.extraData['elements'] == 'vertical') {
      return Row(children: children);
    }
    return Column(children: children);
  }
}

class TabsCellState extends CellState {
  TabsCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    if (cell.namedChildren['display'] == null) {
      return Text("");
    }

    var headerCells = cell.namedChildLists['headers'];

    return Column(
      children: [
        Row(children: headerCells.map(makeCell).toList()),
        Expanded(child: makeCell(cell.namedChildren['display']))
      ]
    );
  }
}

class NavTabCellState extends CellState {
  NavTabCellState(Cell cell) : super(cell) {}

  @override
  Widget build(BuildContext context) {
    if (cell.namedChildren['child'] == null) {
      return Text("");
    }

    Widget res = InkWell(child: makeCell(cell.namedChildren['child']), onTap: () {
      cell.connState.sendMessage(cell.extraData['clickData']);
    });

    return Container(
      child: res, 
      color: cell.extraData['isActive'] ? Colors.blue[600] : Colors.white,
    );
  }
}
