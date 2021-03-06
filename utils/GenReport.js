// const red = require('redis');
const Reports = require('@models/reports.model');
const fdModel = require('@models/faceData.model');
const Sessions = require('@models/sessions.model');
const { createQuad } = require('./createQuad');

// const redis = red.createClient({
  // url: 'redis://:monet%40615@34.220.116.222:6379',
// }); // {auth_pass:"monet@615"} 54.218.77.251

const pieReport = async (roomid) => {
  let sessions = Sessions.find({ roomid }, 'uuid name');
  const fdData = fdModel.find({ roomid }, 'name uuid engagement mood webcam createdAt').sort({ createdAt: 1 });
  let duration = await fdModel.aggregate([
    {
      $match: { roomid: roomid },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        max_date: { $max: '$createdAt' },
        min_date: { $min: '$createdAt' },
      },
    },
  ]);
  duration = duration[0];
  const data = await Promise.resolve(fdData);
  if (data.length === 0 || !duration) {
    return [];
  }
  const nameArray = await Promise.resolve(sessions);
  return createQuad(nameArray, data, null, null, duration, true);
};

const overallAverageEngagement = async (roomid) => {
  const cTSegments = [];
  let tsDPS = {};
  let fdData = fdModel.aggregate([
    {
      $match: {
        roomid: roomid,
      },
    },
    {
      $group: {
        _id: '$createdAt',
        sumEngagement: { $sum: '$engagement' },
        sumMood: { $sum: '$mood' },
        countEngagement: { $sum: 1 },
      },
    },
  ]);
  let duration = await fdModel.aggregate([
    {
      $match: { roomid: roomid },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        max_date: { $max: '$createdAt' },
        min_date: { $min: '$createdAt' },
      },
    },
  ]);
  duration = duration[0];
  if (!duration) return;
  let max = new Date(duration.max_date),
    min = new Date(duration.min_date),
    tmp_min = min;
  while (tmp_min <= max) {
    cTSegments.push(tmp_min);
    tmp_min = new Date(tmp_min.getTime() + 5000);
  }
  const data = await fdData;
  for (let entry of data) {
    const { _id, sumMood, sumEngagement, countEngagement } = entry;
    const entryDate = new Date(_id);
    for (let i in cTSegments) {
      let dpi = parseInt(i);
      if (cTSegments[dpi + 1] === undefined) {
        break;
      }
      if (cTSegments[dpi] <= entryDate && entryDate <= cTSegments[dpi + 1]) {
        if (!tsDPS[cTSegments[dpi]]) tsDPS[cTSegments[dpi]] = [sumEngagement, countEngagement, sumMood];
        else {
          tsDPS[cTSegments[dpi]][0] += sumEngagement;
          tsDPS[cTSegments[dpi]][1] += countEngagement;
          tsDPS[cTSegments[dpi]][2] += sumMood;
        }
      }
    }
  }

  for (let key in tsDPS) {
    tsDPS[key][3] = Math.round(tsDPS[key][0] / tsDPS[key][1]); // on index 0 we have engagement
    tsDPS[key][4] = Math.round(tsDPS[key][2] / tsDPS[key][1]); // on index 2 we have mood and on index 1 we have count of users;
  }

  tsDPS = Object.keys(tsDPS).map((key) => {
    return { timestamp: key, average_engagement: tsDPS[key][3], average_mood: tsDPS[key][4] };
  });

  tsDPS.sort(function (x, y) {
    return new Date(x.timestamp) - new Date(y.timestamp);
  });
  return tsDPS;
};

const genReport = async (roomid, creator_ID, redis) => {
  try {
    console.log(`Generating report for roomId: ${roomid}`);
    redis.set(`report:${roomid}`, 1, () => {
      console.log('Flag set in Redis');
    });
    const pie = pieReport(roomid);
    const overall = overallAverageEngagement(roomid);
    const [pieData, overallEngagement] = await Promise.all([pie, overall]);
    return Reports.create({ roomid, creator_ID, pieData, overallEngagement }).then((report) => {
      redis.del(`report:${roomid}`, () => {
        console.log('Flag removed from Redis');
      });
      return report;
    });
  } catch (err) {
    redis.del(`report:${roomid}`, () => {
      console.log('Flag removed from Redis');
    });
    return undefined;
  }
};

module.exports = { pieReport, overallAverageEngagement, genReport };
