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
  const invitedUsersLength = room.attendees.length - 1;
  const joinedUsersLength = students.length;
  const attendance = Math.min((joinedUsersLength / invitedUsersLength) * 100, 100);
  const studentData = await getStudentData(students);
  res.json({
    code: 200,
    error: false,
    message: '',
    data: {
      attendance,
      totalStudents: joinedUsersLength,
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
