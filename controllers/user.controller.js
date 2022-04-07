const UserModel = require('@models/user.model');

exports.SaveUser = async (Object) => {
  // noinspection UnnecessaryLocalVariableJS
  const User = await UserModel.findOneAndUpdate({ ID: Object.ID }, Object, { upsert: true, new: true });
  return User;
};

exports.GetUser = async (response) => {
  // noinspection UnnecessaryLocalVariableJS
  let result = await UserModel.findOne({ ID: response.ID });
  return result;
};
