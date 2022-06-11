const Rooms = require('@models/room.model');
const Reports = require('@models/reports.model');
const FaceData = require('@models/faceData.model');
const Sessions = require('@models/sessions.model');

const genPdf = async (roomid, creator_ID, redis) => {
  try {
    console.log(`Generating PDF data for ${roomid}`);
    redis.set(`pdf:${roomid}`, 1, () => console.log('Flag for PDF set in Redis'));
    const roomPromise = Rooms.findOne({ roomid }).lean();
    const sessionsPromise = Sessions.find({ roomid }).lean();
    const reportPromise = Reports.findOne({ roomid }).lean();
    const [room, sessions, report] = await Promise.all([roomPromise, sessionsPromise, reportPromise]);
    if (!room || !sessions) {
      return undefined;
    }
    const students = sessions.filter((session) => session.proctor === 'student' && !session.uuid.includes('___'));
    const invitedUsersLength = room.attendees.length ? room.attendees.length - 1 : 0;
    const joinedUsersLength = students.length;
    const attendance = Math.min((joinedUsersLength / invitedUsersLength) * 100, 100);
    const studentDataPromise = getStudentData(students);
    const speakingScorePromise = getSpeakingInfo(roomid);
    const [studentData, speakingScore] = await Promise.all([studentDataPromise, speakingScorePromise]);
    const callDuration = (new Date(room.end.dateTime) - new Date(room.start.dateTime)) / 1000;
    redis.del(`pdf:${roomid}`, () => {
      console.log('Flag for pdf removed from Redis');
    });
    const pdf = {
      attendance,
      callDuration,
      totalStudents: joinedUsersLength,
      speakingScore,
      overallEngagement: report?.report?.averageEngagement || null,
      students: studentData,
    };
    Reports.findOneAndUpdate({ roomid }, { pdf, creator_ID }, { upsert: true });
    return pdf;
  } catch (err) {
    console.log('Generate report PDF error', err);
    redis.del(`pdf:${roomid}`, () => {
      console.log('Flag for pdf removed from Redis');
    });
    return undefined;
  }
};

const getStudentData = async (students) => {
  return new Promise(async (resolve) => {
    const studentsData = {};
    const studentFaceDataIndex = {};
    const faceDataPromise = [];
    students.forEach((student, index) => {
      studentFaceDataIndex[index] = student.uuid;
      studentsData[student.uuid] = { name: student.name, uuid: student.uuid };
      faceDataPromise.push(FaceData.find({ roomid: student.roomid, uuid: student.uuid }).lean());
    });
    const pData = await Promise.all(faceDataPromise);
    pData.forEach(async (studentFD, index) => {
      let totalEngagement = 0;
      let averageEngagement = 0;
      studentFD.forEach((data) => (totalEngagement += data.engagement));
      averageEngagement = totalEngagement / studentFD.length;
      studentsData[studentFaceDataIndex[index]].averageEngagement = averageEngagement;
      if (index === students.length - 1) resolve(Object.values(studentsData));
    });
  });
};

const getSpeakingInfo = async (roomid) => {
  const room = await Rooms.findOne({ roomid }).lean();
  const { realTimeScores } = room.settings;
  const roomDuration = Math.abs(new Date(room.end.dateTime).getTime() - new Date(room.start.dateTime).getTime()) / 1000;
  const sessionData = await FaceData.find({ roomid, speaking: 1 }).lean();
  const finalData = {};
  sessionData.forEach((data) => {
    const { uuid } = data;
    if (finalData[uuid]) {
      if (finalData[uuid].data) {
        finalData[uuid].data.push(data);
        finalData[uuid].counter += 1;
      } else {
        finalData[uuid].data = [data];
        finalData[uuid].counter = 1;
      }
    } else {
      finalData[uuid] = { data: [data], counter: 1 };
    }
  });
  let totalSpeakingDuration = 0;
  for (let uuid in finalData) {
    finalData[uuid].duration = finalData[uuid].counter * realTimeScores;
    totalSpeakingDuration += finalData[uuid].duration;
  }
  const averageSpeakingDuration = totalSpeakingDuration / Object.keys(finalData).length;
  const roomSpeakingScore = Math.min((averageSpeakingDuration / roomDuration) * 100, 100);
  return roomSpeakingScore;
};

module.exports = genPdf;
