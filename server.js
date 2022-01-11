require('dotenv').config();
const express = require('express');
const admin = express();
const db = require('./modules/db');

const { log } = require('console');

const PORT = process.env.PORT || 3000;

new db();

admin.get('*', (req, res) => {
  res.send('Hello world. I am mayank.');
});

admin.listen(PORT, () => log(`Server listening on port : ${PORT}`));
