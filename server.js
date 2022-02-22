require('dotenv').config();
const red = require('redis');
const express = require('express');
const bodyParser = require('body-parser');
const admin = express();
const { createServer } = require('http');
const { Server } = require('socket.io');
const { log } = require('console');
const db = require('./modules/db');
const Engine = require('./modules/scaleEngine');
const { googleAuth } = require('./controllers/user.controller');
const {
  getInstances,
  createOneInstance,
  getInstance,
  freeAllInstances,
  deleteInstance,
  updateImageId,
  getAllAutoInstances,
} = require('./controllers/instance.controller');
const { getRoom } = require('./controllers/room.controller');
const CreateConfiguration = require('./modules/createConfig');
const AWSConfiguration = require('./modules/awsConfig');
const IController = new AWSConfiguration();
const SuccessHandler = require('./util/SuccessHandler');
const Reports = require('./models/reports.model');
const sessionController = require('./controllers/sessions.controller');
const MonetIO = require('./modules/websockets');
const ErrorHandler = require('./util/ErrorHandler');
const Report = require('./util/Report');
const GenReport = require('./util/GenReport');
let redis;

const PORT = process.env.PORT || 3000;

(async () => {
  redis = red.createClient({
    url: 'redis://:monet%40615@34.220.116.222:6379',
  });
  redis.on('error', (err) => console.log('Redis Client Error', err));
  await redis.connect();
})();

/* Instantiate the engine class */
const engine = new Engine();
engine.DBEntryFunction(getAllAutoInstances);
engine.on('create-instance', ({ name }) => {
  console.log('Instance creation signal with name : ', name);
  /* Check whether this object needs to be recorded or not. */
  IController.createInstance(name)
    .then((data) => engine.addInternalIpImageId(data))
    .catch((err) => console.log('An error occured while attempting to create instance. Kindly check. : ', err));
});

engine.on('delete-instance', async (instance) => {
  console.log(instance);
  const awsInstanceData = await IController.deleteInstance(instance.ImageId);
  await deleteInstance(instance.publicIP);
  engine.deleteConfirmation(awsInstanceData);
});

engine.on('up-instance-image', async ({ ImageId, privateIP }) => {
  const update = await updateImageId(ImageId, privateIP);
  console.log(`The update status for ${privateIP} is `, update);
});

const httpServer = createServer(admin);
const io = new Server(httpServer, {
  /* options */
  path: '/sock',
  transports: ['websocket'],
});

new db();
new MonetIO(io);

const instanceRegistrationHandle = async (req, res) => {
  await createOneInstance(req, res, ({ error, success }) => {
    if (error) return console.log('Instance creation error : ', error);
    console.log('Instance creation success : ', success, Object.keys(success));
    if (success) if (success.publicIP) engine.addInstance(success);
  });
};

admin.use(bodyParser.json());
admin.use('/test', express.static('tests'));

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

admin.get('/getRoomIp', async (req, res) => {
  const { roomid } = req.query;
  const room = await getRoom(roomid);
  if (!room) return res.json({ code: 404, error: true, message: 'Room not found' });
  res.json({ code: 200, error: false, message: 'Room found', room });
});

admin.get('/register-instance', instanceRegistrationHandle);

admin.get('/get-link', getInstance);

admin.get('/free-all-instances', freeAllInstances);

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
    return res.json({ code: 200, error: false, message: 'Report already exists', report: reportExists });
  }
  const report = await GenReport(roomid, creator_ID);
  if (!report) {
    return res.json({
      code: 404,
      error: true,
      message: `Could not generate report for roomid: ${roomid} & creator_ID: ${creator_ID}. Please check`,
    });
  } else if (report.length === 0)
    return res.json({
      code: 202,
      error: false,
      message: `Generating report.`,
    });
  else return es.json({ code: 200, error: false, message: 'Report generated successfully', report });
})

httpServer.listen(PORT, () => log(`[Server OK]`));