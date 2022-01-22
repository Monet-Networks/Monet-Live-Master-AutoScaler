require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const admin = express();
const db = require('./modules/db');
const { log } = require('console');
const { googleAuth } = require('./controllers/user.controller');
const { getInstances, createOneInstance, getInstance, freeAllInstances } = require('./controllers/instance.controller');
const CreateConfiguration = require('./modules/createConfig');
const ErrorHandler = require('./util/ErrorHandler');
const SuccessHandler = require('./util/SuccessHandler');

const PORT = process.env.PORT || 3000;

new db();

admin.use(bodyParser());

admin.post('/auth/google', googleAuth);

admin.get('/configure-instances', async (req, res) => {
  log('configure instance call.');
  const ips = await getInstances();
  new CreateConfiguration(ips);
  return new SuccessHandler(res, 200, 'IPs configured', ips);
});

admin.get('/register-instance', createOneInstance);

admin.get('/get-link', getInstance);

admin.get('/free-all-instances', freeAllInstances);

admin.listen(PORT, () => log(`[Server OK]`));
