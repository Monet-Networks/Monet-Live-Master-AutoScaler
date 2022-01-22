const UserModel = require('../models/users.model');
const jwt = require('jsonwebtoken');

exports.authenticate = async (token, u) => {
  if (!token) return false;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (!decoded) return false;
  const user = await UserModel.findById(decoded.id).lean();
  if (u) return user;
  else return !!user;
};

exports.generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};
