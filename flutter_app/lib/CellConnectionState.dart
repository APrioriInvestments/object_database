import 'package:flutter/material.dart';

typedef MessageCallback = void Function(dynamic o);

// what we've heard from the socket
class CellWireState {
  CellWireState(this.cellId) {
    key = GlobalKey(debugLabel: this.cellId);
  }

  GlobalKey key;
  String cellId;
  String cellType;
  Map extraData;
  String nameInParent;
  Map<String, CellWireState> namedChildren;
  Map<String, List<CellWireState> > namedChildLists;
  Map<String, List<List<CellWireState> > > namedChildListOfLists;

  onMessage(CellConnectionState connState, Map message) {
    print("Message sent to " + cellId);

    if (message.containsKey('cellType')) {
      cellType = message['cellType'] as String;
    }

    if (message.containsKey('nameInParent')) {
      nameInParent = message['nameInParent'] as String;
    }

    if (message.containsKey('extraData')) {
      extraData = message['extraData'] as Map;
    }

    if (message.containsKey('namedChildren')) {
      namedChildren = Map<String, CellWireState>();
      namedChildLists = Map<String, List<CellWireState> >();
      namedChildListOfLists = Map<String, List<List<CellWireState> > >();

      (message['namedChildren'] as Map).forEach((key, val) {
        if (val is Map) {
          namedChildren[key] = connState.getCellWireState((val as Map)['id']);
          namedChildren[key].onMessage(connState, val as Map);
        } else if (val is List) {
          if (val.length > 0) {
            if (val[0] is Map) {
              namedChildLists[key] = val.map((m) {
                if (!(m is Map)) {
                  throw new Exception("BOO2");
                }
                Map message = m as Map;

                CellWireState cell = connState.getCellWireState(message['id']);
                cell.onMessage(connState, message);
                return cell;
              }).toList();
            } else
            if (val[0] is List) {
              namedChildListOfLists[key] = val.map<List<CellWireState> >((l) {
                return l.map<CellWireState>((m) {
                  if (!(m is Map)) {
                    throw new Exception("BOO");
                  }
                  Map message = m as Map;

                  CellWireState cell = connState.getCellWireState(message['id']);
                  cell.onMessage(connState, message);
                  return cell;
                }).toList();
              }).toList();
            }
          }
        } else {
          throw new Exception("Invalid message");
        }
      });
    }

    if ((key as GlobalKey).currentState != null) {
      (key as GlobalKey).currentState.setState(() {});
    }
  }
}

class CellConnectionState {
  Map<String, CellWireState> cellStates;

  MessageCallback sendMessage;

  CellConnectionState(MessageCallback sendMessage) {
    cellStates = Map<String, CellWireState>();
    this.sendMessage = sendMessage;

    cellStates["page_root"] = CellWireState("page_root");
  }

  onMessage(Map message) {
    String id = message['id'] as String;

    if (!cellStates.containsKey(id)) {
      cellStates[id] = CellWireState(id);
    }

    cellStates[id].onMessage(this, message);
  }

  CellWireState getCellWireState(String id) {
    if (!cellStates.containsKey(id)) {
      cellStates[id] = CellWireState(id);
    }

    return cellStates[id];
  }
}