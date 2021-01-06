#   Copyright 2017-2020 object_database Authors
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

from .messages import ClientToServer, ServerToClient


class ServerToClientChannel:
    """Base class for channels that a Server holds to talk to a client."""

    def sendMessage(self, msg: ServerToClient):
        """Send a message to the client."""
        raise NotImplementedError(self)

    def setClientToServerHandler(self, handler):
        """Set the callback to call when we get a message from this client.

        Users can assume that the messages will get called on an external thread
        in the order in which they are received, and that a call to 'handler'
        for one message must complete before it gets called again.

        Different channels can have different threads however.

        Args:
            handler - a function taking a single message of type ClientToServer.
        """
        raise NotImplementedError(self)

    def close(self):
        """Close the channel.

        Indicates that we won't send any more messages, and we don't intend
        to process any more client to server messages.

        No further calls to 'handler' should be made after this is called.
        """
        raise NotImplementedError(self)


class ClientToServerChannel:
    """Base class for channels that a Client holds to talk to a server."""

    def sendMessage(self, msg: ClientToServer):
        """Send a message to the server."""
        raise NotImplementedError(self)

    def setServerToClientHandler(self, handler):
        """Set the callback to call when we get a message from this client.

        Users can assume that the messages will get called on an external thread
        in the order in which they are received, and that a call to 'handler'
        for one message must complete before it gets called again.

        Different channels can have different threads however.

        Args:
            handler - a function taking a single message of type ServerToClient.
        """
        raise NotImplementedError(self)

    def close(self):
        """Close the channel.

        Indicates that we won't send any more messages, and we don't intend
        to process any more client to server messages.

        No further calls to 'handler' should be made after this is called.
        """
        raise NotImplementedError(self)
