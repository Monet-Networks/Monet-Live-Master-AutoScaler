const tokenCon = require('@controllers/token.controller');
const initDB = require('@modules/db');
new initDB();

class AutoToken {
  get token() {
    return this.currentToken;
  }

  stop = () => {
    clearInterval(this.interval);
  };

  constructor() {
    this.pathMod = require('path');
    this.fs = require('fs');
    this.currentToken = null;
    this.tokenCollection = [];
    this.fetch = require('https');
    this.path = '';
    this.week = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    this.options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      hostname: 'metrics.monetanalytics.com',
      path: '/services/facereader/authenticate',
    };
    this.credentials = {
      USERNAME: 'monet1',
      PASSWORD: 'k6684WnnD$wR',
    };
    this.init().then((r) => {
      console.log('fn:Token init refreshed : ', this.currentToken);
    });
    this.initInterval();
    console.log('AutoToken : Initialized');
  }

  init = async () => {
    // Check for token generation on class Initialization and daily
    // const path = this.pathMod.join(__dirname, '..', './data/tokenLog.json');
    const dbToken = await tokenCon.get_token();
    // let expired;
    // if (dbToken) expired = await this.expired(dbToken.expiresAt);
    // this.currentToken = (await dbToken.token.trim()) || null;
    // expired === true ? console.log("Token expired") : console.log("Token not expired")
    if (!dbToken) {
      this.genToken();
    } else {
      this.currentToken = dbToken.token;
    }
    // if (this.fs.existsSync(path) && this.currentToken === null) {
    //   let data = this.fs.readFileSync(path, { encoding: 'utf8', flag: 'r' });
    //   data = data.split('~');
    //   const tokenSTR = data[data.length - 2];
    //   this.currentToken = tokenSTR.split('@')[1].trim();
    //   tokenCon.save_token(this.currentToken);
    // }
    if (this.currentToken === null) {
      console.log('The token is not generated. Check why?');
    }
  };

  initInterval = () => {
    this.interval = setInterval(() => {
      // const day = this.today()
      // if(day === "Thursday") {
      this.init().then((r) => {
        console.log('fn:Daily token : ', this.currentToken);
      });
      // }
    }, 1000 * 60 * 60 * 24); // 1000*60*60*24
  };

  stopInterval = () => {
    clearInterval(this.interval);
  };

  genToken = () => {
    let resData = '';
    const path = this.pathMod.join(__dirname, '..', './data/tokenLog.json');
    const request = this.fetch.request(this.options, (response) => {
      response.on('data', (data) => {
        resData += data;
      });
      response.on('error', (err) => {
        console.warn('Error : ', err);
      });
      response.on('end', () => {
        const token = JSON.parse(resData).token;
        tokenCon.save_token(token);
        this.currentToken = token;
        this.tokenCollection.push(token);
        console.log('Generated new token : ', token);
        if (!this.fs.existsSync(path)) {
          this.fs.writeFile(path, '', (err) => {
            if (err) {
              console.warn(err);
            }
          });
        }
        this.fs.appendFile(path, `${new Date()}@${this.currentToken}~\n`, (err) => {
          if (err) {
            console.log(err);
          }
        });
      });
    });
    request.on('error', (error) => {
      console.error('request error : ', error);
    });
    request.write(JSON.stringify(this.credentials));
    request.end();
  };

  today = () => {
    const date = new Date();
    return this.week[date.getDay()];
  };

  expired = (date) => {
    const dateNow = new Date();
    return dateNow > date ? true : false;
  };
}

// const token = new AutoToken();
// setTimeout(() => {
//     token.stopInterval();
//     console.log("\n\n\nTimeout 1 minute!");
// }, 1000 * 60);

module.exports = AutoToken;
