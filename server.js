require('dotenv').config();
const express = require('express');
const admin = express();

const { log } = require('console');

const PORT = process.env.PORT || 3000;

admin.get('/instance', (req, res) => {
  res.send('Hello world.');
});

admin.listen(3000, () => log(`Server listening on port : ${PORT}`));
