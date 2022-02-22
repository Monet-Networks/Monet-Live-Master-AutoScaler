const mongoose = require('mongoose');

const faceDataSchema = mongoose.Schema({
  speaking: {
    type: Number,
    enum: [0, 1],
    default: 0,
  },
  segment: Number,
  uuid: String,
  roomid: String,
  engagement: {
    type: Number,
    default: 0,
  },
  mood: {
    type: Number,
    default: 0,
  },
  FaceAnalyzed: Boolean,
  FacialExpressions: {
    DominantBasicEmotion: String,
    BasicEmotions: {
      Neutral: Number,
      Happy: Number,
      Sad: Number,
      Angry: Number,
      Surprised: Number,
      Scared: Number,
      Disgusted: Number,
    },
    Valence: Number,
    Arousal: Number,
  },
  Characteristics: {
    Gender: {
      type: String,
      // enum:["male","female"],
    },
    Age: Number,
    Glasses: {
      type: String,
      // enum:["Yes","No"],
      default: 'No',
    },
    Moustache: String,
    Beard: String,
  },
  Confidence: Number,
  HeadOrientation: [Number],
  BoundingBox: [],
  NumberOfFaces: Number,
  ActionableEmotion: {
    type: String,
    default: 'n/a',
  },
  webcam: {
    type: Number,
    default: 0,
  },
  createdAt: String,
});

module.exports = mongoose.model('fdModel', faceDataSchema, 'face_data');
