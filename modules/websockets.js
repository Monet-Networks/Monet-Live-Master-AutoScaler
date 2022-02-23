const GenReport = require('../util/genReport');

const debug = require('debug');
const monet = {
  vdebug: debug('websocket:vdebug'),
  debug: debug('websocket:debug'),
  err: debug('websocket:error'),
  warn: debug('websocket:warn'),
  info: debug('websocket:info'),
};

class MonetIO {
  constructor(io) {
    io.on('connection', (socket) => new MonetSocket(socket));
  }
}

class MonetSocket {
  constructor(socket) {
    monet.debug('socket : connected with id ', socket.id);
    this.handleSocket(socket);
  }

  handleSocket(socket) {
    socket.on('avg-engagement-req', async (data) => {
      try {
        monet.debug('The engagement request : ', data);
        let report = await GenReport(data);
        socket.emit('avg-engagement-res', report);
      } catch (err) {
        monet.err('socket : avg-engagement-req : ', err.message);
      }
    });
  }
}

module.exports = MonetIO;
