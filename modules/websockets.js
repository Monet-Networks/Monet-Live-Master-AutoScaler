const fdController = require('@controllers/faceData.controller');
const Sessions = require('@models/sessions.model');

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
    io.on(
      'connection',
      (socket) => socket.emit('hello', 'world')
      //  new MonetSocket(socket)
    );
  }
}

// class MonetSocket {
//   constructor(socket) {
//     monet.debug('socket : connected with id ', socket.id);
//     this.handleSocket(socket);
//   }

//   handleSocket(socket) {
//     socket.on('avg-engagement-req', async (data) => {
//       try {
//         monet.debug('The engagement request : ', data);
//         let report = await this.genReport(data);
//         socket.emit('avg-engagement-res', report);
//       } catch (err) {
//         monet.err('socket : avg-engagement-req : ', err.message);
//       }
//     });
//   }

//   genReport = async (data) => {
//     const report = [];
//     const userArrays = {};
//     const { roomid } = data;
//     const sessionData = await fdController.fetchSession(roomid);
//     const userList = await Sessions.find({ roomid: roomid });
//     userList.forEach(({ uuid }) => (userArrays[uuid] = []));
//     sessionData.forEach(({ uuid, segment, createdAt, mood, webcam, engagement }) => {
//       userArrays[uuid].push({ segment, createdAt, mood, webcam, engagement });
//     });
//     for (const user in userArrays) {
//       // userArrays[user].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
//       userArrays[user].forEach((val, index) => {
//         val.segment = index + 1;
//       });
//     }
//     for (const user of userList) {
//       const { uuid, roomid, name } = user;
//       const map = {
//         name: name,
//         std_id: uuid,
//         roomid: roomid,
//       };
//       // const userData = await fdController.fetchData(roomid);
//       const userData = userArrays[uuid];
//       if (userData.length === 0) {
//         monet.warn('no data...');
//         continue;
//       }
//       map['engagement_avg'] = 0;
//       map['mood_avg'] = 0;
//       const last_10 = userData.slice(Math.max(userData.length - 10, 1));
//       last_10.forEach((r) => {
//         if (r['mood'] === null) r['mood'] = 0;
//         map['engagement_avg'] += r['engagement'];
//         map['mood_avg'] += r['mood'];
//       });
//       map['engagement_avg'] = map['engagement_avg'] / 10;
//       map['mood_avg'] = map['mood_avg'] / 10;
//       map['session_data'] = userData;
//       report.push(map);
//       delete userArrays[uuid];
//     }
//     return report;
//   };
// }

module.exports = MonetIO;
