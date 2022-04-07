const Tokens = require('@models/token.model');

exports.save_token = (token) => {
  const newToken = new Tokens({ token: token });
  newToken.save((err) => {
    if (err) console.error(err);
  });
};

exports.get_token = () => {
  return Tokens.findOne().sort({ $natural: -1 }).limit(1);
};
