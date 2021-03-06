const Instance = require('@models/instance.model');
const ErrorHandler = require('@utils/ErrorHandler');
const SuccessHandler = require('@utils/SuccessHandler');

exports.getInstances = async () => {
  const instanceIps = await Instance.find({ type: 'auto' }, 'publicIP');
  return instanceIps.map(({ publicIP }) => publicIP);
};

exports.createOneInstance = async (req, res, CB) => {
  if (typeof CB !== 'function') return;
  if (!req.query.publicIP || !req.query.privateIP || !req.query.secret) {
    new ErrorHandler(res, 400, 'missing parameter');
    return CB({ error: 'param problem' });
  }
  if (req.query.secret !== process.env.SECRET) {
    new ErrorHandler(
      res,
      400,
      `Don't try to be smart. You haven't provided valid secret. Please don't try again unless you are admin. I know your address.`,
      'authentication error'
    );
    return CB({ error: 'key problem' });
  }
  const existingInstance = await Instance.findOne({
    publicIP: req.query.publicIP,
    privateIP: req.query.privateIP,
  }).lean();
  if (existingInstance) {
    new ErrorHandler(
      res,
      400,
      'The entry for this instance exist with flag ' + existingInstance.occupied + ' kindly update if needed.'
    );
    return CB({ error: null, success: existingInstance });
  }
  const entry = {
    InstanceNo: 0,
    InstanceRoute: `${req.query.publicIP.replaceAll('.', '_')}`,
    publicIP: req.query.publicIP,
    privateIP: req.query.privateIP,
    occupied: false,
    type: 'auto',
    CPU: 0,
    Upload: '0',
    Download: '0',
    Calls: 0,
    Participants: 0,
  };
  const instance = new Instance(entry);
  await instance.save((err) => {
    if (err) {
      new ErrorHandler(res, 400, 'error', err.message);
      return CB({ error: 'Instance save error' });
    }
    res.json({
      code: 200,
      error: false,
      message: 'Instance entry created : success',
    });
    return CB({ error: null, success: entry });
  });
};

exports.getInstance = async (req, res) => {
  if (!req.query.secret) return new ErrorHandler(res, 400, 'missing parameter');
  if (req.query.secret !== process.env.SECRET)
    return new ErrorHandler(
      res,
      400,
      `Don't try to be smart. You haven't provided valid secret. Please don't try again unless you are admin. I know your address.`,
      'authentication error'
    );
  const getFreeInstance = await Instance.find({ type: 'auto', occupied: false }, 'InstanceRoute publicIP').lean(); // false || true -> CPU usage or network load?
  if (getFreeInstance.length !== 0) {
    const instance = getFreeInstance.pop();
    return new SuccessHandler(res, 200, 'success', {
      route: instance.InstanceRoute,
      ip: instance.publicIP,
      response: 'Instance Alloted',
    });
  } else return new ErrorHandler(res, 400, 'error', 'No instances available.');
};

exports.freeAllInstances = async (req, res) => {
  if (!req.query.secret) return new ErrorHandler(res, 400, 'missing parameter');
  if (req.query.secret !== process.env.SECRET)
      return new ErrorHandler(
        res,
        400,
        `Don't try to be smart. You haven't provided valid secret. Please don't try again unless you are admin. I know your address.`,
        'authentication error'
      );
  const upInstance = await Instance.updateMany({ occupied: true }, { occupied: false });
  return res.send({
    code: 200,
    error: false,
    message: 'success',
    response: upInstance,
  });
};

/* General Functions */
exports.getAllAutoInstances = () => {
  return Instance.find({type:"auto"}).lean();
}

exports.getGenInstances = (instanceIps) => {
  return Instance.find({ type: 'auto', publicIP: { $in: instanceIps } }).lean();
};

exports.deleteInstance = (publicIP) => {
  return Instance.deleteOne({ publicIP });
};

exports.updateImageId = (ImageId, privateIP) => {
  return Instance.updateOne({ privateIP }, { ImageId });
};