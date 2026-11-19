const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    questionIndex: Number,
    question: String,
    type: { type: String, enum: ["mcq", "descriptive"], default: "mcq" },
    selected: String,
    selectedOption: Number,
    userAnswer: String,
    correct: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    feedback: { type: String, default: "" },
    coveredPoints: { type: [String], default: [] },
    missingKeyPoints: { type: [String], default: [] },
    incorrectStatements: { type: [String], default: [] },
    suggestions: { type: String, default: "" },
    pageReferences: { type: [Number], default: [] },
    suggestedImprovements: { type: String, default: "" },
    explanation: { type: String, default: "" },
    pageNumber: { type: Number, default: 1 },
    topic: { type: String, default: "" },
    difficulty: { type: String, default: "" },
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      index: true,
    },
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      index: true,
    },
    lecture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      default: null,
    },
    documentTitle: { type: String, default: "" },
    topic: { type: String, default: "General" },
    difficulty: { type: String, default: "medium" },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 }, // seconds
    answers: [answerSchema],
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);
