const mongoose = require("mongoose");

const notificationschema = new mongoose.Schema({
  email: {
    type: "string",
  },
  read: {
    type: "boolean",
    default: false,
  },
  message: {
    type: {},
    default: [],
  },
});
module.exports = mongoose.model("notification", notificationschema);
