const Sessions = require('../models/sessions.model');

exports.getUsersBySid = async function ({ sid }) {
  let result = await Sessions.findOne({ sid });
  return result;
};

exports.updateOne = async (uuid, value) => {
  const updatedUser = await Sessions.findOneAndUpdate({ uuid }, value, { new: true });
  return updatedUser;
};

exports.getUser = async ({ uuid }) => {
  let result = await Sessions.findOne({ uuid });
  return result;
};

exports.userList = async (req, res) => {
  const { id } = req.query;
  const teacher = await Sessions.findOne({ roomid: id, proctor: 'teacher' });
  if (!teacher) {
    return res.json({
      code: 200,
      error: false,
      message: 'The moderator has not joined.',
      response: [],
    });
  }
  const users = await Sessions.find({ roomid: id });
  if (!users) {
    return res.json({
      code: 404,
      error: true,
      message: 'No users in the room',
      response: 'error',
    });
  }
  const responses = [];
  const info = {
    id: req.query.id,
    students: [],
  };
  for (let s of users) {
    let examData = {
      active: s.active,
      std_id: s.uuid,
      roomid: s.roomid,
      name: s.name,
      proctor: s.proctor,
      raiseHand: s.janus.raiseHand,
      webcam: s.janus.webcam,
      screen: s.janus.screen,
      audio: s.janus.audio,
      video: s.janus.video,
      time: s.time,
      serverIP: s.serverIP,
    };
    if (s.proctor !== 'teacher' || s.proctor !== 'moderator') info.students.push(examData);
  }
  responses.push(info);
  if (responses.length !== 0)
    return res.json({
      code: 200,
      error: false,
      message: 'user list',
      response: info.students,
    });
  else console.log('There is no student detail in the array');
};

exports.janusStatusToggle = async (roomId, key, status) => {
  const upKey = 'janus.' + key;
  const res = await Sessions.updateMany({ roomid: roomId }, { $set: { [upKey]: status } });
  return res;
};
