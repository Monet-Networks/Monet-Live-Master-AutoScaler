const mongoose = require('mongoose');

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
  pdf: {
    type: {},
    default: null,
  },
  report: {
    type: {},
    default: null,
  },
});

module.exports = mongoose.model('reports', reportSchema);
