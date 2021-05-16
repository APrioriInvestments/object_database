import 'package:web_socket_channel/web_socket_channel.dart';
import 'dart:convert';

typedef MessageCallback = void Function(dynamic o);

// simple adaptor for an odb socket connection.
class SocketConnection {
  WebSocketChannel channel;
  MessageCallback callback;

  StringBuffer curBuffer;
  int curBufferRemaining;

  SocketConnection(MessageCallback inC) {
    callback = inC;
    channel = WebSocketChannel.connect(Uri.parse("ws://localhost:8000/socket/services"));

    channel.stream.listen(receive, onError: onError);
  }

  void receive(dynamic message) {
    if (curBufferRemaining == null) {
      // protocol sends us an int first
      curBufferRemaining = int.parse(message);
      curBuffer = StringBuffer();
    } else {
      curBuffer.write(message);
      curBufferRemaining -= 1;

      if (curBufferRemaining == 0) {
        String packet = curBuffer.toString();
        curBuffer = null;
        curBufferRemaining = null;

        var msg = jsonDecode(packet);

        // do nothing 
        if (msg == "postscripts") { 
        } else
        if (msg == "request_ack") { 
          channel.sink.add(jsonEncode({"ACK": 0})); 
        } else {
          callback(msg);
        }
      } else if (curBuffer.length % 10 == 0) {
        channel.sink.add(
          jsonEncode({
            "ACK": curBuffer.length
          })
        );
      }
    }
  }

  void send(dynamic jsMessage) {
    print("SENDING " + jsonEncode(jsMessage));
    channel.sink.add(jsonEncode(jsMessage));
  }

  void onError(dynamic error) {
    print("ERROR " + error.toString());
  }
}
