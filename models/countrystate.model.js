const mongoose = require("mongoose");

const countrystateschema = mongoose.Schema({
  state_id: { type: Number },
  country_id: { type: Number },
  state_name: { type: String },
  status: { type: Number },
});

module.exports = mongoose.model("country_state", countrystateschema);