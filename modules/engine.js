const db = require('./db');
const hyperReq = require('http');
const { log } = require('console');
const { getGenInstances } = require('../controllers/instance.controller');

new db();

class InstanceController {
  on = (event, callback, overwrite = false) => {
    if (typeof event !== 'string' && typeof callback !== 'function')
      return log(`The provided params is not of valid acceptable format : ${typeof event} , ${typeof callback}`);
    const exists = this.CBDict[event];
    if (exists) {
      log(`Event ${event} is already registered with the object. Do you wish overwrite?`);
      if (!overwrite) return;
    }
    this.CBDict[event] = callback;
  };

  addInstanceIP = (InstanceIP) => {
    const exists = this.Instances[InstanceIP];
    if (!exists) this.Instances[InstanceIP] = { live: 0 };
  };

  constructor() {
    this.init();
  }

  init = () => {
    this.CBDict = {};
    this.state = {
      phase: 0,
      TotalInstances: 0,
      TotalCalls: 0,
      TotalParticipants: 0,
    };
    this.Instances = { '54.201.217.142': { live: 0 }, '54.201.250.225': { live: 0 } };
    this.stateOne();
  };

  /* This method will check whether we have empty entries in Instances object */
  stateOne = async () => {
    this.state.phase = 1;

    /* Find IPs that don't have the data. */
    const pendingInstanceList = [];
    for (let key in this.Instances) {
      if (!this.Instances[key]) pendingInstanceList.push(key);
    }

    /* Take tab of total no. of Instances here as well */
    const currentInstanceLength = Object.keys(this.Instances).length;
    const Change = this.state.TotalInstances !== currentInstanceLength;
    if (Change) {
      this.state.TotalInstances = currentInstanceLength;
      log('The number of instances changes.');
    } else log('The number of instances have not changed', this.state);

    /* First ask db for empty entry data if available */
    const dbInstaEntries = await getGenInstances(pendingInstanceList);
    if (dbInstaEntries.length !== 0)
      dbInstaEntries.forEach((entry) => {
        log(this.Instances[entry.publicIP])
        this.Instances[entry.publicIP] = { ...this.Instances[entry.publicIP], ...entry }
      });
    setTimeout(() => {
      this.stateTwo();
    }, 5000);
  };

  /* This ought to check how all the instances are performing directly from the slave instances */
  stateTwo = async () => {
    this.state.phase = 2;
    // Now we have updated list of all the instances from DB atleast, if it's updated.
    // Check whether db provides whileworthy entries for new spun instances.
    const ips = Object.keys(this.Instances);
    for (let ip of ips) {
      this.sentReq(ip)
        .then((r) => {
          let response = '';
          try {
            response = JSON.parse(r);
            this.ipSuccessHandle(response, ip);
          } catch (error) {
            response = r;
            log('There is an issue with IP response : ', ip, ' -:- ', response, ' -:- ', error);
          }
          log(`res : ${ip} : `, r);
        })
        .catch((e) => {
          log('error : ', e.code);
          this.ipErrHandle(e.code, ip);
        });
    }
    setTimeout(() => {
      this.stateOne();
    }, 5000);
  };

  ipSuccessHandle = (data, IP) => {
    if (!this.Instances[IP]) return log(`there is no entry with this IP. Shall I add ${IP} ?`);
    this.Instances[IP]['live'] = 1;
  };

  ipErrHandle = (errorCode, IP) => {
    if (!this.Instances[IP]) return log(`there is no entry with this IP. Shall I add ${IP} ?`);
    switch (errorCode) {
      case 'ETIMEDOUT':
        if (this.Instances[IP]['live'] < -6) this.Instances[IP]['live']--;
        break;
      default:
        log('Unknown error code : ', errorCode);
        break;
    }
    if (this.Instances[IP]['live'] < -5) {
      if(!this.Instances[IP]['deleteSignal']) {
        this.Instances[IP]['deleteSignal'] = true;
        this.deleteInstance(IP);
      }
    }
  };

  sentReq = (ip, body = '', method = 'GET') => {
    return new Promise((resolve, reject) => {
      // const routePath = `/${ip.replaceAll('.', '_')}/many/api/healthCheck`;
      const routePath = `/api/healthCheck`;
      const callback = (response) => {
        let str = '';
        response.on('data', function (chunk) {
          str += chunk;
        });
        response.on('end', function () {
          resolve(str);
        });
      };
      const options = {
        // host: 'call.monetanalytics.com',
        host: ip,
        port: 8092,
        path: routePath,
        method: method,
      };
      const req = hyperReq.request(options, callback);
      req.on('error', function (e) {
        reject(e);
      });
      req.write(body || '');
      req.end();
    });
  };

  /* This method is ought to delete instance entry from Instances dict and */
  deleteInstance = (IP) => {
    log('Delete signal : ', IP);
    this.Invoker('delete-instance', {IP});
  };

  Invoker = (event, data) => {
    const CB = typeof this.CBDict[event] === 'function' ? this.CBDict[event] : () => {};
    CB(data || {});
  };
}

new InstanceController();
