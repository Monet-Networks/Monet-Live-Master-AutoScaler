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
const bodyParser = require('body-parser'),
  { Router } = require('express');
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
const assignments = require('@models/assignment.model');
const plangrp = require('@models/planGroups.model');
const notification = require('@models/notification.model');
const country_state = require('@models/countrystate.model');
const country = require('@models/country.model');

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

admin.delete('/room/:id', (req, res) => roomController.delete(req, res));

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
  if (roomid) room = await getRoom(roomid);
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

admin.post('/getAllScheduleInviteRooms', function (req, res) {
  roomController.getAllScheduleRooms(req, res).then(() => {
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

admin.get('/getPdfData', async (req, res) => {
  const { roomid } = req.query;
  const report = redis.get(`pdf:${roomid}`);
  if (report === '1') {
    return res.json({
      code: 202,
      error: false,
      message: 'PDF data is generating',
    });
  } else {
    try {
      const report = await Reports.findOne({ roomid });
      if (!report || !report.pdf) {
        return res.json({
          code: 404,
          error: true,
          message: 'Report data not found',
        });
      } else {
        res.json({
          code: 200,
          error: false,
          message: 'PDF data found',
          pdf: report.pdf,
        });
      }
    } catch (error) {
      console.log('getPdfData error', error);
      res.json({ code: 500, error: true, message: error });
    }
  }
});

admin.get('/generatePdfData', (req, res) => reportsController.reportPdf(req, res, redis));

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

admin.post('/register-user', userController.registerUser);

admin.put('/forget-password', userController.forgetPassword);

admin.put('/reset-password/:token', userController.resetPassword);

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
  let planobject;
  if (!email) {
    return res.json({
      code: 400,
      error: true,
      message: 'email is a required field',
    });
  }
  const userD = await user.findOne({ email: email }).lean();
  if (!userD) {
    return res.json({
      code: 404,
      error: false,
      message: 'user not found for the email',
    });
  }
  const planType = userD.plan.type;
  planobject = await plan.find({ planUid: userD.plan.planUid }).lean();

  res.json({
    code: 200,
    error: false,
    message: 'Plan details  Found',
    data: planobject,
    planType,
  });
});

admin.post('/v2/getreportsList', function (req, res) {
  roomController.V2getAllRooms(req, res).then(() => {
    /* don't do anything */
  });
});

admin.post('/auth/authentication', async (req, res) => {
  try {
    const { token } = req.body;
    let user = await auth.authenticate(token, true);
    if (!user) {
      return res.json({
        code: 401,
        error: true,
        message: 'Invalid token or token expired',
      });
    }
    user = await RemainingHours.addRemainingHours(user);
    const userPlan = await plan.find({ planUid: user.plan.planUid });
    if (!userPlan) {
      return res.json({
        code: 400,
        error: true,
        message: 'Invalid request please try again',
      });
    }
    res.json({
      code: 200,
      error: false,
      message: 'Details found',
      data: { user, userPlan },
    });
  } catch (err) {
    res.json({
      code: 400,
      error: true,
      message: 'Something went wrong',
      response: err,
    });
  }
});
admin.get('/assignmentscore', async (req, res) => {
  try {
    const { roomid } = req.query;
    let data = {};
    let score = [];
    const faceData = await FaceData.find(
      {
        roomid: roomid,
      },
      { engagement: 1, mood: 1, _id: 0, uuid: 1 }
    ).lean();
    faceData.forEach((item) => {
      if (data[item.uuid]) {
        data[item.uuid].overallEngagement += item.engagement;
        data[item.uuid].overallMood += item.mood;
        data[item.uuid].count += 1;
      } else {
        data[item.uuid] = {
          overallEngagement: item.engagement,
          overallMood: item.mood,
          count: 1,
        };
      }
    });
    let rawAssigmentCount = [];

    const attempStudents = await (
      await Sessions.find({ roomid: roomid, proctor: 'student' }, { name: 1, uuid: 1, _id: 0 }).lean()
    ).filter((item) => !item.uuid.includes('___'));

    const assigmentCount = await assignments.find({ roomId: roomid });

    assigmentCount.forEach((item) => {
      const submision = assignments.findById(item.id, { submissions: 1, title: 1, _id: 0 }).lean();
      rawAssigmentCount.push(submision);
    });
    const assigmentCountData = await Promise.all(rawAssigmentCount);
    assigmentCountData.forEach((submision) => {
      let participants = [];
      attempStudents.forEach((item, index) => {
        let rightanswer = 0;
        let wronganswer = 0;
        submision.submissions.forEach((submission) => {
          if (submission.uuid === item.uuid) {
            if (submission.correct === true) {
              rightanswer += 1;
            } else if (submission.correct === false) {
              wronganswer += 1;
            }
          }
        });

        const overallEngagement = data[item.uuid].overallEngagement / data[item.uuid].count;
        const overallMood = data[item.uuid].overallMood / data[item.uuid].count;
        const totalQuestion = rightanswer + wronganswer;
        if (totalQuestion === 0) {
          const score = ' Not attempted';
          const rawscore = {
            ...item,
            score,
            totalQuestion,
            rightanswer,
            wronganswer,
            overallEngagement,
            overallMood,
          };
          participants.push(rawscore);
        } else {
          const score = (rightanswer / totalQuestion) * 100;
          const rawscore = {
            ...item,
            rightanswer,
            wronganswer,
            totalQuestion,
            score,
            overallEngagement,
            overallMood,
          };
          participants.push(rawscore);
        }
      });

      const title = submision.title;
      score.push({ title, participants });
    });

    res.json({
      code: 200,
      error: false,
      message: 'Assignments Score ',
      score,
    });
  } catch (err) {
    res.json({
      code: 400,
      error: true,
      message: 'Something went wrong',
      response: err.message,
    });
  }
});

admin.post('/register-invited-user', userController.registerInvitedUser);

admin.get('/notification', async (req, res) => {
  const { email } = req.query;
  if (email) {
    const reportsData = await user.findOne({ email: email }, { plan: 1 }).lean();
    if (reportsData) {
      const usergroup = await plangrp.findOne({ uid: reportsData.plan.groupUid }).lean();

      const date1 = new Date(reportsData.plan.expiresAt);
      const date2 = new Date(Date.now());
      const days = Math.round((date1.getTime() - date2.getTime()) / (1000 * 3600 * 24));
      let data = [];
      if (days < 4 || usergroup.leftHours <= 1) {
        switch (true) {
          case usergroup.leftHours <= 1 && usergroup.leftHours > 0:
            data.push(`Total remaining hours: ${usergroup.leftHours}hr. Please upgrade your plan`);
            break;
          case usergroup.leftHours <= 0:
            data.push(`You consumed your Total ${usergroup.totalHours} hours. Please upgrade your plan`);
            break;
        }
        switch (true) {
          case days < 4 && days > 0:
            data.push(`Your plan will expire in ${days} days. Please upgrade your plan`);
            break;
          case days <= 0:
            data.push(`You plan expired. Please upgrade your plan`);
        }
        const message = await Promise.all(data);
        const messageStore = await notification.create({
          email: email,
          message: message,
        });
        res.json({
          code: 200,
          error: false,
          message: 'Notfication',
          data: message,
        });
      } else {
        res.json({
          code: 200,
          error: false,
          message: ' No Notfication',
          data: [],
        });
      }
    }
  } else {
    res.json({
      code: 200,
      error: false,
      message: 'email not found',
    });
  }
});

admin.get('/notificationDetails', async (req, res) => {
  const { email } = req.query;

  const message = await notification.find({ email: email, read: false }, { message: 1 }).lean();
  if (message) {
    res.json({
      code: 200,
      error: false,
      message: 'Notfication',
      data: message,
    });
  } else {
    res.json({
      code: 200,
      error: false,
      message: ' No Notfication',
      data: [],
    });
  }
});

admin.put('/markasread', async (req, res) => {
  const { id, email } = req.query;
  if (id) {
    await notification.findOneAndUpdate({ _id: id }, { read: true });

    res.json({
      code: 200,
      error: false,
      message: 'Notfication read successfully',
    });
  } else if (email) {
    await notification.updateMany({ email: email }, { read: true });
    res.json({
      code: 200,
      error: false,
      message: 'All Notfication read successfully',
    });
  } else {
    res.json({
      code: 400,
      error: true,
      message: 'id required',
    });
  }
});

admin.delete('/deletecard', async (req, res) => {
  const { id, email } = req.query;
  if (id && email) {
    const userDe = await user.findOne({ email: email });
    if (userDe) {
      userDe.cards.filter((r, i) => {
        if (r._id.toString() === id) {
          userDe.cards.splice(i, 1);
        }
      });
      await userDe.save();
      res.json({
        code: 200,
        error: false,
        message: 'Card deleted successfully',
      });
    } else {
      res.json({
        code: 200,
        error: false,
        message: 'User Details not found ',
      });
    }
  } else {
    res.json({
      code: 400,
      error: true,
      message: 'something went wrong  ',
    });
  }
});

admin.get('/cardsDetails', async (req, res) => {
  const { email } = req.query;
  const card = await user.findOne({ email: email }, { cards: 1, _id: 0 }).lean();
  if (card) {
    res.json({
      code: 200,
      error: false,
      message: 'Cards Detials',
      cards: card.cards,
    });
  } else {
    res.json({
      code: 200,
      error: false,
      message: 'Cards Detials not found',
    });
  }
});
admin.get('/country', async (req, res) => {
  const country_list = await country.find({}).lean();

  res.json({
    code: 200,
    error: false,
    message: 'country_list',
    data: country_list,
  });
});
admin.get('/countryState', async (req, res) => {
  const { id } = req.query;
  const countryStatelist = await country_state.find({ country_id: id }).lean();
  res.json({
    code: 200,
    error: false,
    message: 'country_list',
    data: countryStatelist,
  });
});
const durationCalculator = (start, end) => {
  return (new Date(end) - new Date(start)) / 1000;
};

module.exports = admin;
