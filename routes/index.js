const { googleAuth, login } = require('@controllers/user.controller');
const { log } = require('console');
const red = require('redis');
const { getInstances, getInstance, freeAllInstances } = require('@controllers/instance.controller');
const SuccessHandler = require('@utils/SuccessHandler');
const { getRoom, saveRoom } = require('@controllers/room.controller');
const fileController = require('@controllers/file.controller');
const sessionController = require('@controllers/sessions.controller');
const reportsController = require('@controllers/reports.controller');
const roomController = require('@controllers/room.controller');
const ErrorHandler = require('@utils/ErrorHandler');
const Report = require('@utils/Report');
const userController = require('@controllers/user.controller');
const { genReport } = require('@utils/GenReport');
const planController = require('@controllers/plans.controller');
const stripeController = require('@controllers/stripe.controller');
const planGroupsController = require('@controllers/planGroups.controller');
const fdController = require('@controllers/faceData.controller');
const Reports = require('@models/reports.model');
const Rooms = require('@models/room.model');
const CreateConfiguration = require('@modules/createConfig');
const { Router } = require('express');
const sendMail = require('@utils/sendMail');
const roomEmails = {};
const Sessions = require('@models/sessions.model');
const admin = Router();
const debug = require('debug');
const FaceRouter = require('@routes/face.recognition');
const plan = require('@models/plans.model');
const user = require('@models/user.model');
const auth = require('@utils/auth');
const RemainingHours = require('@utils/users');
const monet = {
  vdebug: debug('websocket:vdebug'),
  debug: debug('websocket:debug'),
  err: debug('websocket:error'),
  warn: debug('websocket:warn'),
  info: debug('websocket:info'),
};

let redis;

(async () => {
  redis = red.createClient({
    url: 'redis://:monet%40615@54.245.160.54:6379',
  });
  redis.on('error', (err) => console.log('Redis Client Error', err));
  await redis.connect();
})();

admin.get('/reset-engine-state', (req, res) => {
  if (req.query.secret === 'monet@43324') {
    engine.resetState();
    res.json({
      message: 'success',
    });
  } else {
    res.json({
      message: "please don't use this api",
    });
  }
});

admin.post('/auth/google', googleAuth);

admin.get('/configure-instances', async (req, res) => {
  log('configure instance call.');
  const ips = await getInstances();
  new CreateConfiguration(ips);
  return new SuccessHandler(res, 200, 'IPs configured', ips);
});

admin.post('/auth/microsoft', userController.microsoftAuth);

admin.post('/login', login);

admin.get('/getRoomIp', async (req, res) => {
  const { roomid } = req.query;
  const room = await getRoom(roomid);
  if (!room) return res.json({ code: 404, error: true, message: 'Room not found' });
  res.json({ code: 200, error: false, message: 'Room found', room });
});

admin.get('/get-link', getInstance);

admin.get('/free-all-instances', freeAllInstances);

admin.post('/inviteRoom', saveRoom);

admin.get('/getInviteRoom', async (req, res) => {
  let room;
  const roomid = req.query.roomid;
  if (roomid) room = await getRoom();
  if (room)
    return res.json({
      code: 201,
      error: false,
      message: 'The room exists',
      response: room,
    });
  else
    return res.json({
      code: 404,
      error: true,
      message: 'The room does not exists',
    });
});

admin.post('/getAllInviteRooms', function (req, res) {
  roomController.getAllRooms(req, res).then(() => {
    /* don't do anything */
  });
});

admin.get('/getReportData', async (req, res) => {
  const { roomid } = req.query;
  const report = redis.get(`report:${roomid}`);
  if (report === '1') {
    return res.json({
      code: 202,
      error: false,
      message: 'Report is generating',
    });
  } else {
    try {
      const report = await Reports.findOne({ roomid });
      if (!report) {
        return res.json({
          code: 404,
          error: true,
          message: 'Report data not found',
        });
      } else {
        res.json({
          code: 200,
          error: false,
          message: 'Report data found',
          report,
        });
      }
    } catch (error) {
      console.log('getReportData error', error);
      res.json({ code: 400, error: true, message: error });
    }
  }
});

admin.post('/addFinalReport', async (req, res) => {
  if (!req.body.roomid || !req.body.report) return new ErrorHandler(res, 404, 'Missing parameters in body');
  const { roomid, report } = req.body;
  const Report = await Reports.findOneAndUpdate({ roomid }, { report }, { new: true });
  if (!Report) {
    res.json({
      code: 404,
      error: true,
      message: 'Invalid roomId data not found',
    });
  }
  res.json({
    code: 200,
    error: false,
    message: 'Report added',
    report: Report,
  });
});

admin.get('/report', async (req, res) => {
  const user = await sessionController.getUser({ uuid: req.query.id });
  if (user && user.name) {
    const report = await Report(user);
    if (report) {
      res.json({
        code: 200,
        error: false,
        message: 'user report',
        response: report,
      });
    } else {
      res.json({
        code: 400,
        error: true,
        message: 'Error generating report',
        response: 'The report has not been generated',
      });
    }
  }
});

admin.post('/generateReport', async (req, res) => {
  const { roomid, creator_ID } = req.body;
  const reportExists = await Reports.findOne({ roomid });
  if (reportExists) {
    return res.json({
      code: 200,
      error: false,
      message: 'Report already exists',
      report: reportExists,
    });
  }
  const report = await genReport(roomid, creator_ID, redis);
  if (!report) {
    return res.json({
      code: 404,
      error: true,
      message: `Could not generate report for roomid: ${roomid} & creator_ID: ${creator_ID}. Please check`,
    });
  } else
    return res.json({
      code: 200,
      error: false,
      message: 'Report generated successfully',
      report,
    });
});

admin.get('/report-pdf', reportsController.reportPdf);

admin.get('/my-meetings', async (req, res) => {
  const { creator_ID, timeline } = req.query;
  const [start, end] =
    timeline === 'day'
      ? [new Date(new Date().setHours(0, 0, 0, 0)), new Date(new Date().setHours(23, 59, 59, 999))]
      : timeline === 'week'
      ? [
          new Date(new Date().setHours(0, 0, 0, 0).valueOf() - 6 * 24 * 60 * 60 * 1000),
          new Date(new Date().setHours(23, 59, 59, 999)),
        ]
      : [
          new Date(new Date().setHours(0, 0, 0, 0).valueOf() - 29 * 24 * 60 * 60 * 1000),
          new Date(new Date().setHours(23, 59, 59, 999)),
        ];
  const reportsData = Reports.find({ creator_ID });
  const userRoomsData = Rooms.find({
    creator_ID,
    'start.dateTime': { $gte: new Date(start) },
    'end.dateTime': { $lte: new Date(end) },
  });
  let [reports, userRooms] = await Promise.all([reportsData, userRoomsData]);
  let duration = 0;
  userRooms = userRooms.filter((room) => {
    if (new Date(room.start.dateTime) < new Date(room.end.dateTime)) {
      duration += durationCalculator(room.start.dateTime, room.end.dateTime);
      return room;
    }
  });
  const meetings = userRooms.length;
  let overallEngagement = 0;
  let overallMood = 0;
  reports.forEach(({ report }) => {
    if (report) {
      overallEngagement += report.averageEngagement;
      overallMood += report.averageMood;
    }
  });
  let overallAverageEngagement = overallEngagement / reports.length;
  let overallAverageMood = overallMood / reports.length;
  res.json({
    code: 200,
    error: false,
    message: 'Details fetched for the user',
    data: { meetings, duration, overallAverageEngagement, overallAverageMood },
  });
});

admin.post('/upFile', fileController.fileUpload);

admin.get('/downFile/:file', fileController.fileDownload);

admin.post('/create-payment-intent', stripeController.createPaymentIntent);

admin.get('/userStatus', stripeController.userStatus);

admin.post('/addPaymentMethod', stripeController.paymentMethod);

admin.post('/webhooks', stripeController.handleWebhook);

admin.put('/selectPlan', userController.selectPlan);

admin.post('/getRecordings', roomController.getAdminRecordings);

admin.get('/getPlan', planController.getPlan);

admin.get('/getAllPlans', planController.getAllPlans);

admin.post('/createPlan', planController.createPlan);

admin.put('/updatePlan', planController.updatePlan);

admin.delete('/deletePlan', planController.deletePlan);

admin.put('/assignPlan', planController.assignPlan);

admin.put('/updateMeetingHours', planGroupsController.updateMeetingHours);

admin.put('/updateSetting', userController.userSettings);

admin.get('/getPlanGroupDetails', planGroupsController.getPlanGroupDetails);

admin.post('/sendAdminEmail', async function (req, res) {
  const { Admin: email, Name, Attendees, Link, Date, Duration, Summary: Topic, RoomId } = req.body;
  roomEmails[RoomId] = { email, name: Name, topic: Topic };
  const info = await sendMail(
    '../views/admin.handlebars',
    email,
    `[Monet Live] Report for ${Topic} is available on Monet Live`,
    {
      Name,
      Attendees,
      Link,
      Date,
      Duration,
      Topic,
    },
    'anand@monetnetworks.com'
  );
  return res.json({
    code: 200,
    error: false,
    message: 'List participate',
    response: info.response,
  });
});

admin.post('/sendEmails', async function (req, response) {
  try {
    const emails = req.body.email;
    let emailArr = emails.split(',');
    const subject = req.body.subject;
    const roomId = req.body.roomId;
    // var dateandtime = req.body.dateandtime;
    const joinLink = req.body.joinLink;
    const startDate = req.body.startdate;
    const stopDate = req.body.stopdate;
    if (Array.isArray(emailArr)) {
      // let responseArr = [];
      let index = 0;
      while (index < emailArr.length) {
        if (typeof emailArr[index] == 'string') {
          const email = emailArr[index];
          await sendMail('../views/index.handlebars', email, `[Monet Live] ${subject}`, {
            roomId: roomId,
            startDate: startDate,
            stopDate: stopDate,
            joinLink: joinLink,
          });
        }
        index++;
      }
      try {
        NoOfInvites[roomId] = index;
      } catch (err) {
        console.log(err);
      }

      response.json({
        code: 200,
        error: false,
        message: 'List Invites',
        subject: subject,
        NumberOfInvites: NoOfInvites[roomId],
        // response: responseArr,
        startDate: startDate,
        stopDate: stopDate,
      });
    }
  } catch (err) {
    response.json({
      code: 400,
      error: true,
      message: 'Caught error while sending Emails.',
      response: error,
    });
  }
});

admin.post('/sendEmail', async function (req, response) {
  const { Admin: email, Name, Attendees, Link, Date, Duration } = req.body;
  const content = {
    Name,
    Attendees,
    Link,
    Date,
    Duration,
  };
  // const email = req.body.email;
  // const content = req.body.content;
  // const name = req.body.name;
  // const dateandtime = req.body.dateandtime;
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    //secure: false, // true for 465, false for other ports
    service: 'gmail',
    auth: {
      user: 'admin@monetlive.com',
      pass: 'xnfoogozwbfoemgm',
    },
  });

  const mailOptions = {
    from: 'admin@monetlive.com', // 'atul@ashmar.in'
    to: email,
    subject: 'Monet Support',
    text: JSON.stringify(content),
  };

  const info = await transporter.sendMail(mailOptions);
  response.json({
    code: 200,
    error: false,
    message: 'List participate',
    response: info.response,
  });
});

admin.get('/getScreenShareDetails', sessionController.getScreenShareDetails);

admin.get('/avg-engagement-req', async function (req, res) {
  try {
    const data = req.query;
    monet.debug('The engagement request : ', data);
    let report = await getReport(data);
    res.json(report);
  } catch (err) {
    res.json(err.message);
  }
});

admin.use('/face', FaceRouter);

const getReport = async (data) => {
  const report = [];
  const userArrays = {};
  const { roomid } = data;
  const sessionData = await fdController.fetchSession(roomid);
  const userList = await Sessions.find({ roomid: roomid });
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
};

admin.post('/sendAdminMosaic', async (req, res) => {
  const { RoomId, screen } = req.body;
  monet.debug('Send Admin Mosaic Details: ', roomEmails);
  if (!roomEmails[RoomId]) {
    console.log('No data in room Email dictionary');
    return res.json({
      code: 400,
      error: true,
      message: 'No data in room Email dictionary',
    });
  }
  const { email, name, topic } = roomEmails[RoomId];
  const info = await sendMail(
    '../views/mosaic.handlebars',
    email,
    `[Monet Live] Recording for ${topic} is available on Monet Live`,
    {
      name,
      link: screen
        ? `https://www.monetlive.com/data/${RoomId}-final-mosaic.mp4`
        : `https://www.monetlive.com/data/${RoomId}-mosaic.mp4`,
      topic,
    },
    'anand@monetnetworks.com'
  );
  return res.json({
    code: 200,
    error: false,
    message: 'List participate',
    response: info.response,
  });
});

admin.get('/userPlanDetails', async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.json({
      code: 400,
      error: true,
      message: 'email is a required field',
    });
  }
  const userD = await user.find({ email: email }).lean();
  if (!userD) {
    return res.json({
      code: 404,
      error: false,
      message: 'user not found for the email',
    });
  }
  userD.forEach(async (users) => {
    planobject = await plan.find({ planUid: users.plan.planUid }).lean();

    res.json({
      code: 200,
      error: false,
      message: 'Plan details  Found',
      data: planobject,
    });
  });
});

admin.post('/v2/getreportsList', function (req, res) {
  roomController.V2getAllRooms(req, res).then(() => {
    /* don't do anything */
  });
});

admin.post('/authentication', async (req, res) => {
  try {
    const token = req.body;
    const users = await auth.authenticate(token, true);
    const remainingHours = await RemainingHours.addRemainingHours(user);
    const userPlan = await plan.find({ planUid: users.plan.planUid });

    res.json({
      code: 200,
      error: false,
      message: ' details  Found',
      data: user,
      remainingHours,
      userPlan,
    });
  } catch (err) {
    res.json({
      code: 400,
      error: true,
      message: 'token not found',
      response: err,
    });
  }
});

const durationCalculator = (start, end) => {
  return (new Date(end) - new Date(start)) / 1000;
};

module.exports = admin;
