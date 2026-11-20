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

test("parseJSONResponse handles fenced JSON with surrounding text", () => {
  const parsed = parseJSONResponse('Here is the JSON:\n```json\n{"questions":[{"question":"What is AI?","correctAnswer":0,}],}\n```\nDone.');
  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].question, "What is AI?");
});

test("validateMcqQuestion normalizes provider field variations", () => {
  const q = validateMcqQuestion(
    {
      question: "Which algorithm is used for supervised learning?",
      choices: ["Linear regression", "K-means", "Apriori", "DBSCAN"],
      correct_option: "B",
      page: 4,
      difficulty: "MEDIUM",
    },
    0,
    { topic: "Machine Learning", difficulty: "medium", pageCount: 10 }
  );

  assert.ok(q);
  assert.equal(q.correctAnswer, 1);
  assert.equal(q.pageNumber, 4);
  assert.equal(q.difficulty, "medium");
  assert.equal(q.options.length, 4);
});

test("validateMcqQuestion rejects unusable questions", () => {
  assert.equal(
    validateMcqQuestion(
      { question: "Too short?", options: ["A", "A", "B", "C"], correctAnswer: 0 },
      0,
      { topic: "General", difficulty: "medium", pageCount: 5 }
    ),
    null
  );
  assert.equal(
    validateMcqQuestion(
      { question: "Which option is correct for this document?", options: ["A", "B", "C"], correctAnswer: 0 },
      0,
      { topic: "General", difficulty: "medium", pageCount: 5 }
    ),
    null
  );
});

test("validateDescriptiveQuestion accepts snake_case rubric fields", () => {
  const q = validateDescriptiveQuestion(
    {
      question: "Explain how retrieval augmented generation works.",
      expected_answer: "RAG retrieves external context and conditions the LLM on it.",
      key_points: ["retrieval", "context", "generation"],
      page_number: 7,
      subtype: "conceptual",
    },
    0,
    { topic: "RAG", difficulty: "medium", questionSubtype: "mixed", pageCount: 12 }
  );

  assert.ok(q);
  assert.equal(q.pageNumber, 7);
  assert.equal(q.subtype, "conceptual");
  assert.equal(q.keyPoints.length, 3);
});

test("selectQuestionContext returns non-empty grounded context", () => {
  const pages = Array.from({ length: 12 }, (_, i) => ({
    pageNumber: i + 1,
    text: `Page ${i + 1} discusses machine learning concepts, model evaluation, and training pipelines with enough words to form a chunk.`,
  }));
  const selection = selectQuestionContext({ pages, topic: "All Topics", count: 5, pageCount: 12 });
  assert.ok(selection.contextText.length > 100);
  assert.ok(selection.pageNumbers.length > 0);
});
