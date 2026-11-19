const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, default: 0 }, // bytes
    fileType: { type: String, default: "pdf" }, // pdf | docx | txt
    status: {
      type: String,
      enum: ["uploaded", "processing", "analyzing", "completed", "ready", "failed"],
      default: "uploaded",
      index: true,
    },
    errorMessage: { type: String, default: "" },
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    totalWords: { type: Number, default: 0 },
    rawText: { type: String, default: "" },

    // Per-page text preservation (for exact page references)
    pages: [
      {
        pageNumber: { type: Number, required: true },
        text: { type: String, default: "" },
      },
    ],

    // Document structure (headings, sections)
    structure: [
      {
        heading: { type: String, default: "" },
        level: { type: Number, default: 1 },
        pageNumber: { type: Number, default: 1 },
        section: { type: String, default: "" },
      },
    ],

    // Core Feature 2: Automatic Document Analysis
    analysis: {
      overview: { type: String, default: "" },
      executiveSummary: { type: String, default: "" },
      keyPoints: { type: [String], default: [] },
      importantFacts: { type: [String], default: [] },
      definitions: [
        {
          term: { type: String, default: "" },
          definition: { type: String, default: "" },
          pageNumber: { type: Number, default: 1 },
        },
      ],
      importantConcepts: { type: [String], default: [] },
    },

    // Core Feature 4: Document Summarization (Short, Detailed, Section-wise)
    summary: {
      overview: { type: String, default: "" },
      executiveSummary: { type: String, default: "" },
      keyPoints: { type: [String], default: [] },
      importantConcepts: { type: [String], default: [] },
      chapterSummaries: [
        {
          title: { type: String, default: "" },
          summary: { type: String, default: "" },
          pageNumber: { type: Number, default: 1 },
        },
      ],
      definitions: [
        {
          term: { type: String, default: "" },
          definition: { type: String, default: "" },
        },
      ],
      keyTakeaways: { type: [String], default: [] },
      shortSummary: { type: String, default: "" },
      detailedSummary: { type: String, default: "" },
      sectionWiseSummary: { type: String, default: "" },
      lastGeneratedAt: { type: Date, default: Date.now },
    },

    // Core Feature 3: Keywords & Topics
    keywords: { type: [String], default: [] },
    topics: [
      {
        name: { type: String, required: true },
        explanation: { type: String, default: "" },
        subtopics: { type: [String], default: [] },
        pageNumber: { type: Number, default: 1 },
        section: { type: String, default: "" },
      },
    ],

    // Core Feature 5: Grounded Chat History with Page References
    chatHistory: [
      {
        role: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, required: true },
        sources: [
          {
            text: { type: String, default: "" },
            score: { type: Number, default: 0 },
            pageNumber: { type: Number, default: 1 },
            section: { type: String, default: "" },
          },
        ],
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", documentSchema);
