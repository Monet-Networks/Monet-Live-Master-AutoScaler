require('dotenv').config();
const express = require('express');
const admin = express();
const db = require('./modules/db');
const { log } = require('console');
const { getInstances, createOneInstance, getInstance } = require('./controllers/instance.controller');
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

admin.get('/register-instance', (req, res) => {
  if (!req.query.publicIP || !req.query.privateIP || !req.query.secret)
    return new ErrorHandler(res, 400, 'missing parameter');
  if (req.query.secret !== process.env.SECRET)
    return new ErrorHandler(
      res,
      400,
      `Don't try to be smart. You haven't provided valid secret. Please don't try again unless you are admin. I know your address.`,
      'authentication error'
    );
  createOneInstance(
    {
      InstanceNo: 0,
      InstanceRoute: `call.monetanalytics.com/${req.query.publicIP.replaceAll('.', '_')}/`,
      publicIP: req.query.publicIP,
      privateIP: req.query.privateIP,
      type: 'auto',
    },
    (err, doc) => {
      if (err) {
        console.log('DB instance error : ' + err.message);
        return new ErrorHandler(res, 400, 'error', err.message);
      }
      if (res) {
        console.log('DB instance entry created : ' + doc.msg);
        return res.json({
          code: 200,
          error: false,
          message: 'Instance entry created : ' + doc.msg,
        });
      }
    }
  ).then(() => {});
});

admin.get('/get-link', (req, res) => {
  if (!req.query.secret) return new ErrorHandler(res, 400, 'missing parameter');
  if (req.query.secret !== process.env.SECRET)
    return new ErrorHandler(
      res,
      400,
      `Don't try to be smart. You haven't provided valid secret. Please don't try again unless you are admin. I know your address.`,
      'authentication error'
    );
  getInstance(req, res);
});

admin.listen(PORT, () => log(`Server listening on port : ${PORT}`));
