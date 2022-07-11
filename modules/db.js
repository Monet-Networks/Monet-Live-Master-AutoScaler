const mongoose = require('mongoose');

class initDB {
  constructor() {
    mongoose
      .connect(
        'mongodb://admin:MonET%40v34nMK@54.70.129.69:27017/?authSource=admin&readPreference=primary&directConnection=true&ssl=false',
        {
          user: 'admin',
          pass: 'MonET@v34nMK',
          useUnifiedTopology: true,
          useNewUrlParser: true,
        }
      )
      .catch((err) => console.log('DB Error', err));
  }
}

module.exports = initDB;
