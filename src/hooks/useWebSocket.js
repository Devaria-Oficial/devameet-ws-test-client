import { useEffect, useMemo, useState } from 'react';
import { createPeerConnectionContext } from '../utils/WebSocketUtil';

export const useWebSocket = (data, userMediaStream) => {
  const peerVideoConnection = useMemo(() => createPeerConnectionContext(), []);
  const [connectedUsers, setConnectedUsers] = useState([]);

  useEffect(() => {
    if (userMediaStream) {
      peerVideoConnection.joinRoom(data);
      peerVideoConnection.onAddUser((user) => {
        peerVideoConnection.addPeerConnection(`${user}`, userMediaStream, (_stream) => {
          document.getElementById(user).srcObject = _stream;
        });
        peerVideoConnection.callUser(user);
      });

      peerVideoConnection.onRemoveUser((socketId) => {
        setConnectedUsers((users) => users.filter((user) => user.clientId !== socketId));
        //peerVideoConnection.removePeerConnection(socketId);
      });

      peerVideoConnection.onUpdateUserList(async (users) => {
        setConnectedUsers(users);
        const usersWithoutMe = users.filter(u => u.user !== data.user);
        for (const user of usersWithoutMe) {
          peerVideoConnection.addPeerConnection(`${user.clientId}`, userMediaStream, (_stream) => {
            //document.getElementById(user.clientId).srcObject = _stream;
          });
        }
      });

      peerVideoConnection.onAnswerMade((socket) => peerVideoConnection.callUser(socket));
    }

    return () => {
      if (userMediaStream) {
        peerVideoConnection.clearConnections();
        userMediaStream?.getTracks()?.forEach((track) => track.stop());
      }
    };
  }, [peerVideoConnection, userMediaStream, data]);

  return {
    peerVideoConnection,
    connectedUsers
  };
};
