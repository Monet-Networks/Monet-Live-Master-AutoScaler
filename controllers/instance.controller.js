const Instance = require('../models/instance.model');

exports.getInstances = async () => {
  const instanceIps = await Instance.find({}, 'publicIP');
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
    type
  });
  await instance.save((err) => {
    if (err) return callback(err);
    return callback(null, { msg: 'success' });
  });
};

