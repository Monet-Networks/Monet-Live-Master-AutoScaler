const Instance = require('../models/instance.model');
const ErrorHandler = require('../util/ErrorHandler');
const SuccessHandler = require('../util/SuccessHandler');

exports.getInstances = async () => {
  const instanceIps = await Instance.find({ type: 'auto' }, 'publicIP');
  return instanceIps.map(({ publicIP }) => publicIP);
};

exports.createOneInstance = async ({ publicIP, privateIP, InstanceNo, InstanceRoute, type }, callback) => {
  const existingInstance = await Instance.findOne({ publicIP, privateIP });
  if (existingInstance)
    return callback({
      message: 'The entry for this instance exist with flag ' + existingInstance.occupied + ' kindly update if needed.',
    });
  const instance = new Instance({
    InstanceNo,
    InstanceRoute,
    publicIP,
    privateIP,
    occupied: false,
    type,
  });
  await instance.save((err) => {
    if (err) return callback(err);
    return callback(null, { msg: 'success' });
  });
};

exports.getInstance = async (req, res) => {
  const getFreeInstance = await Instance.find({ type: 'auto', occupied: false }, 'InstanceRoute').lean();
  if (getFreeInstance.length !== 0) return new SuccessHandler(res, 200, 'success', { route: getFreeInstance.pop().InstanceRoute });
  else return new ErrorHandler(res, 400, 'error', 'no instance available');
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
