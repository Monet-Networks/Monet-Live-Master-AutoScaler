const UserModel = require('@models/user.model');
const jwt = require('jsonwebtoken');

exports.authenticate = async (token, u) => {
  try {
    if (!token) return false;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) return false;
    const user = await UserModel.findById(decoded.id).lean();
    if (u) return user;
    else return !!user;
  } catch (e) {
    return false;
  }
};

exports.generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};
