const Instance = require('../models/instance.model');

exports.getInstances = async () => {
  const instanceIps = await Instance.find({}, 'publicIP');
  return instanceIps.map(({ publicIP }) => publicIP);
};
