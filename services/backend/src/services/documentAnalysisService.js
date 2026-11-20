const { geminiChat, geminiJSON } = require("./gemini");

/**
 * Split text into chunks for hierarchical summarization of long documents.
 */
function chunkForLLM(pages = [], maxWordsPerChunk = 2500) {
  const chunks = [];
  let currentPages = [];
  let currentWords = 0;
  let startPage = 1;

  for (const page of pages) {
    const words = page.text ? page.text.split(/\s+/).length : 0;
    if (currentWords + words > maxWordsPerChunk && currentPages.length > 0) {
      chunks.push({
        startPage,
        endPage: page.pageNumber - 1,
        text: currentPages.join("\n\n"),
      });
      currentPages = [page.text];
      currentWords = words;
      startPage = page.pageNumber;
    } else {
      currentPages.push(`[Page ${page.pageNumber}]\n${page.text}`);
      currentWords += words;
    }
  }

  if (currentPages.length > 0) {
    chunks.push({
      startPage,
      endPage: pages[pages.length - 1]?.pageNumber || startPage,
      text: currentPages.join("\n\n"),
    });
  }

  return chunks;
}

/**
 * Feature 2 & 3: Automatic Document Analysis + Keywords & Topics
 */
async function analyzeDocument(documentTitle, pages = [], rawText = "") {
  const sampleText = rawText.slice(0, 15000); // representative content
  const pageRange = pages.length > 0 ? `1 to ${pages.length}` : "1";

  const systemPrompt = `You are DocuMind's Senior Document Intelligence AI.
Analyze the following document titled "${documentTitle}" (Pages ${pageRange}).
Provide strict, grounded analysis extracted exclusively from the text.

Respond with a JSON object matching this schema:
{
  "overview": "Comprehensive high-level description of what the document covers",
  "executiveSummary": "Concise executive overview of primary purpose and scope",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"],
  "importantFacts": ["Important verified fact 1", "Important verified fact 2", "Important verified fact 3"],
  "definitions": [
    { "term": "Term Name", "definition": "Direct explanation from document", "pageNumber": 1 }
  ],
  "importantConcepts": ["Core concept 1", "Core concept 2", "Core concept 3"],
  "keywords": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"],
  "topics": [
    {
      "name": "Topic Title",
      "explanation": "2-3 sentence grounded explanation from document",
      "subtopics": ["Subtopic A", "Subtopic B"],
      "pageNumber": 1,
      "section": "Section name or Page 1"
    }
  ]
}`;

  const userMessage = `Document Title: ${documentTitle}\n\nDocument Excerpts:\n${sampleText}`;

  try {
    const analysis = await geminiJSON(systemPrompt, userMessage, { temperature: 0.2 });
    return analysis;
  } catch (err) {
    console.warn("[documentAnalysisService] LLM analysis fallback:", err.message);
    // Deterministic extraction fallback
    const words = rawText.split(/\s+/).filter(Boolean);
    const topKeywords = Array.from(
      new Set(
        words
          .filter((w) => w.length > 5 && !/^(about|should|because|between|through|before|after)/i.test(w))
          .map((w) => w.replace(/[^a-zA-Z]/g, "").toLowerCase())
          .filter((w) => w.length > 4)
      )
    ).slice(0, 8);

    return {
      overview: `Analysis of document "${documentTitle}" containing ${pages.length} pages and ${words.length} words.`,
      executiveSummary: `This document covers topics related to ${topKeywords.slice(0, 4).join(", ")}.`,
      keyPoints: [
        `Document contains ${pages.length} pages and ${words.length} words.`,
        `Identified core vocabulary: ${topKeywords.slice(0, 3).join(", ")}.`,
        `Grounded knowledge indexed for AI Q&A and quiz generation.`,
      ],
      importantFacts: [
        `Total pages analyzed: ${pages.length}`,
        `Word count: ${words.length}`,
      ],
      definitions: [
        {
          term: topKeywords[0] || "Key Subject",
          definition: `Core concept referenced across the document.`,
          pageNumber: 1,
        },
      ],
      importantConcepts: topKeywords.slice(0, 5),
      keywords: topKeywords.length ? topKeywords : ["document", "learning", "documind"],
      topics: [
        {
          name: "Main Overview",
          explanation: `Primary subject matter of "${documentTitle}".`,
          subtopics: topKeywords.slice(0, 3),
          pageNumber: 1,
          section: "Section 1",
        },
      ],
    };
  }
}

/**
 * Feature 4: Document Summarization (Short, Detailed, Section-wise with Map-Reduce)
 */
async function generateSummaries(documentTitle, pages = [], rawText = "") {
  const chunks = chunkForLLM(pages, 2500);

  // Map phase: summarize each section if multi-chunk
  const chunkSummaries = [];
  for (let i = 0; i < Math.min(chunks.length, 5); i++) {
    const c = chunks[i];
    try {
      const prompt = `Summarize these pages (Pages ${c.startPage}-${c.endPage}) of "${documentTitle}" concisely in 2-3 sentences.`;
      const s = await geminiChat(prompt, c.text, { maxTokens: 250, temperature: 0.3 });
      chunkSummaries.push({
        title: `Pages ${c.startPage}–${c.endPage}`,
        summary: s.trim(),
        pageNumber: c.startPage,
      });
    } catch {
      chunkSummaries.push({
        title: `Pages ${c.startPage}–${c.endPage}`,
        summary: `Covers material on pages ${c.startPage} through ${c.endPage}.`,
        pageNumber: c.startPage,
      });
    }
  }

  // Reduce phase: generate comprehensive summaries
  const context = chunkSummaries.map((cs) => `### ${cs.title}\n${cs.summary}`).join("\n\n");

  const systemPrompt = `You are DocuMind's Senior Summarization Engine.
Generate 3 distinct summaries for "${documentTitle}":
1. "shortSummary": 2-3 concise sentences summarizing the absolute core thesis.
2. "detailedSummary": Structured comprehensive narrative covering background, key principles, methodologies, and outcomes.
3. "sectionWiseSummary": Markdown formatted section-by-section breakdown.
4. "keyTakeaways": List of 4-6 bullet point takeaways.

Respond with valid JSON:
{
  "shortSummary": "...",
  "detailedSummary": "...",
  "sectionWiseSummary": "...",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"]
}`;

  try {
    const reduced = await geminiJSON(systemPrompt, `Document title: ${documentTitle}\n\nSection summaries:\n${context}`);
    return {
      shortSummary: reduced.shortSummary,
      detailedSummary: reduced.detailedSummary,
      sectionWiseSummary: reduced.sectionWiseSummary,
      keyTakeaways: reduced.keyTakeaways || [],
      chapterSummaries: chunkSummaries,
    };
  } catch (err) {
    const firstLines = rawText.slice(0, 600).trim();
    return {
      shortSummary: `A comprehensive study of ${documentTitle} comprising ${pages.length} pages. ${firstLines.slice(0, 150)}...`,
      detailedSummary: `## Document Overview: ${documentTitle}\n\nThis document spans ${pages.length} pages. Key topics include technical definitions, analysis, and core knowledge bases.\n\n${firstLines}`,
      sectionWiseSummary: chunkSummaries.map((cs) => `### ${cs.title}\n${cs.summary}`).join("\n\n"),
      keyTakeaways: [
        `Covers ${pages.length} pages of technical material.`,
        `Grounded in document: ${documentTitle}.`,
        `Ready for AI questions and customized quizzes.`,
      ],
      chapterSummaries: chunkSummaries,
    };
  }
}

/**
 * Feature 6: MCQ Question Generation strictly from document with Page References.
 */
async function generateMCQs({ documentTitle, contextText, topic, difficulty = "medium", count = 5 }) {
  const systemPrompt = `You are DocuMind's Academic Quiz Generator.
Generate exactly ${count} multiple choice questions (MCQs) strictly from the provided document excerpts of "${documentTitle}".
Topic focus: ${topic || "All Topics"}
Difficulty level: ${difficulty.toUpperCase()}

Difficulty rules:
- EASY: Direct factual recall, key definitions, straightforward terms.
- MEDIUM: Conceptual understanding, comparisons, application of concepts.
- HARD: Deep analytical reasoning, synthesis across sections, multi-step problem solving.

Strict validation requirements:
1. Every question must have exactly 4 distinct options (no duplicates).
2. Exactly one correct answer (index 0, 1, 2, or 3).
3. Explanation must cite why the answer is correct according to the document.
4. pageNumber must reference the relevant page in the text.
5. All questions must be 100% answerable from the provided excerpts.

Respond with JSON:
{
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question": "What is...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "According to page X...",
      "pageNumber": 1,
      "topic": "${topic || "General"}",
      "difficulty": "${difficulty}"
    }
  ]
}`;

  const userMessage = `Excerpts from "${documentTitle}":\n\n${contextText.slice(0, 12000)}`;

  try {
    const result = await geminiJSON(systemPrompt, userMessage, { temperature: 0.3 });
    const questions = (result.questions || []).map((q, i) => ({
      id: q.id || `q-${i + 1}`,
      type: "mcq",
      question: q.question,
      options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ["True", "False", "Partially True", "Not Mentioned"],
      correctAnswer: typeof q.correctAnswer === "number" && q.correctAnswer >= 0 && q.correctAnswer < 4 ? q.correctAnswer : 0,
      explanation: q.explanation || "Derived from document context.",
      pageNumber: q.pageNumber || 1,
      topic: q.topic || topic || "General",
      difficulty: q.difficulty || difficulty,
    }));
    return questions;
  } catch (err) {
    console.warn("[documentAnalysisService] MCQ generation fallback:", err.message);
    return [
      {
        id: "q-1",
        type: "mcq",
        question: `What is the primary topic addressed in "${documentTitle}"?`,
        options: [
          documentTitle,
          "General Information",
          "Unrelated Concept",
          "Archived Notes",
        ],
        correctAnswer: 0,
        explanation: `The document "${documentTitle}" explicitly focuses on this subject.`,
        pageNumber: 1,
        topic: topic || "Overview",
        difficulty,
      },
    ];
  }
}

/**
 * Feature 7: Descriptive Question Generation with Expected Answers & Key Points.
 */
async function generateDescriptiveQuestions({ documentTitle, contextText, topic, difficulty = "medium", count = 3 }) {
  const systemPrompt = `You are DocuMind's Academic Exam Author.
Generate exactly ${count} descriptive study questions strictly from the provided excerpts of "${documentTitle}".
Topic focus: ${topic || "All Topics"}
Difficulty level: ${difficulty.toUpperCase()}

Requirements:
- Include conceptual, analytical, and definition-based questions.
- Provide a comprehensive "expectedAnswer".
- Provide a list of "keyPoints" (3-5 items) that a complete student answer should contain.
- Provide the "pageNumber" where this material is discussed.

Respond with JSON:
{
  "questions": [
    {
      "id": "dq1",
      "type": "descriptive",
      "question": "Explain the concept of...",
      "expectedAnswer": "A full explanation covering...",
      "keyPoints": ["Point 1", "Point 2", "Point 3"],
      "explanation": "Reference to document reasoning...",
      "pageNumber": 1,
      "topic": "${topic || "General"}",
      "difficulty": "${difficulty}"
    }
  ]
}`;

  const userMessage = `Excerpts from "${documentTitle}":\n\n${contextText.slice(0, 12000)}`;

  try {
    const result = await geminiJSON(systemPrompt, userMessage, { temperature: 0.3 });
    return (result.questions || []).map((q, i) => ({
      id: q.id || `dq-${i + 1}`,
      type: "descriptive",
      question: q.question,
      expectedAnswer: q.expectedAnswer || "",
      keyPoints: Array.isArray(q.keyPoints) ? q.keyPoints : ["Clarity", "Grounded facts", "Correct explanation"],
      explanation: q.explanation || "Supported by document text.",
      pageNumber: q.pageNumber || 1,
      topic: q.topic || topic || "General",
      difficulty: q.difficulty || difficulty,
    }));
  } catch (err) {
    console.warn("[documentAnalysisService] Descriptive question fallback:", err.message);
    return [
      {
        id: "dq-1",
        type: "descriptive",
        question: `Explain the central premise and key findings presented in "${documentTitle}".`,
        expectedAnswer: `The document discusses the core architecture and principles outlined in its introductory sections.`,
        keyPoints: ["Accurate identification of subject", "Key terminology", "Practical applications"],
        explanation: `Derived from introductory pages of ${documentTitle}.`,
        pageNumber: 1,
        topic: topic || "Overview",
        difficulty,
      },
    ];
  }
}

/**
 * Feature 7: AI Answer Evaluation for Descriptive Questions.
 * Evaluates student answer against expected answer and key points.
 */
async function evaluateDescriptiveAnswer({ question, expectedAnswer, keyPoints = [], userAnswer }) {
  if (!userAnswer || !userAnswer.trim()) {
    return {
      score: 0,
      feedback: "No answer provided.",
      missingKeyPoints: keyPoints,
      suggestedImprovements: "Please write an answer addressing the key concepts.",
    };
  }

  const systemPrompt = `You are DocuMind's Senior Academic Evaluator.
Evaluate the student's answer to the following question against the expected answer and key points.

Question: ${question}
Expected Answer: ${expectedAnswer}
Key Points Required: ${JSON.stringify(keyPoints)}

Do NOT simply match keywords. Evaluate conceptual understanding, accuracy, completeness, and clarity.
Assign a score from 0 to 100.
Identify which key points were covered and which were missing.

Respond with JSON:
{
  "score": 85,
  "feedback": "Concise 2-3 sentence constructive critique of student answer.",
  "missingKeyPoints": ["Point not addressed"],
  "suggestedImprovements": "Specific advice on how to improve this answer."
}`;

  const userMessage = `Student Answer:\n${userAnswer}`;

  try {
    const evaluation = await geminiJSON(systemPrompt, userMessage, { temperature: 0.1 });
    return {
      score: Math.max(0, Math.min(100, Math.round(evaluation.score || 0))),
      feedback: evaluation.feedback || "Evaluated based on document standards.",
      missingKeyPoints: Array.isArray(evaluation.missingKeyPoints) ? evaluation.missingKeyPoints : [],
      suggestedImprovements: evaluation.suggestedImprovements || "",
    };
  } catch (err) {
    // Intelligent heuristic fallback
    const userCleanText = userAnswer.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    const userWords = userCleanText.split(/\s+/).filter(Boolean);
    let matchedCount = 0;
    const missing = [];

    for (const kp of keyPoints) {
      const kpClean = kp.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
      const kpWords = kpClean.split(/\s+/).filter((w) => w.length > 2);
      const hasMatch = kpClean && (userCleanText.includes(kpClean) || kpWords.some((w) => userWords.includes(w)));
      if (hasMatch) {
        matchedCount++;
      } else {
        missing.push(kp);
      }
    }

    const ratio = keyPoints.length > 0 ? matchedCount / keyPoints.length : 0.7;
    const lengthBonus = Math.min(20, userWords.length * 0.8);
    const score = Math.round(Math.min(100, ratio * 80 + lengthBonus));

    return {
      score,
      feedback: score >= 70 ? "Good conceptual understanding demonstrated." : "Partial answer. Review the missing key points to strengthen your response.",
      missingKeyPoints: missing,
      suggestedImprovements: missing.length ? `Make sure to incorporate: ${missing.join(", ")}.` : "Great job covering the key concepts.",
    };
  }
}

module.exports = {
  analyzeDocument,
  generateSummaries,
  generateMCQs,
  generateDescriptiveQuestions,
  evaluateDescriptiveAnswer,
  chunkForLLM,
};
