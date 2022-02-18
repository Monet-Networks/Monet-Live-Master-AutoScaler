const { log } = require('console');

class MonetIO {
  talkToIO = (event, data) => {
    const CB = typeof this.userComm[event] === 'function' ? this.userComm[event] : () => {};
    CB(data);
  };

  constructor(io) {
    // Empty dict to keep tabs of socket
    this.check = false;
    this.userComm = {};
    this.userTab = {};
    this.socketTab = {};
    this.io = io;

    // io engine connection controller.
    this.io.on('connection', (socket) => (this.socketTab[socket.id] = new MonetUser(socket, this.talkToIO)));
    this.registerUserComm();
    this.checkUnregisteredSockets();
  }

  registerUserComm = () => {
    this.userComm['register-userId'] = ({ name, id }) => {
      this.userTab[name] = this.socketTab[id];
      this.userTab[name].unRes = 0;
      delete this.socketTab[id];
    };
  };

  checkUnregisteredSockets = () => {
    for (let key in this.socketTab) {
      if (this.socketTab[key].unRes > 5) {
        log('Deleting : ', this.socketTab[key].currentSocketId);
        delete this.socketTab[key];
        return log('SocketTab after deletion : ', this.socketTab);
      }
      ++this.socketTab[key].unRes;
      if (this.socketTab[key].currentSocketId) {
        this.socketTab[key].currentSocket.emit('fetch-userId');
      }
    }
    if (Object.keys(this.socketTab).length === 0) this.check = false;
    if (this.check)
      setTimeout(() => {
        this.checkUnregisteredSockets();
      }, 1000);
  };
}

class MonetUser {
  constructor(socket, talkToIO) {
    this.unRes = 0;
    this.talkToIO = talkToIO;
    this.currentSocketId = socket.id;
    this.currentSocket = socket;
    this.socketHandle(socket);
  }

  socketHandle = (socket) => {
    socket.on('register-userId', ({ name }) => {
      this.talkToIO('register-userId', { name, id: socket.id });
    });
  };
}

module.exports = MonetIO;
