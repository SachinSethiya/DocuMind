const mongoose = require("mongoose");

const quizQuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["mcq", "descriptive"], default: "mcq" },
    question: { type: String, required: true },
    options: { type: [String], default: [] },
    correctAnswer: { type: Number, default: 0 },
    expectedAnswer: { type: String, default: "" },
    keyPoints: { type: [String], default: [] },
    explanation: { type: String, default: "" },
    pageNumber: { type: Number, default: 1 },
    pageReferences: { type: [Number], default: [] },
    section: { type: String, default: "" },
    topic: { type: String, default: "General" },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    subtype: { type: String, enum: ["mcq", "shortAnswer", "longAnswer", "conceptual", "analytical", "mixed"], default: "mcq" },
    estimatedAnswerLength: { type: String, default: "" },
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    documentTitle: { type: String, default: "" },
    title: { type: String, required: true, trim: true },
    topic: { type: String, default: "All Topics" },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard", "mixed"],
      default: "medium",
    },
    questionType: {
      type: String,
      enum: ["mcq", "descriptive", "mixed"],
      default: "mcq",
    },
    questionSubtype: {
      type: String,
      enum: ["mcq", "shortAnswer", "longAnswer", "conceptual", "analytical", "mixed"],
      default: "mcq",
    },
    requestedCount: { type: Number, default: 0 },
    selectedTopics: { type: [String], default: [] },
    questions: [quizQuestionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quiz", quizSchema);
