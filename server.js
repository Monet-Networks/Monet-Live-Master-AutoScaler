require('dotenv').config();
const express = require('express');
const admin = express();
const db = require('./modules/db');
const { log } = require('console');
const { getInstances } = require('./controllers/instance.controller');
const CreateConfiguration = require('./modules/createConfig')

const PORT = process.env.PORT || 3000;

new db();

admin.get('/new-instance', async (req, res) => {
  const ips = await getInstances();
  // const IPs = ips.map(({ publicIP }) => publicIP);
  console.log('IPS : ', ips);
  new CreateConfiguration(ips);
  res.send('Hello world. I am mayank.');
});

admin.listen(PORT, () => log(`Server listening on port : ${PORT}`));
