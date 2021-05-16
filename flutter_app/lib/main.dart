import 'package:flutter/material.dart';

import 'SocketConnection.dart';
import 'CellConnectionState.dart';
import 'Cell.dart';

void main() => runApp(CellsApp());

class CellsApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      routes: {
        '/': (context) => CellsScreen(),
      },
    );
  }
}

class CellsScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return CellsPage();
  }
}

class CellsPage extends StatefulWidget {
  @override
  CellsPageState createState() => CellsPageState();
}

class CellsPageState extends State<CellsPage> {
  SocketConnection conn;

  CellConnectionState connState;

  void onMessage(var msg) {
    if (msg is Map) {
      final stopwatch = Stopwatch()..start();
      if (msg.containsKey('id')) {
        print("ROOT MESSAGE TO " + msg['id']);
        connState.getCellWireState(msg['id']).onMessage(connState, msg as Map);
        print('onMessage() executed in ${stopwatch.elapsed}');
      } else {
        print(msg);
      }
    }
  }

  void sendMessage(var msg) {
    conn.send(msg);
  }

  CellsPageState() {
    conn = SocketConnection(onMessage);
    connState = CellConnectionState(sendMessage);
  }

  @override
  Widget build(BuildContext contets) {
    return Cell(connState, 'page_root');
  }
}
