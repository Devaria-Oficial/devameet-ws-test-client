import { io } from 'socket.io-client';

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

class PeerConnectionSession {
    _room;
    _userId;
    peerConnections = {};
    senders = [];
    listeners = {};

    constructor(socket) {
        this.socket = socket;
        this.onCallMade();
      }

    addPeerConnection(id, stream, callback) {
        this.peerConnections[id] = new window.RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        stream.getTracks().forEach((track) => {
            this.senders.push(this.peerConnections[id].addTrack(track, stream));
        });

        this.listeners[id] = (event) => {
            const fn = this['_on' + capitalizeFirstLetter(this.peerConnections[id].connectionState)];
            fn && fn(event, id);
        };

        this.peerConnections[id].addEventListener('connectionstatechange', this.listeners[id]);

        this.peerConnections[id].ontrack = function ({ streams: [stream] }) {
            callback(stream);
        };
    }

    removePeerConnection(id) {
        this.peerConnections[id].removeEventListener('connectionstatechange', this.listeners[id]);
        delete this.peerConnections[id];
        delete this.listeners[id];
    }

    async callUser(to) {
        if (this.peerConnections[to].iceConnectionState === 'new') {
            const offer = await this.peerConnections[to].createOffer();
            await this.peerConnections[to].setLocalDescription(new RTCSessionDescription(offer));

            this.socket.emit('call-user', { offer, to });
        }
    }

    onAnswerMade(callback) {
        this.socket.on('answer-made', async (data) => {
            await this.peerConnections[data.socket].setRemoteDescription(new RTCSessionDescription(data.answer));
            callback(data.socket);
        });
    }

    onCallMade() {
        this.socket.on('call-made', async (data) => {
            const selectedPeer = this.peerConnections[data.socket];
            if(selectedPeer){
                await selectedPeer.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await selectedPeer.createAnswer();
                await selectedPeer.setLocalDescription(new RTCSessionDescription(answer));
    
                this.socket.emit('make-answer', {
                    answer,
                    to: data.socket,
                });
            }
        });
    }

    joinRoom(data) {
        this._room = data.link;
        this._userId = data.user;
        this.socket.emit('join', { link: this._room, userId: this._userId });
    }

    onAddUser(callback) {
        this.socket.on(`${this._room}-add-user`, async ({ user }) => {
            callback(user);
        });
    }

    onRemoveUser(callback) {
        this.socket.on(`${this._room}-remove-user`, ({ socketId }) => {
            callback(socketId);
        });
    }

    onUpdateUserList(callback) {
        this.socket.on(`${this._room}-update-user-list`, ({ users }) => {
            callback(users);
        });
    }

    updateUserMovement(data) {
        this.socket.emit('move', data);
    }

    updateUserMute(data) {
        this.socket.emit('toggl-mute-user', data);
    }

    clearConnections() {
        // this.socket?.close();
        // this.senders = [];
        // if(this.peerConnections){
        //     Object.keys(this.peerConnections)?.forEach(this.removePeerConnection?.bind(this));
        // }
    }
}

export const createPeerConnectionContext = () => {
    const socket = io('http://localhost:3333');

    return new PeerConnectionSession(socket);
};
