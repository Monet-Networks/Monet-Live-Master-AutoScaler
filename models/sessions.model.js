const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  active: {
    type: Boolean,
    default: false,
  },
  proctor: {
    type: String,
    enum: ['student', 'proctor', 'manager', 'teacher'],
    default: 'student',
  },
  sid: {
    type: String,
    default: '-',
  },
  pubID: {
    type: Number,
    default: -1,
  },
  email: {
    type: String,
    default: 'malkoti.mayank@gmail.com',
    // required: true,
  },
  uuid: { type: String, required: true },
  roomid: { type: String, required: true },
  name: { type: String, required: true },
  time: { type: String, required: true },
  serverIP: { type: String, required: true },
  raiseHand: { type: Boolean, default: false },
  janus: {
    room: { type: Number },
    webcam: { type: Boolean, default: false },
    screen: { type: Boolean, default: false },
    audio: { type: Boolean, default: false },
    audio_start: {
      type: Date,
      default() {
        return new Date();
      },
    },
    audio_stop: { type: Date, default: new Date() },
    video: { type: Boolean, default: false },
    video_start: {
      type: Date,
      default() {
        return new Date();
      },
    },
    video_stop: { type: Date, default: new Date() },
  },
});

SessionSchema.pre('save', function (next) {
  if (!this.janus.room) this.janus.room = this.roomid;
  next();
});

// SessionSchema.post('save', async function (next) {
//     console.log("==============This is sessions post hook : ", this.janus);
//     if (this.janus.video_start === "NaN") {
//         const date = new Date()
//         this.janus.video_start = date
//         this.janus.audio_start = date
//         await this.save();
//     }
//     next();
// })

module.exports = mongoose.model('sessions', SessionSchema, 'sessions');
