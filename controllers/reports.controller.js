const Rooms = require('@models/room.model');
const Reports = require('@models/reports.model');
const FaceData = require('@models/faceData.model');
const Sessions = require('@models/sessions.model');

exports.reportPdf = async (req, res) => {
  const { roomid } = req.query;
  const roomPromise = Rooms.findOne({ roomid });
  const sessionsPromise = Sessions.find({ roomid });
  const reportPromise = Reports.findOne({ roomid });
  const [room, sessions, report] = await Promise.all([roomPromise, sessionsPromise, reportPromise]);
  if (!room || !sessions || !report) {
    return res.json({ code: 404, error: true, message: 'Room data not found' });
  }
  const students = sessions.filter((session) => session.proctor === 'student' && !session.uuid.includes('___'));
  const invitedUsersLength = room.attendees.length ? room.attendees.length - 1 : 0;
  const joinedUsersLength = students.length;
  const attendance = Math.min((joinedUsersLength / invitedUsersLength) * 100, 100);
  const studentDataPromise = getStudentData(students);
  const speakingScorePromise = getSpeakingInfo(roomid);
  const [studentData, speakingScore] = await Promise.all([studentDataPromise, speakingScorePromise]);
  res.json({
    code: 200,
    error: false,
    message: 'Data fetched successfully',
    data: {
      attendance,
      totalStudents: joinedUsersLength,
      speakingScore,
      overallEngagement: report.report.averageEngagement,
      students: studentData,
    },
  });
};

const getStudentData = async (students) => {
  return new Promise(async (resolve) => {
    const studentsData = {};
    const faceDataPromise = [];
    students.forEach((student) => {
      studentsData[student.uuid] = { name: student.name, uuid: student.uuid };
      faceDataPromise.push(FaceData.find({ roomid: student.roomid, uuid: student.uuid }));
    });
    const pData = await Promise.all(faceDataPromise);
    pData.forEach(async (studentFD, index) => {
      let totalEngagement = 0;
      let averageEngagement;
      studentFD.forEach((data) => (totalEngagement += data.engagement));
      averageEngagement = totalEngagement / studentFD.length;
      studentsData[studentFD[0].uuid].averageEngagement = averageEngagement;
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
  const roomSpeakingScore = (averageSpeakingDuration / roomDuration) * 100;
  return roomSpeakingScore;
};
