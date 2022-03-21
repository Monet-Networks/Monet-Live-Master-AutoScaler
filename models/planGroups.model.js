const mongoose = require('mongoose');

const PlanGroupsSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
  },
  leftHours: {
    type: Number,
    required: true,
  },
  usedHours: {
    type: Number,
    default: 0,
  },
  totalHours: {
    type: Number,
    required: true,
  },
  users: {
    type: [
      {
        id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'users',
        },
        name: String,
        email: String,
      },
    ],
    default: [],
  },
  logs: {
    type: [
      {
        who: {
          id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
          },
          name: String,
          email: String,
        },
        hours: String,
        timestamp: Date,
      },
    ],
    default: [],
  },
});

module.exports = mongoose.model('planGroups', PlanGroupsSchema);
