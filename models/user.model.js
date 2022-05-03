// Load required packages
const mongoose = require('mongoose');

// Define our Company schema
const UserSchema = new mongoose.Schema({
  ID: {
    type: String,
    required: true,
  },
  ImageId: {
    type: String,
  },
  MyImageId: {
    type: String,
  },
  stripeId: {
    type: String,
    default: '',
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
    // required: true,
    // unique: true,
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
    default: 'moderator',
  },
  active: {
    type: Boolean,
    default: false,
  },
  address: {
    type: String,
    default: '',
  },
  city: {
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
  pinCode: {
    type: String,
    default: '',
  },
  settings: {
    type: { waitingRoom: Boolean, screenShare: Boolean, chat: Boolean, limit: Number },
    default: { waitingRoom: false, screenShare: true, chat: true, limit: 5 },
  },
  token: {
    type: String,
    default: '',
  },
  plan: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'plans',
      default: '61d279ea7b02f1835c9968df',
    },
    planUid: {
      type: Number,
      default: 0,
    },
    name: {
      type: String,
      default: 'Free Tier',
    },
    type: {
      type: String,
      enum: ['purchased', 'assigned', 'free', 'expired'],
      default: 'free',
    },
    assignedBy: {
      type: String,
      default: '',
    },
    licenseCount: {
      type: Number,
      default: 0,
    },
    assigned: {
      type: Number,
      default: 0,
    },
    assignees: {
      type: [
        {
          email: String,
          token: String,
          status: String,
          expiresAt: String,
        },
      ],
      default: [],
    },
    expiresAt: {
      type: Date,
      default: new Date(new Date().setDate(new Date().getDate() + 14)),
    },
  },
  cards: {
    type: [
      {
        stripeId: { type: String },
        name: { type: String },
        number: { type: String },
        exp_month: { type: String },
        exp_year: { type: String },
        brand: { type: String },
        type: { type: String },
        fingerprint: { type: String },
      },
    ],
    default: [],
  },
  lastPaymentIntendId: {
    type: String,
    default: '',
  },
  paymentHistory: {
    type: [
      {
        stripeIntentId: String,
        stripeChargeId: String,
        amount: String,
        description: String,
        currency: String,
        createdAt: Number,
        receiptUrl: String,
        status: String,
      },
    ],
    default: [],
  },
});

// Export the Mongoose model
module.exports = mongoose.model('users', UserSchema, 'users');
