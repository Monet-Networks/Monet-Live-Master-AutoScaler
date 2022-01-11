const mongoose = require('mongoose');

const instanceSchema = mongoose.Schema({
  InstanceNo: { type: Number, required: true },
  InstanceRoute: { type: String, required: true },
  publicIP: { type: String, required: true },
  privateIP: { type: String, required: true },
  occupied: { type: Boolean, required: true },
});

module.exports = mongoose.model('instances', instanceSchema, 'instances');
