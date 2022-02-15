const db = require('./db');
const hyperReq = require('http');
const { log } = require('console');
const { uniqueNamesGenerator, adjectives, colors, animals } = require('unique-names-generator');
const { green, red, cyan, gray } = require('colors');

/** Condition for autoscaling
 *  Atleast one instance should be There.
 *  Instance should be created when all the instances have occupied flag on.
 */
class Engine {

  resetState = () => {
    this.state.task = 0;
  }

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

  deleteConfirmation = (delInstanceInfo) => {
    if (delInstanceInfo.instanceId) log(green(`>>>>>>>>>>> Deleted instance ${delInstanceInfo.instanceId} >>>>>>>>>>>`))
    else log(red(`>>>>>>>>>>> Unable to delete the instance >>>>>>>>>>>`), delInstanceInfo);
    this.state.task = 0;
  }

  /* We will get this data sooner than the instance information */
  addInternalIpImageId = (entry) => {
    if (entry['PrivateIpAddress'] && entry['InstanceId'])
      this.InternalIpImageIdMapping[entry['PrivateIpAddress']] = entry;
  };

  addInstance = (Instance) => {
    if (Instance && Instance.publicIP && Instance.privateIP) {
      const InstanceIP = Instance.publicIP;
      const exists = this.Instances[InstanceIP];
      if (!exists) {
        let ImageId;
        if (this.InternalIpImageIdMapping[Instance.privateIP]) {
          ImageId = this.InternalIpImageIdMapping[Instance.privateIP]['InstanceId'];
        }
        this.Instances[InstanceIP] = {
          ImageId: ImageId || 'NaN',
          deleteIteration: 0,
          live: 0,
          ...Instance,
        };
        this.state.task = 0;
      }
    } else {
      return log(red('The instance structure does not exists or is missing publicIP or privateIP key : '), Instance);
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
    this.InternalIpImageIdMapping = {};
    this.Instances = {};
    /*  task flag
        0 - idle
        1 - creating
        2 - deleting
     */
    this.state = {
      task: 0,
      phase: 0,
      Count: 0,
      phaseData: {},
      TotalInstances: 0,
      TotalOccupied: 0,
      TotalCalls: 0,
      TotalParticipants: 0,
      CreationLockTimer: (1000 * 60 * 1),
      CreationLockState: false,
    };
    this.deleteCandidate = 'NaN';
  };

  /* This method will check whether we have empty entries in Instances object */
  stateOne = async (data) => {
    // log(green(this.state));
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
    const ILength = currentInstances.length;
    const instanceCountChanged = this.state.TotalInstances !== ILength;
    if (instanceCountChanged) {
      this.state.TotalInstances = currentInstances.length;
      // log(cyan('The number of instances changed. '), this.state);
    }
    if (ILength === 0) {
      this.state.phase = 2;
      return this.Invoker('internal');
    }
    /* Take tab of total no. of occupied instances */
    let totalOccupancy = 0;
    currentInstances.forEach((Instance) => {
      if (this.Instances[Instance].occupied && this.Instances[Instance].occupied === true) ++totalOccupancy;
    });
    const occupancyCountChanged = this.state.TotalOccupancy !== totalOccupancy;
    if (occupancyCountChanged) {
      this.state.TotalOccupied = totalOccupancy;
      // log(cyan('The number of occupied changed. '), this.state);
    }
    // log(cyan('>>>>>>>>>>> Instances >>>>>>>>>>> \n'), cyan(this.Instances));
    for (let ip of currentInstances) {
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
          })
          .catch((e) => {
            log('error : ', e.code);
            this.ipErrHandle(e.code, ip);
          });
      }
    }
    /* First ask db for empty entry data if available */
    // const dbInstaEntries = await getGenInstances(pendingInstanceList);
    // if (dbInstaEntries.length !== 0)
    //   dbInstaEntries.forEach((entry) => {
    //     this.Instances[entry.publicIP] = { ...this.Instances[entry.publicIP], ...entry };
    //   });

    // Now we have updated list of all the instances from DB atleast, if it's updated.
    // Check whether db provides whileworthy entries for new spun instances.

    this.state.phase = 2;
    return this.Invoker('internal');
  };

  /* This method shall decide whether scaling up or down is needed? */
  /* scaleUp */
  stateTwo = async (data) => {
    // log(green(this.state));
    /* check for engine stop signal */
    if (this.state.phase === 0) {
      this.Invoker('engine-stopped');
      return log(green('>>>>>>>>>>> Engine Stopped >>>>>>>>>>>'));
    }

    /* check the phase the engine is in */
    if (this.state.phase !== 2) {
      log(red('>>>>>>>>>>> This state does not authorize execution of state two >>>>>>>>>>>'));
      return this.Invoker('internal', this.state.phaseData, 5000);
    }

    /* check for data in params */
    if (data) {
      /* There is data. Do something with it if needed. */
    }

    // Check if Instances dictionary is empty or not
    if (this.state.TotalInstances === 0) {
      log(red('There are no known instances with me.'));
      this.state.phase = 1;
      return this.Invoker('internal');
    }

    /* decision : whether we need a new instance or not? Scale up ?
        1. check occupancy;
        2. check number of calls/total instances ratio; (optional)
        3. check number of participants/total instances ratio; (optional)
    */

    log(green(this.state));
    // check occupancy -> if all the instances are occupied;
    if (this.state.TotalInstances <= 5 && this.state.task === 0)
      if (this.state.TotalOccupied === this.state.TotalInstances) this.scaleUp();

    /* decision : whether we need to delete an instance or not? Scale Out?
     ***check difference between occupied instances and total instances -> OcuDiff.
     ***check if total number unoccupied of instances. If they exceed more than two.
     ***find an unoccupied instance and watch for it's occupancy(candidate)
     ***for certain length of iterations. If it's occupancy doesn't get filled.
     ***check OcuDiff, if it's still greater than two. send signal for deletion of candidate.
     */

    if (this.state.TotalInstances > 1 && this.state.task === 0) {
      if (this.state.TotalOccupied !== this.state.TotalInstances) this.scaleOut();
      else this.deleteCandidate = 'NaN';
    }

    // this is default phase cycle
    this.state.phase = 1;
    return this.Invoker('internal');
  };

  scaleUp = () => {
    // set task to creation
    if(this.state.CreationLockState) return log(red("Instance creation is locked."))
    log(green('>>>>>>>>>>> Instance Creation Signal >>>>>>>>>>>'));
    this.state.CreationLockState = true;
    this.state.task = 1;
    this.Invoker('create-instance', { name: uniqueNamesGenerator({ dictionaries: [colors, adjectives, animals] }) });
    setTimeout(() => {
      this.state.CreationLockState = false;
    }, this.state.CreationLockTimer);
  };

  scaleOut = () => {
    if (this.state.CreationLockState) return log(red('New instance has just been spun up please wait.'));
    this.state.task = 2;
    log(red('Entered the block scale out call block'));
    const OcuDiff = this.state.TotalInstances - this.state.TotalOccupied; // Total instances should always be greater than occupied ones
    if (OcuDiff >= 1) {
      // If scaleUp flag is true, then rule out the possibility of Scaling Out.
      // this.state.ScaleOut = this.state.ScaleUp ? false : true;
      // if (!this.state.ScaleOut)
      // return log(red('Currently engine is scaling up. Ruling out possibility of scaling out'));
      /* Find Candidate
         If Candidate already exists and have required keys
         a. deleteIteration -> for how man cycles this instance is being watched.
         b. publicIP -> to check whether it has been deleted already by the ipErrorHandle or any for any other reason.
            We do not wish to send any unnecessary signal if the candidate doesn't exist in Instances Collection.
      */
      if (this.deleteCandidate === 'NaN') {
        // Find the suitable candidate and add it with deleteIteration key to deleteCandidate.
        for (let key in this.Instances) {
          const instaObj = this.Instances[key];
          if (
            !instaObj.occupied &&
            instaObj['Calls'] === 0 &&
            instaObj['Participants'] === 0 &&
            instaObj['CPU'] < 20 &&
            instaObj['ImageId'] !== "NaN"
          ) {
            /* This candidate has been selected for deletion */
            this.deleteCandidate = instaObj;
          } else {
            this.state.task = 0;
            log(red('Unable to find suitable candidate.'));
          }
        }
      } else if (
        typeof this.deleteCandidate === 'object' &&
        typeof this.deleteCandidate['deleteIteration'] === 'number' &&
        this.deleteCandidate['publicIP'] &&
        this.deleteCandidate['ImageId']
      ) {
        if (this.Instances[this.deleteCandidate['publicIP']]) {
          // watch this instance for 5 more iterations before deleting it as it might be used in certain threshhold of time
          if (this.deleteCandidate['deleteIteration'] > 5) {
            // Check whether scaleOut has reached it's threshhold.
            this.deleteInstance(this.deleteCandidate['publicIP']);
          } else {
            ++this.deleteCandidate['deleteIteration'];
            this.state.task=0;
          }
        } else {
          // set the candidate back to it's default value. And retry
          this.deleteCandidate = 'NaN';
          this.state.task = 0;
        }
      } else {
        log(
          red(
            'Check what is missing. Candidate to be deleted does not have any valid entries or required keys in it to be suitable for deletion.'
          )
        );
        this.state.task = 0;
      }
    } else {
      /* No need to scale down */
      this.state.task = 0;
      // check whether candidate has been initialized
      if (this.deleteCandidate !== 'NaN') this.deleteCandidate = 'NaN';
    }
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
      case 'ECONNREFUSED':
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
    this.Invoker('delete-instance', this.Instances[IP]);
    this.deleteCandidate = 'NaN';
    delete this.InternalIpImageIdMapping[this.Instances[IP].privateIP];
    delete this.Instances[IP];
    /* dummy signal to test engine stop. could be used in future to check fatal condition */
    // this.state.phase = 0;
  };

  Invoker = (event, data, timeout) => {
    if (event === 'internal') {
      switch (this.state.phase) {
        case 1:
          setTimeout(() => {
            this.stateOne(data || this.state.phaseData);
          }, timeout || (1000 * 30));
          break;
        case 2:
          setTimeout(() => {
            this.stateTwo(data || this.state.phaseData);
          }, timeout || (1000 * 30));
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
    CB(data || this.state);
  };
}

// const engine = new Engine();
// engine.start();

module.exports = Engine;
