const jwt = require('jsonwebtoken');

exports.genToken = (payload, options = {}) => {
  const token = jwt.sign(payload, process.env.JWT_SECRET, options);
  return token;
};

exports.verifyToken = async (token, options = {}) => {
  return jwt.verify(token, process.env.JWT_SECRET, options, (err, decodedPayload) => {
    if (err) {
      return undefined;
    }
    return decodedPayload;
  });
};

exports.decodeToken = async (token, options = {}) => {
  return jwt.decode(token, options);
};
