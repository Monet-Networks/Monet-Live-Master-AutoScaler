const db = require('./db');
const hyperReq = require('http');
const { log, clear } = require('console');
const { green, red, blue, magenta } = require('colors');
// const { getGenInstances } = require('../controllers/instance.controller');

new db();

/** Condition for autoscaling
 *  Atleast one instance should be There.
 *  Instance should be created when all the instances have occupied flag on.
 */
class Engine {
  on = (event, callback, overwrite = false) => {
    if (typeof event !== 'string' && typeof callback !== 'function')
      return log(`The provided params is not of valid acceptable format : ${typeof event} , ${typeof callback}`);
    if (this.reservedEvent.includes[event])
      return log(`The event is internally used event. Please register this call with other event name.`);
    const exists = this.CBDict[event];
    if (exists) {
      log(`Event ${event} is already registered with the object. Do you wish overwrite?`);
      if (!overwrite) return;
    }
    this.CBDict[event] = callback;
  };

  addInstanceIP = (Instance) => {
    if (Instance && Instance.publicIP) {
      const InstanceIP = Instance.publicIP;
      const exists = this.Instances[InstanceIP];
      if (!exists) this.Instances[InstanceIP] = { live: 0, ...Instance };
    }
  };

  constructor() {
    this.init();
    this.start();
  }

  start = () => {
    log(green('Engine goes brrrrrrrrr......'));
    this.state.phase = 1;
    this.stateOne();
  };

  stop = () => {
    this.state.phase = 0;
  };

  init = () => {
    this.reservedEvent = ['internal'];
    this.reqKeyName = 'Request';
    this.CBDict = {};
    this.Instances = {};
    this.state = {
      phase: 0,
      Count: 0,
      phaseData: {},
      TotalInstances: 0,
      TotalOccupied: 0,
      TotalCalls: 0,
      TotalParticipants: 0,
    };
  };

  /* This method will check whether we have empty entries in Instances object */
  stateOne = async (data) => {
    /* check for engine stop signal */
    if (this.state.phase === 0) {
      this.Invoker('engine-stopped');
      return log(green('>>>>>>>>>>> Engine Stopped >>>>>>>>>>>'));
    }
    /* Find IPs that don't have the data. */
    if (this.state.phase !== 1) {
      log(red('>>>>>>>>>>> This state does not authorize execution of state one >>>>>>>>>>>'));
      return this.Invoker('internal', this.state.phaseData, 5000);
    }
    if (data) {
      /* There is data. Do something with it */
    }

    // const pendingInstanceList = [];
    // for (let key in this.Instances) {
    //   if (!this.Instances[key]['privateIP'] || !this.Instances[key]['occupied']) pendingInstanceList.push(key);
    // }

    /* Take tab of total no. of Instances here as well */
    const currentInstances = Object.keys(this.Instances);
    if (currentInstances.length !== 0) {
      const instanceCountChanged = this.state.TotalInstances !== currentInstances.length;
      if (instanceCountChanged) {
        this.state.TotalInstances = currentInstances.length;
        log(blue('The number of instances changed. '), this.state);
      }
      /* Take tab of total no. of occupied instances */
      let totalOccupancy = 0;
      currentInstances.forEach((Instance) => {
        if (Instance.occupied && Instance.occupied === true) ++totalOccupancy;
      });
      const occupancyCountChanged = this.state.TotalOccupancy !== totalOccupancy;
      if (occupancyCountChanged) {
        this.state.TotalOccupancy = totalOccupancy;
        log(blue('The number of occupied changed. '), this.state);
      }
    }

    clear();
    log(magenta('>>>>>>>>>>> Instances >>>>>>>>>>> '), this.Instances);

    /* First ask db for empty entry data if available */
    // const dbInstaEntries = await getGenInstances(pendingInstanceList);
    // if (dbInstaEntries.length !== 0)
    //   dbInstaEntries.forEach((entry) => {
    //     this.Instances[entry.publicIP] = { ...this.Instances[entry.publicIP], ...entry };
    //   });
    this.state.phase = 2;
    this.Invoker('internal');
  };

  /* This ought to check how all the instances are performing directly from the slave instances */
  stateTwo = async (data) => {
    /* check for engine stop signal */
    if (this.state.phase === 0) {
      this.Invoker('engine-stopped');
      return log(green('>>>>>>>>>>> Engine Stopped >>>>>>>>>>>'));
    }

    /* check the phase the engine is in */
    if (this.state.phase !== 2) {
      log('>>>>>>>>>>> This state does not authorize execution of state two >>>>>>>>>>>');
      return this.Invoker('internal', this.state.phaseData, 5000);
    }

    /* check for data in params */
    if (data) {
      /* There is data. Do something with it if needed. */
    }
    // Now we have updated list of all the instances from DB atleast, if it's updated.
    // Check whether db provides whileworthy entries for new spun instances.
    const ips = Object.keys(this.Instances);
    if (ips.lengh !== 0)
      for (let ip of ips) {
        /* Initiate if does not exist */
        if (!this.Instances[ip][this.reqKeyName]) this.Instances[ip][this.reqKeyName] = 'completed';
        if (this.Instances[ip][this.reqKeyName] === 'completed') {
          this.Instances[ip][this.reqKeyName] = 'pending';
          this.sentReq(ip)
            .then((r) => {
              let response = '';
              try {
                response = JSON.parse(r);
                this.ipSuccessHandle(response, ip);
              } catch (error) {
                this.Instances[ip][this.reqKeyName] = 'completed';
                response = r;
                log(
                  red('There is an issue with IP response. Shall I count this as instance failure : '),
                  red(ip),
                  ' -:- ',
                  red(response),
                  ' -:- ',
                  red(error)
                );
              }
              log(blue(`res : ${ip} : `), r);
            })
            .catch((e) => {
              log('error : ', e.code);
              this.ipErrHandle(e.code, ip);
            });
        }
      }

    // this is default phase cycle
    this.state.phase = 1;
    this.Invoker('internal');
  };

  ipSuccessHandle = (data, IP) => {
    this.Instances[IP][this.reqKeyName] = 'completed';
    if (!this.Instances[IP]) return log(red(`there is no entry with this IP. Shall I add ${IP} ?`));
    this.Instances[IP]['live'] = 1;
    if (data.result === 200 && data.state) {
      this.Instances[IP] = { ...this.Instances[IP], ...data.state };
    }
  };

  ipErrHandle = (errorCode, IP) => {
    this.Instances[IP][this.reqKeyName] = 'completed';
    if (!this.Instances[IP]) return log(red(`there is no entry with this IP. Shall I add ${IP} ?`));
    switch (errorCode) {
      case 'ETIMEDOUT':
        if (this.Instances[IP]['live'] > -7) --this.Instances[IP]['live'];
        break;
      default:
        log(red('Unknown error code : '), errorCode);
        break;
    }
    if (this.Instances[IP]['live'] < -5) {
      if (!this.Instances[IP]['deleteSignal']) {
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
    log(green(`>>>>>>>>>>> Delete signal for ${IP} >>>>>>>>>>>`));
    /* delete entry from instances dictionary */
    delete this.Instances[IP];
    this.Invoker('delete-instance', { IP });

    /* dummy signal to test engine stop */
    this.state.phase = 0;
  };

  Invoker = (event, data, timeout) => {
    if (event === 'internal') {
      switch (this.state.phase) {
        case 1:
          setTimeout(() => {
            this.stateOne(data || this.state.phaseData);
          }, timeout || 5000);
          break;
        case 2:
          setTimeout(() => {
            this.stateTwo(data || this.state.phaseData);
          }, timeout || 5000);
          break;
        default:
          log('Unknown state : ', this.state.phase);
          log('Shifting state to 1');
          this.state.phase = 1;
          this.Invoker('internal');
          break;
      }
    }
    const CB = typeof this.CBDict[event] === 'function' ? this.CBDict[event] : () => {};
    CB(data || {});
  };
}

// const engine = new Engine();
// engine.start();

module.exports = Engine;
