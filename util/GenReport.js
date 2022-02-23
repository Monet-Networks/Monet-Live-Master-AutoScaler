const fdController = require('../controllers/faceData.controller');
const SessionsModel = require('../models/sessions.model');

async function GenReport(data) {
  const report = [];
  const userArrays = {};
  const { roomid } = data;
  const sessionDataPromise = fdController.fetchSession(roomid);
  const userListPromise = SessionsModel.find({ roomid });
  const [sessionData, userList] = await Promise.all([sessionDataPromise, userListPromise]);
  userList.forEach(({ uuid }) => (userArrays[uuid] = []));
  sessionData.forEach(({ uuid, segment, createdAt, mood, webcam, engagement }) => {
    userArrays[uuid].push({ segment, createdAt, mood, webcam, engagement });
  });
  for (const user in userArrays) {
    // userArrays[user].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    userArrays[user].forEach((val, index) => {
      val.segment = index + 1;
    });
  }
  for (const user of userList) {
    const { uuid, roomid, name } = user;
    const map = {
      name: name,
      std_id: uuid,
      roomid: roomid,
    };
    // const userData = await fdController.fetchData(roomid);
    const userData = userArrays[uuid];
    if (userData.length === 0) {
      monet.warn('no data...');
      continue;
    }
    map['engagement_avg'] = 0;
    map['mood_avg'] = 0;
    const last_10 = userData.slice(Math.max(userData.length - 10, 1));
    last_10.forEach((r) => {
      if (r['mood'] === null) r['mood'] = 0;
      map['engagement_avg'] += r['engagement'];
      map['mood_avg'] += r['mood'];
    });
    map['engagement_avg'] = map['engagement_avg'] / 10;
    map['mood_avg'] = map['mood_avg'] / 10;
    map['session_data'] = userData;
    report.push(map);
    delete userArrays[uuid];
  }
  return report;
}

module.exports = GenReport;
