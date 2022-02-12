const mongoose = require('mongoose');

const instanceSchema = mongoose.Schema({
  InstanceNo: { type: Number, required: true },
  InstanceRoute: { type: String, required: true },
  publicIP: { type: String, required: true },
  privateIP: { type: String, required: true },
  occupied: { type: Boolean, required: true },
  type: { type: String, enum: ['auto', 'manual'], default: 'manual' },
  CPU: { type: Number, default: 0 },
  Upload: { type: String, default: '0' },
  Download: { type: String, default: '0' },
  Calls: { type: Number, default: 0 },
  Participants: { type: Number, default: 0 },
});

module.exports = mongoose.model('instances', instanceSchema, 'instances');
