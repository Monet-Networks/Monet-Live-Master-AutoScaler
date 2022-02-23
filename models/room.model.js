// Load required packages
const mongoose = require("mongoose");

// Define our Company schema
const roomSchema = new mongoose.Schema({
  creator: { type: String },
  creator_ID: { type: String, required: true },
  source: {
    type: String,
    enum: ["google", "outlook", "monet"],
    default: "monet",
  },
  sourceId: { type: String },
  name: {
    type: String,
    default: "-",
  },
  room: {
    type: String,
    default: "0",
  },
  roomid: {
    type: String,
    default: "0",
  },
  alive: {
    type: Number,
    enum: [0, 1],
    default: 1,
  },
  summary: {
    type: String,
    default: "-",
  },
  start: {
    dateTime: {
      type: Date,
      default: Date.now,
    },
    timeZone: {
      type: String,
    },
  },
  end: {
    dateTime: {
      type: Date,
      default: Date.now,
    },
    timeZone: {
      type: String,
    },
  },
  attendees: [String],
  link: {
    type: String,
  },
  url: {
    type: String,
  },
  description: {
    type: String,
  },
  location: {
    type: String,
  },
  organizer: {
    type: String,
  },
  observerEmail: {
    type: String,
    default: "",
  },
  observerLink: {
    type: String,
    default: "",
  },
  observing: {
    type: Boolean,
    default: false,
  },
  settings: {
    type: {
      waitingRoom: Boolean,
      screenShare: Boolean,
      chat: Boolean,
      limit: Number,
    },
    default: { waitingRoom: true, screenShare: true, chat: true, limit: 10 },
  },
  grp: {
    type: String,
    default: "",
  },
  instance: {
    type: String,
    default: "",
  },
});

// Export the Mongoose model
module.exports = mongoose.model("rooms", roomSchema, "rooms");
