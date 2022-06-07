const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: false },
  published: { type: Boolean, defualt: false },
  questions: [
    {
      question: { type: String, required: true },
      question_label: { type: String, required: true },
      question_type: { type: String, enum: ["single", "freetext", "multiple"] },
      options: {
        type: [
          {
            label: String,
            option: String,
          },
        ],
      },
      answer: { type: String, required: false },
    },
  ],
  submissions: [
    {
      uuid: { type: String, required: true },
      question_id: { type: String, required: true },
      answer: { type: String, required: true },
      correct: { type: Boolean },
    },
  ],
});

module.exports = mongoose.model("assignments", assignmentSchema);
