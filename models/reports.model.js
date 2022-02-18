const mongoose = require('mongoose');
// const index = require('async');

// collection or table -> What type of data.
const reportSchema = mongoose.Schema({
  roomid: {
    type: String,
    index: true,
    required: true,
  },
  creator_ID: {
    type: String,
    index: true,
    required: true,
  },
  pieData: {
    type: [],
    required: true,
  },
  overallEngagement: {
    type: [],
    required: true,
  },
  report: {
    type: {},
    default: null,
  },
});

module.exports = mongoose.model('reports', reportSchema);
