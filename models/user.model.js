// Load required packages
const mongoose = require('mongoose');

// Define our Company schema
const UserSchema = new mongoose.Schema({
  ID: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    enum: ['google', 'microsoft', 'monet'],
    default: 'monet',
  },
  avatar: {
    type: String,
    default: '',
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  contact: {
    type: String,
    default: '',
  },
  gender: {
    type: String,
    default: '',
  },
  age: {
    type: Number,
    default: 0,
  },
  password: {
    type: String,
  },
  resetPasswordToken: {
    type: String,
    default: '',
  },
  userType: {
    type: String,
    enum: ['student', 'proctor', 'manager', 'teacher', 'observer', 'moderator', 'NaN'],
    default: 'NaN',
  },
  active: {
    type: Boolean,
    default: false,
  },
  address: {
    type: String,
    default: '',
  },
  state: {
    type: String,
    default: '',
  },
  country: {
    type: String,
    default: '',
  },
  settings: {
    type: { waitingRoom: Boolean, screenShare: Boolean, chat: Boolean, limit: Number },
    default: { waitingRoom: true, screenShare: true, chat: true, limit: 10 },
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'plans',
  },
});

// Export the Mongoose model
module.exports = mongoose.model('users', UserSchema, 'users');