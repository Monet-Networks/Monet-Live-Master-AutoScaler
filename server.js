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
  updateImageId,
  getAllAutoInstances,
} = require('./controllers/instance.controller');
const { getRoom } = require('./controllers/room.controller');
const CreateConfiguration = require('./modules/createConfig');
const AWSConfiguration = require('./modules/awsConfig');
const IController = new AWSConfiguration();
const SuccessHandler = require('./util/SuccessHandler');
// const ErrorHandler = require('./util/ErrorHandler');

const PORT = process.env.PORT || 3000;

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
engine.on('up-instance-image', async ({ImageId, privateIP}) => {
  const update = await updateImageId(ImageId,privateIP);
  console.log(`The update status for ${privateIP} is `, update);
});

new db();

const instanceRegistrationHandle = async (req, res) => {
  await createOneInstance(req, res, ({ error, success }) => {
    if (error) return console.log('Instance creation error : ', error);
    console.log('Instance creation success : ', success, Object.keys(success));
    if (success)
      if (success.publicIP)
        engine.addInstance(success);
  });
};

admin.use(express.bodyParser());

admin.get('/reset-engine-state', (req,res) => {
  if(req.query.secret==="monet@43324") {
    engine.resetState()
    res.json({
      message:"success"
    })
  } else {
    res.json({
      message:"please don't use this api"
    })
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
  if (!room)
    return res.json({ code: 404, error: true, message: 'Room not found' });
  res.json({ code: 200, error: false, message: 'Room found', room });
});

admin.get('/register-instance', instanceRegistrationHandle);

admin.get('/get-link', getInstance);

admin.get('/free-all-instances', freeAllInstances);

admin.listen(PORT, () => log(`[Server OK]`));