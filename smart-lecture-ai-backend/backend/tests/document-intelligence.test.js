const test = require("node:test");
const assert = require("node:assert/strict");
const {
  chunkForLLM,
  evaluateDescriptiveAnswer,
} = require("../src/services/documentAnalysisService");
const { parseJSONResponse } = require("../src/services/gemini");
const {
  selectQuestionContext,
  validateMcqQuestion,
  validateDescriptiveQuestion,
} = require("../src/services/documentIntelligence");

test("chunkForLLM chunks pages into manageable windows", () => {
  const pages = [
    { pageNumber: 1, text: "Page 1 content about machine learning and deep architectures." },
    { pageNumber: 2, text: "Page 2 content discussing backpropagation and optimization algorithms." },
    { pageNumber: 3, text: "Page 3 content detailing evaluation metrics like precision and recall." },
  ];

  const chunks = chunkForLLM(pages, 10);
  assert.ok(chunks.length >= 1);
  assert.equal(chunks[0].startPage, 1);
});

test("evaluateDescriptiveAnswer scores missing answers zero", async () => {
  const result = await evaluateDescriptiveAnswer({
    question: "What is RAG?",
    expectedAnswer: "Retrieval-Augmented Generation",
    keyPoints: ["Retrieval", "Generation", "LLM grounding"],
    userAnswer: "",
  });

  assert.equal(result.score, 0);
  assert.equal(result.missingKeyPoints.length, 3);
});

test("evaluateDescriptiveAnswer handles heuristic scoring gracefully", async () => {
  const result = await evaluateDescriptiveAnswer({
    question: "What is RAG?",
    expectedAnswer: "Retrieval-Augmented Generation connects LLMs to external vector knowledge.",
    keyPoints: ["Retrieval", "Generation", "vector knowledge"],
    userAnswer: "RAG stands for Retrieval-Augmented Generation where we retrieve external vector knowledge.",
  });

  assert.ok(result.score >= 70, `Expected score >= 70, got ${result.score}`);
  assert.ok(result.feedback.length > 0);
});
