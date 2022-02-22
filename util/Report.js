const fs = require('fs');
const fdController = require('../controllers/faceData.controller');
const basePath = '/mnt/efs/fs1/data/';

async function Report(data) {
    const {uuid, roomid, name, room} = data;
    const userData = {};
    const arr = await fdController.fetchData(roomid, uuid);
    arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    arr.forEach(dfMap);
    if (arr.length > 10) {
        let totalEngagement = 0;
        let last_10 = arr.slice(Math.max(arr.length - 10, 1));
        last_10.forEach((r) => {
        totalEngagement += r['engagement'];
        });
        userData['engagement'] = totalEngagement / 10;
    }
    userData['uuid'] = uuid;
    userData['room'] = room;
    userData['roomid'] = roomid;
    userData['name'] = name;
    userData['session_data'] = arr;
    userData['std_id'] = uuid;
    if (fs.existsSync(`${basePath}${data.uuid}-webcam-video-0.mjr`)) {
    if (fs.existsSync(`${basePath}${data.uuid}-final-webcam.webm`)) {
      userData['video_path'] = {
        link: `www.monetlive.com/data/${data.uuid}-final-webcam.webm`, // `${basePath}${data.uuid}-webcam-video.mjr`,
        status: `Success`,
        code: 200,
      };
    } else {
      userData['video_path'] = {
        link: `-`,
        status: `Processing`,
        code: 102,
      };
    }
  } else {
    userData['video_path'] = {
      link: `-`,
      status: `Not-found`,
      code: 404,
    };
  }

  if (
    fs.existsSync(`${basePath}${data.uuid}___${data.uuid}-screen-video-0.mjr`) ||
    fs.existsSync(`${basePath}${data.uuid}___${data.uuid}-screen-video-1.mjr`)
  ) {
    if (fs.existsSync(`${basePath}${data.uuid}___${data.uuid}-screen.webm`)) {
      userData['screen_path'] = {
        link: `www.monetlive.com/data/${data.uuid}___${data.uuid}-screen.webm`, // `${basePath}${data.uuid}-webcam-video.mjr`,
        status: `Success`,
        code: 200,
      };
    } else {
      userData['screen_path'] = {
        link: `-`,
        status: `Processing`,
        code: 102,
      };
    }
  } else {
    userData['screen_path'] = {
      link: `-`,
      status: `Not-found`,
      code: 404,
    };
  }
  return userData;
}

module.exports = Report;

function dfMap(object, index, arr) {
  const { createdAt, mood, engagement } = object;
  arr[index] = {
    segment : index,
    createdAt,
    mood,
    engagement,
  };
}