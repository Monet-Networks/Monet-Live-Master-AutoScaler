require('module-alias/register');
// require('@modules/socket-io');
require('dotenv').config();
const apiRoutes = require('@routes');
const express = require('express');
const admin = express();
const { createServer } = require('http');
const { Server } = require('socket.io');
const { log } = require('console');
const db = require('@modules/db');
const bodyParser = require('body-parser');
const Engine = require('@modules/scaleEngine');
const AWSConfiguration = require('@modules/awsConfig');
const IController = new AWSConfiguration();
const MonetIO = require('@modules/websockets');
const notify = require('@modules/notification');
const MasterCollection = require('@modules/MasterCollection');
const {
  getAllAutoInstances,
  createOneInstance,
  deleteInstance,
  updateImageId,
} = require('@controllers/instance.controller');
const { handleEngineData } = require('@utils/engineHandles');

const PORT = process.env.PORT || 3000;

const instanceRegistrationHandle = async (req, res) => {
  await createOneInstance(req, res, ({ error, success }) => {
    // if (error) return console.log('Instance creation error : ', error);
    // console.log('Instance creation success : ', success, Object.keys(success));
    // if (success) if (success.publicIP) engine.addInstance(success);
  });
};

const getEngineData = (req, res) => {
  handleEngineData(req, res, engine);
};

/* Instantiate the engine class */
const engine = (MasterCollection.engine = new Engine({ timeout: 1000 }));
engine.DBEntryFunction(getAllAutoInstances);
engine.on('create-instance', ({ name }) => {
  // console.log('Instance creation signal with name : ', name);
  // /* Check whether this object needs to be recorded or not. */
  // IController.createInstance(name)
  //   .then((data) => engine.addInternalIpImageId(data))
  //   .catch((err) => console.log('An error occured while attempting to create instance. Kindly check. : ', err));
});

engine.on('delete-instance', async (instance) => {
  // console.log(instance);
  // const awsInstanceData = await IController.deleteInstance(instance.ImageId);
  // await deleteInstance(instance.publicIP);
  // engine.deleteConfirmation(awsInstanceData);
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
io.on('connection', (socket) => {
  socket.emit('hello', 'world');
  socket.on('notify', async (data) => {
    console.log(data);
    const email = data;
    if (!email) {
      socket.emit('error', 'email not provided');
    } else {
      notify(email);
    }
  });
});

// new MonetIO(io);

// admin.use(bodyParser({ limit: '50mb' }));
admin.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.url == '/webhooks') {
        req.rawBody = buf;
      }
    },
  })
);
admin.use('/test', express.static('tests'));
admin.get('/register-instance', instanceRegistrationHandle);
admin.get('/engine-data', getEngineData);

admin.use('/', apiRoutes);

httpServer.listen(PORT, () => log(`[Server OK] : Port ${PORT}`));
