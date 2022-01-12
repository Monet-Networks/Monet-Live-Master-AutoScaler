require('dotenv').config();
const express = require('express');
const admin = express();
const db = require('./modules/db');
const { log } = require('console');
const { getInstances, createOneInstance } = require('./controllers/instance.controller');
const CreateConfiguration = require('./modules/createConfig');
const ErrorHandler = require('./util/ErrorHandler');
const SuccessHandler = require('./util/SuccessHandler');

const PORT = process.env.PORT || 3000;

new db();

admin.get('/configure-instances', async (req, res) => {
  log('configure instance call.');
  const ips = await getInstances();
  new CreateConfiguration(ips);
  return new SuccessHandler(res, 200, 'IPs configured', ips);
});

admin.get('/register-instance', async (req, res) => {
  if (!req.query.publicIP || !req.query.privateIP || !req.query.secret)
    return new ErrorHandler(res, 400, 'missing parameter');
  if (req.query.secret !== process.env.SECRET)
    return new ErrorHandler(
      res,
      400,
      `Don't try to be smart. You haven't provided valid secret. Please don't try again unless you are admin. I know your address.`,
      'authentication error'
    );
  createOneInstance({
    InstanceNo: 0,
    InstanceRoute: `${req.query.publicIP}`,
    publicIP: req.query.publicIP,
    privateIP: req.query.privateIP,
    type: 'auto'
  });
});

admin.listen(PORT, () => log(`Server listening on port : ${PORT}`));
