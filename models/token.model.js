const mongoose = require('mongoose');

const tokenModel = mongoose.Schema({
  token: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => Date.now() + 7 * 24 * 60 * 60 * 1000,
  },
});

module.exports = mongoose.model('tokens', tokenModel, 'tokens');
