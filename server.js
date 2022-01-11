require('dotenv').config();
const express = require('express');
const admin = express();
const db = require('./modules/db');
const { log } = require('console');
const { getInstances } = require('./controllers/instance.controller');
const CreateConfiguration = require('./modules/createConfig')

const PORT = process.env.PORT || 3000;

new db();

admin.get('/configure-instances', async (req, res) => {
  const ips = await getInstances();
  // const IPs = ips.map(({ publicIP }) => publicIP);
  console.log('IPS : ', ips);
  new CreateConfiguration(ips);
  res.json({
    code: 200,
    error: false,
    message: 'IPs configured',
    response: ips,
  });
});

admin.listen(PORT, () => log(`Server listening on port : ${PORT}`));
