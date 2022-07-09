const mongoose = require("mongoose");

const countryschema = mongoose.Schema({
  country_id: { type: Number },

  country_name: { type: String },

  country_code: { type: String },

  regex: { type: Number, default: null },
});

module.exports = mongoose.model("country", countryschema);
