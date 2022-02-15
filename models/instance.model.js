const mongoose = require('mongoose');

const instanceSchema = mongoose.Schema({
  ImageId: { type: String, default: 'NaN' },
  InstanceNo: { type: Number, required: true },
  InstanceRoute: { type: String, required: true },
  publicIP: { type: String, required: true },
  privateIP: { type: String, required: true },
  occupied: { type: Boolean, required: true },
  type: { type: String, enum: ['auto', 'manual'], default: 'manual' },
  CPU: { type: Number, default: 0 },
  Upload: { type: Number, defualt: 0 },
  Download: { type: Number, defualt: 0 },
  Calls: { type: Number, defualt: 0 },
  Participants: { type: Number, defualt: 0 },
  healthCheck: { type: String, enum: ['healthy', 'unhealthy'], default: 'healthy' },
});

module.exports = mongoose.model('instances', instanceSchema, 'instances');
