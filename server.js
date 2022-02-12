require('dotenv').config();
const express = require('express');
const admin = express();
const { log } = require('console');
const db = require('./modules/db');
const Engine = require('./modules/engine');
const { googleAuth } = require('./controllers/user.controller');
const {
  getInstances,
  createOneInstance,
  getInstance,
  freeAllInstances,
  deleteInstance,
} = require('./controllers/instance.controller');
const { getRoom } = require('./controllers/room.controller');
const CreateConfiguration = require('./modules/createConfig');
const AWSConfiguration = require('./modules/awsConfig');
const SuccessHandler = require('./util/SuccessHandler');
const ErrorHandler = require('./util/ErrorHandler');

const PORT = process.env.PORT || 3000;

/* Instantiate the engine class */
const engine = new Engine();
engine.on('create-instance', ({ name }) => {
  console.log('Instance creation signal with name : ', name);
});
engine.on('delete-instance', (instance) => {
  deleteInstance(instance.publicIP);
});

new db();

const instanceRegistrationHandle = async (req, res) => {
  await createOneInstance(req, res, ({ error, success }) => {
    if (error) return console.log('Instance creation error : ', error);
    if (success) if (success.publicIP) engine.addInstance(success);
  });
};

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
  if (!room)
    return res.json({ code: 404, error: true, message: 'Room not found' });
  res.json({ code: 200, error: false, message: 'Room found', room });
});

admin.get('/register-instance', instanceRegistrationHandle);

admin.get('/get-link', getInstance);

admin.get('/free-all-instances', freeAllInstances);

admin.listen(PORT, () => log(`[Server OK]`));