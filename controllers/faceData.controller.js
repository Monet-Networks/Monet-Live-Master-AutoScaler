const fdModel = require('@models/faceData.model');
// const { createQuad } = require('@utils/createQuad');
// const UserModel = require('@models/users.model.js');
// const Sessions = require('@models/sessions.model');
// const { overallAverageEngagement } = require('@utils/genReport');

exports.saveBatch = (batch) => {
  if (Array.isArray(batch)) {
    fdModel.insertMany(batch).then(() => {});
  }
};

exports.fetchData = (roomid, uuid) => {
  return fdModel.find({ roomid, uuid }).sort({ segment: 'asc' });
};

exports.fetchSession = (roomid) => {
  return fdModel.find({ roomid });
};

// exports.overallAverage = async (req, res) => {
//   const tsDPS = await overallAverageEngagement(req.query.roomid);
//   res.json({
//     code: 200,
//     error: false,
//     message: 'overall session engagement',
//     response: tsDPS,
//   });
// };

// exports.pieReport = async (req, res) => {
//   const { roomid } = req.query;
//   let sessions = Sessions.find({ roomid }, 'uuid name');
//   const fdData = fdModel.find({ roomid }, 'name uuid engagement mood webcam createdAt').sort({ createdAt: 1 });
//   let duration = await fdModel.aggregate([
//     {
//       $match: { roomid: roomid },
//     },
//     {
//       $group: {
//         _id: null,
//         count: { $sum: 1 },
//         max_date: { $max: '$createdAt' },
//         min_date: { $min: '$createdAt' },
//       },
//     },
//   ]);
//   duration = duration[0];
//   const data = await Promise.resolve(fdData);
//   if (data.length === 0 || !duration) {
//     return res.json({
//       code: 400,
//       error: true,
//       message: 'Error generating report',
//       response: 'No entry in the db!',
//     });
//   }
//   const nameArray = await Promise.resolve(sessions);
//   createQuad(nameArray, data, req, res, duration);
// };
