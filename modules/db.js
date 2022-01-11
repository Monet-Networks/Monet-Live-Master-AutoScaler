const mongoose = require('mongoose');

class initDB {
  constructor() {
    mongoose
      .connect('mongodb://webrtc.monetrewards.com:27017/exams_db?authSource=admin&w=1', {
        user: 'admin',
        pass: 'MonET@v34nMK',
        useUnifiedTopology: true,
        useNewUrlParser: true,
      })
      .catch((err) => console.log('DB Error', err));
  }
}

module.exports = initDB;
