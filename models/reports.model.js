const mongoose = require('mongoose');

const reportSchema = mongoose.Schema(
  {
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
      default: [],
    },
    overallEngagement: {
      type: [],
      default: [],
    },
    pdf: {
      type: {},
      default: null,
    },
    report: {
      type: {},
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('reports', reportSchema);
