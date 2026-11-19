const { geminiChat, geminiJSON } = require("./gemini");

const MAX_QUESTIONS = parseInt(process.env.MAX_QUESTIONS_PER_GENERATION || "20", 10);
const QUESTION_CONTEXT_BUDGET = 16000;
const ANALYSIS_CONTEXT_BUDGET = 30000;

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "are", "was", "were", "have", "has", "had",
  "you", "your", "our", "their", "they", "them", "what", "when", "where", "which", "who", "how",
  "about", "into", "over", "under", "between", "through", "during", "before", "after", "above",
  "below", "up", "down", "out", "off", "again", "further", "then", "once", "here", "there", "all",
  "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "can", "will", "just", "should", "now", "document",
  "page", "section", "chapter", "figure", "table", "example", "following", "based", "using", "used",
]);

function chunkForLLM(pages = [], maxWordsPerChunk = 2200) {
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
        pageNumbers: currentPages.map((p) => p.pageNumber),
        text: currentPages.map((p) => `[Page ${p.pageNumber}]\n${p.text}`).join("\n\n"),
      });
      currentPages = [page];
      currentWords = words;
      startPage = page.pageNumber;
    } else {
      currentPages.push(page);
      currentWords += words;
    }
  }

  if (currentPages.length > 0) {
    chunks.push({
      startPage,
      endPage: pages[pages.length - 1]?.pageNumber || startPage,
      pageNumbers: currentPages.map((p) => p.pageNumber),
      text: currentPages.map((p) => `[Page ${p.pageNumber}]\n${p.text}`).join("\n\n"),
    });
  }

  return chunks;
}

function pagesFromRawText(rawText = "", fallbackPageCount = 1) {
  const text = (rawText || "").trim();
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const wordsPerPage = 450;
  const pageCount = Math.max(1, fallbackPageCount || Math.ceil(words.length / wordsPerPage));
  const pages = [];
  for (let i = 0; i < pageCount; i++) {
    const slice = words.slice(i * wordsPerPage, (i + 1) * wordsPerPage).join(" ");
    if (slice) pages.push({ pageNumber: i + 1, text: slice });
  }
  return pages.length ? pages : [{ pageNumber: 1, text }];
}

function normalizeKey(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const cleaned = String(value || "").trim();
    const key = normalizeKey(cleaned);
    if (!cleaned || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function clampPage(pageNumber, pageCount = 1) {
  const n = parseInt(pageNumber, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, pageCount || n));
}

function topicTerms(topic = "") {
  return normalizeKey(topic)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function scoreTextForTopic(text = "", terms = []) {
  const lower = text.toLowerCase();
  let score = 0;
  for (const term of terms) {
    const matches = lower.split(term).length - 1;
    score += matches * (term.length > 5 ? 2 : 1);
  }
  return score;
}

function selectQuestionContext({ pages = [], rawText = "", topic = "", count = 5, pageCount = 1 }) {
  const sourcePages = pages.length ? pages : pagesFromRawText(rawText, pageCount);
  const chunks = chunkForLLM(sourcePages, 1800);
  if (!chunks.length) return { contextText: "", chunks: [], pageNumbers: [] };

  const topicKey = normalizeKey(topic);
  const isSpecificTopic = topicKey && !["all topics", "entire document", "important topics", "general", "overview"].includes(topicKey);
  const terms = topicTerms(topic);

  let selected = chunks;
  if (isSpecificTopic) {
    const scored = chunks.map((chunk) => ({
      ...chunk,
      score: scoreTextForTopic(chunk.text, terms) + scoreTextForTopic(chunk.text, topicTerms(topicKey)),
    }));
    scored.sort((a, b) => b.score - a.score);
    const relevant = scored.filter((c) => c.score > 0).slice(0, Math.max(3, count * 2));
    selected = relevant.length ? relevant : scored.slice(0, Math.max(3, count));
  } else {
    // Coverage-aware selection: sample chunks evenly across the document.
    const maxChunks = Math.max(4, Math.min(chunks.length, Math.ceil(QUESTION_CONTEXT_BUDGET / 3500)));
    if (chunks.length > maxChunks) {
      selected = [];
      const step = (chunks.length - 1) / (maxChunks - 1);
      for (let i = 0; i < maxChunks; i++) {
        selected.push(chunks[Math.round(i * step)]);
      }
    }
  }

  let contextText = "";
  const pageNumbers = [];
  for (const chunk of selected) {
    const piece = `[Pages ${chunk.startPage}-${chunk.endPage}]\n${chunk.text}`;
    if (contextText.length + piece.length > QUESTION_CONTEXT_BUDGET && contextText) break;
    contextText += `${piece}\n\n`;
    pageNumbers.push(...(chunk.pageNumbers || []));
  }

  return { contextText: contextText.trim(), chunks: selected, pageNumbers: uniqueStrings(pageNumbers.map(String)).map(Number) };
}

async function geminiJSONWithRetry(systemPrompt, userMessage, opts = {}, attempts = 2) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await geminiJSON(systemPrompt, userMessage, opts);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        userMessage += "\n\nReminder: return ONLY valid JSON matching the requested schema.";
      }
    }
  }
  throw lastErr;
}

function firstString(...values) {
  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    if (cleaned) return cleaned;
  }
  return "";
}

function normalizeOptions(raw) {
  let options = raw;
  if (!Array.isArray(options) && options && typeof options === "object") {
    options = [options.A, options.B, options.C, options.D, options.a, options.b, options.c, options.d]
      .filter((v) => v !== undefined);
  }
  if (!Array.isArray(options)) return [];
  return options
    .map((opt) => {
      if (typeof opt === "string") return opt.trim();
      if (opt && typeof opt === "object") {
        return firstString(opt.text, opt.option, opt.label, opt.value, opt.answer, opt.choice);
      }
      return String(opt ?? "").trim();
    })
    .filter(Boolean);
}

function normalizeCorrectAnswer(raw, options = []) {
  const candidates = [
    raw?.correctAnswer,
    raw?.correct_answer,
    raw?.correctAnswerIndex,
    raw?.correctOption,
    raw?.correct_option,
    raw?.correct,
    raw?.answer,
    raw?.answerIndex,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") continue;

    if (typeof candidate === "number" && Number.isInteger(candidate)) {
      if (candidate >= 0 && candidate <= 3) return candidate;
      if (candidate >= 1 && candidate <= 4) return candidate - 1;
      continue;
    }

    const asString = String(candidate).trim();
    if (!asString) continue;

    const letter = asString.match(/^([A-Da-d])\)?[.:]?\s*$/);
    if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65;

    const numeric = parseInt(asString, 10);
    if (Number.isInteger(numeric)) {
      if (numeric >= 0 && numeric <= 3) return numeric;
      if (numeric >= 1 && numeric <= 4) return numeric - 1;
    }

    const optionIndex = options.findIndex((opt) => normalizeKey(opt) === normalizeKey(asString));
    if (optionIndex >= 0) return optionIndex;
  }

  return -1;
}

function normalizeDifficultyValue(value, fallback = "medium") {
  const cleaned = String(value || "").trim().toLowerCase();
  if (["easy", "medium", "hard"].includes(cleaned)) return cleaned;
  if (fallback === "mixed") return "medium";
  return ["easy", "medium", "hard"].includes(fallback) ? fallback : "medium";
}

function normalizePageValue(value, pageCount = 1) {
  return clampPage(value, pageCount);
}

function normalizePageReferences(raw, pageNumber, pageCount) {
  const candidates = raw?.pageReferences ?? raw?.page_references ?? raw?.pages ?? raw?.sourcePages;
  const list = Array.isArray(candidates) ? candidates : candidates ? [candidates] : [];
  const refs = uniqueStrings(list.map((p) => String(p))).map((p) => clampPage(p, pageCount));
  if (!refs.length && pageNumber > 0) refs.push(pageNumber);
  return refs.slice(0, 12);
}

function validateMcqQuestion(raw, index, { topic, difficulty, pageCount }) {
  if (!raw || typeof raw !== "object") return null;
  const question = firstString(raw.question, raw.q, raw.prompt, raw.text);
  const options = normalizeOptions(raw.options ?? raw.choices ?? raw.answers ?? raw.possibleAnswers);
  const correctAnswer = normalizeCorrectAnswer(raw, options);
  const explanation = firstString(raw.explanation, raw.rationale, raw.reason, raw.feedback, raw.correctExplanation)
    || `Correct answer: ${options[correctAnswer] || "option"}. See the referenced page for supporting detail.`;

  if (question.length < 12) return null;
  if (options.length !== 4 || new Set(options.map((o) => normalizeKey(o))).size !== 4) return null;
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) return null;

  const pageNumber = normalizePageValue(raw.pageNumber ?? raw.page ?? raw.sourcePage ?? raw.page_reference, pageCount);

  return {
    id: raw.id || `mcq-${index + 1}`,
    type: "mcq",
    question,
    options,
    correctAnswer,
    explanation,
    pageNumber,
    pageReferences: normalizePageReferences(raw, pageNumber, pageCount),
    section: firstString(raw.section, raw.heading, raw.chapter),
    topic: firstString(raw.topic, raw.subject, topic) || "General",
    difficulty: normalizeDifficultyValue(raw.difficulty, difficulty),
    subtype: "mcq",
  };
}

function normalizeSubtypeValue(value, fallback = "mixed") {
  const cleaned = String(value || "").trim().toLowerCase().replace(/[_\s-]+/g, "");
  const map = {
    short: "shortAnswer",
    shortanswer: "shortAnswer",
    sa: "shortAnswer",
    long: "longAnswer",
    longanswer: "longAnswer",
    la: "longAnswer",
    conceptual: "conceptual",
    concept: "conceptual",
    analytical: "analytical",
    analysis: "analytical",
    essay: "longAnswer",
    mixed: "mixed",
  };
  if (map[cleaned]) return map[cleaned];
  return ["shortAnswer", "longAnswer", "conceptual", "analytical", "mixed"].includes(fallback) ? fallback : "mixed";
}

function validateDescriptiveQuestion(raw, index, { topic, difficulty, questionSubtype, pageCount }) {
  if (!raw || typeof raw !== "object") return null;
  const question = firstString(raw.question, raw.q, raw.prompt, raw.text);
  const expectedAnswer = firstString(
    raw.expectedAnswer,
    raw.expected_answer,
    raw.modelAnswer,
    raw.referenceAnswer,
    raw.answer,
    raw.explanation,
    raw.rationale
  );
  const keyPoints = uniqueStrings(
    Array.isArray(raw.keyPoints)
      ? raw.keyPoints
      : Array.isArray(raw.key_points)
        ? raw.key_points
        : Array.isArray(raw.rubric)
          ? raw.rubric
          : Array.isArray(raw.importantPoints)
            ? raw.importantPoints
            : Array.isArray(raw.points)
              ? raw.points
              : []
  );
  if (question.length < 12 || !expectedAnswer) return null;

  const subtype = normalizeSubtypeValue(raw.subtype ?? raw.type ?? raw.questionType, questionSubtype);
  const pageNumber = normalizePageValue(raw.pageNumber ?? raw.page ?? raw.sourcePage ?? raw.page_reference, pageCount);

  return {
    id: raw.id || `dq-${index + 1}`,
    type: "descriptive",
    question,
    expectedAnswer,
    keyPoints: keyPoints.length ? keyPoints : ["Accuracy", "Completeness", "Clarity"],
    explanation: firstString(raw.explanation, raw.rationale, raw.feedback) || expectedAnswer,
    pageNumber,
    pageReferences: normalizePageReferences(raw, pageNumber, pageCount),
    section: firstString(raw.section, raw.heading, raw.chapter),
    topic: firstString(raw.topic, raw.subject, topic) || "General",
    difficulty: normalizeDifficultyValue(raw.difficulty, difficulty),
    subtype,
    estimatedAnswerLength: firstString(raw.estimatedAnswerLength, raw.answerLength, raw.length) || (subtype === "longAnswer" || subtype === "analytical" ? "Detailed" : "Short"),
  };
}

function dedupeQuestions(questions = []) {
  const seen = new Set();
  return questions.filter((q) => {
    const key = normalizeKey(q.question);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function generateMCQs({ documentTitle, pages = [], rawText = "", contextText = "", topic = "All Topics", difficulty = "medium", count = 5, pageCount = 1 }) {
  const requested = Math.max(1, Math.min(MAX_QUESTIONS, parseInt(count, 10) || 5));
  const selection = contextText
    ? { contextText, chunks: [], pageNumbers: [] }
    : selectQuestionContext({ pages, rawText, topic, count: requested, pageCount });
  const context = selection.contextText || "";
  if (!context.trim()) {
    return {
      questions: [],
      requested,
      generated: 0,
      warning: "No usable document text was available for MCQ generation.",
      error: "empty_context",
    };
  }

  const contextChars = Math.min(context.length, QUESTION_CONTEXT_BUDGET);
  console.log(
    `[documentIntelligence] MCQ generation start doc="${documentTitle}" topic="${topic}" difficulty="${difficulty}" requested=${requested} contextChars=${contextChars} sourcePages=${selection.pageNumbers.length} chunks=${selection.chunks.length}`
  );

  const difficultyGuide = {
    easy: "Direct factual recall, definitions, and straightforward concept identification.",
    medium: "Conceptual understanding, comparisons, applications, and relationships between concepts.",
    hard: "Analytical reasoning, multi-step inference, synthesis across sections, and application of multiple concepts.",
    mixed: "A balanced mix of easy, medium, and hard questions. Assign each question an appropriate difficulty.",
  }[difficulty] || "Conceptual understanding.";

  const collected = [];
  const seenQuestions = new Set();
  let attempts = 0;
  let invalidCount = 0;
  let duplicateCount = 0;
  let lastError = null;

  while (collected.length < requested && attempts < 3) {
    attempts += 1;
    const remaining = requested - collected.length;
    const batchSize = Math.min(remaining, 8);
    const existing = collected.map((q) => `- ${q.question}`).join("\n");

    const systemPrompt = `You are DocuMind's senior assessment designer.
Generate exactly ${batchSize} NEW multiple-choice questions from the provided document excerpts for "${documentTitle}".
Topic focus: ${topic || "All Topics"}
Difficulty guidance: ${difficultyGuide}

Rules:
- Every question must be answerable only from the excerpts.
- Exactly 4 distinct plausible options and exactly one correct answer.
- correctAnswer must be the zero-based index of the correct option (0, 1, 2, or 3).
- Avoid duplicates and avoid repeating these existing questions:\n${existing || "None"}
- Include explanation, topic, difficulty, pageNumber, pageReferences, and section when known.
- pageNumber must be a real page number present in the excerpts.

Return JSON only:
{"questions":[{"id":"q1","question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","pageNumber":1,"pageReferences":[1],"section":"...","topic":"...","difficulty":"easy|medium|hard"}]}`;

    try {
      const result = await geminiJSONWithRetry(systemPrompt, `Document excerpts:\n\n${context.slice(0, QUESTION_CONTEXT_BUDGET)}`, { temperature: 0.25 });
      const batch = Array.isArray(result?.questions) ? result.questions : [];
      console.log(`[documentIntelligence] MCQ attempt ${attempts}: rawQuestions=${batch.length} collected=${collected.length}`);
      for (const raw of batch) {
        const q = validateMcqQuestion(raw, collected.length, { topic, difficulty, pageCount });
        if (!q) {
          invalidCount += 1;
          continue;
        }
        const key = normalizeKey(q.question);
        if (seenQuestions.has(key)) {
          duplicateCount += 1;
          continue;
        }
        seenQuestions.add(key);
        collected.push(q);
        if (collected.length >= requested) break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[documentIntelligence] MCQ generation attempt ${attempts} failed:`, err.message);
    }
  }

  const questions = dedupeQuestions(collected).slice(0, requested);
  let warning = "";
  if (!questions.length && lastError) {
    warning = `AI question generation failed: ${lastError.message}`;
  } else if (questions.length < requested) {
    warning = `Only ${questions.length} of ${requested} valid MCQs could be generated from the available content. Try a lower count or a broader topic.`;
  }

  console.log(
    `[documentIntelligence] MCQ generation done requested=${requested} generated=${questions.length} invalid=${invalidCount} duplicates=${duplicateCount} error=${lastError?.message || "none"}`
  );

  return {
    questions,
    requested,
    generated: questions.length,
    warning,
    error: lastError?.message || "",
  };
}

async function generateDescriptiveQuestions({ documentTitle, pages = [], rawText = "", contextText = "", topic = "All Topics", difficulty = "medium", questionSubtype = "mixed", count = 5, pageCount = 1 }) {
  const requested = Math.max(1, Math.min(MAX_QUESTIONS, parseInt(count, 10) || 5));
  const selection = contextText
    ? { contextText, chunks: [], pageNumbers: [] }
    : selectQuestionContext({ pages, rawText, topic, count: requested, pageCount });
  const context = selection.contextText || "";
  if (!context.trim()) {
    return {
      questions: [],
      requested,
      generated: 0,
      warning: "No usable document text was available for descriptive question generation.",
      error: "empty_context",
    };
  }

  const contextChars = Math.min(context.length, QUESTION_CONTEXT_BUDGET);
  console.log(
    `[documentIntelligence] Descriptive generation start doc="${documentTitle}" topic="${topic}" difficulty="${difficulty}" subtype="${questionSubtype}" requested=${requested} contextChars=${contextChars} sourcePages=${selection.pageNumbers.length} chunks=${selection.chunks.length}`
  );

  const difficultyGuide = {
    easy: "Basic explanations, definitions, and straightforward conceptual questions.",
    medium: "Conceptual understanding, comparisons, applications, and relationships.",
    hard: "Analytical and multi-concept questions requiring synthesis and evaluation.",
    mixed: "A balanced mix of easy, medium, and hard questions.",
  }[difficulty] || "Conceptual understanding.";

  const subtypeGuide = {
    shortAnswer: "Short-answer questions expecting 2-5 sentence answers.",
    longAnswer: "Long-answer questions expecting structured multi-paragraph explanations.",
    conceptual: "Conceptual questions testing understanding of ideas and relationships.",
    analytical: "Analytical questions requiring reasoning, comparison, or evaluation.",
    mixed: "A balanced mix of short, long, conceptual, and analytical questions.",
  }[questionSubtype] || "Mixed descriptive questions.";

  const collected = [];
  const seenQuestions = new Set();
  let attempts = 0;
  let invalidCount = 0;
  let duplicateCount = 0;
  let lastError = null;

  while (collected.length < requested && attempts < 3) {
    attempts += 1;
    const remaining = requested - collected.length;
    const batchSize = Math.min(remaining, 6);
    const existing = collected.map((q) => `- ${q.question}`).join("\n");

    const systemPrompt = `You are DocuMind's senior exam author.
Generate exactly ${batchSize} NEW descriptive questions from the provided excerpts for "${documentTitle}".
Topic focus: ${topic || "All Topics"}
Difficulty guidance: ${difficultyGuide}
Question style: ${subtypeGuide}

Rules:
- Questions must be answerable only from the excerpts.
- Provide expectedAnswer, keyPoints (3-6 items), explanation, topic, difficulty, subtype, estimatedAnswerLength, pageNumber, pageReferences, and section when known.
- Avoid duplicates and avoid repeating these existing questions:\n${existing || "None"}

Return JSON only:
{"questions":[{"id":"dq1","question":"...","expectedAnswer":"...","keyPoints":["..."],"explanation":"...","pageNumber":1,"pageReferences":[1],"section":"...","topic":"...","difficulty":"easy|medium|hard","subtype":"shortAnswer|longAnswer|conceptual|analytical","estimatedAnswerLength":"Short|Detailed"}]}`;

    try {
      const result = await geminiJSONWithRetry(systemPrompt, `Document excerpts:\n\n${context.slice(0, QUESTION_CONTEXT_BUDGET)}`, { temperature: 0.3 });
      const batch = Array.isArray(result?.questions) ? result.questions : [];
      console.log(`[documentIntelligence] Descriptive attempt ${attempts}: rawQuestions=${batch.length} collected=${collected.length}`);
      for (const raw of batch) {
        const q = validateDescriptiveQuestion(raw, collected.length, { topic, difficulty, questionSubtype, pageCount });
        if (!q) {
          invalidCount += 1;
          continue;
        }
        const key = normalizeKey(q.question);
        if (seenQuestions.has(key)) {
          duplicateCount += 1;
          continue;
        }
        seenQuestions.add(key);
        collected.push(q);
        if (collected.length >= requested) break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[documentIntelligence] Descriptive generation attempt ${attempts} failed:`, err.message);
    }
  }

  const questions = dedupeQuestions(collected).slice(0, requested);
  let warning = "";
  if (!questions.length && lastError) {
    warning = `AI question generation failed: ${lastError.message}`;
  } else if (questions.length < requested) {
    warning = `Only ${questions.length} of ${requested} valid descriptive questions could be generated from the available content. Try a lower count or a broader topic.`;
  }

  console.log(
    `[documentIntelligence] Descriptive generation done requested=${requested} generated=${questions.length} invalid=${invalidCount} duplicates=${duplicateCount} error=${lastError?.message || "none"}`
  );

  return {
    questions,
    requested,
    generated: questions.length,
    warning,
    error: lastError?.message || "",
  };
}

async function analyzeDocument(documentTitle, pages = [], rawText = "") {
  const sourcePages = pages.length ? pages : pagesFromRawText(rawText);
  const chunks = chunkForLLM(sourcePages, 2200);
  const pageCount = sourcePages.length || 1;

  const analysisSchema = `{
  "overview": "Comprehensive high-level description",
  "executiveSummary": "Concise executive overview",
  "keyPoints": ["..."],
  "importantFacts": ["..."],
  "definitions": [{"term":"...","definition":"...","pageNumber":1}],
  "importantConcepts": ["..."],
  "keywords": ["..."],
  "topics": [{"name":"...","explanation":"...","subtopics":["..."],"relatedKeywords":["..."],"importanceScore":0-100,"pageNumber":1,"pageReferences":[1],"section":"..."}]
}`;

  try {
    if (chunks.length <= 2) {
      const context = chunks.map((c) => c.text).join("\n\n").slice(0, ANALYSIS_CONTEXT_BUDGET);
      const result = await geminiJSONWithRetry(
        `You are DocuMind's senior document intelligence engine. Analyze the complete document "${documentTitle}". Return JSON only matching this schema: ${analysisSchema}`,
        `Document title: ${documentTitle}\nPages: ${pageCount}\n\n${context}`,
        { temperature: 0.15 }
      );
      return normalizeAnalysis(result, pageCount);
    }

    // Hierarchical analysis: extract candidates per chunk, then synthesize.
    const candidateBatches = [];
    const maxChunks = Math.min(chunks.length, 10);
    for (let i = 0; i < maxChunks; i++) {
      const chunk = chunks[i];
      try {
        const local = await geminiJSONWithRetry(
          `Extract document intelligence from this excerpt of "${documentTitle}" (Pages ${chunk.startPage}-${chunk.endPage}). Return JSON only with keys: keywords, topics, definitions, keyPoints, importantFacts. Topics must include name, explanation, subtopics, relatedKeywords, importanceScore, pageNumber, pageReferences, section.`,
          chunk.text.slice(0, 12000),
          { temperature: 0.15 }
        );
        candidateBatches.push(local);
      } catch (err) {
        console.warn(`[documentIntelligence] chunk analysis failed for pages ${chunk.startPage}-${chunk.endPage}:`, err.message);
      }
    }

    const merged = mergeAnalysisCandidates(candidateBatches, pageCount);
    try {
      const synthesis = await geminiJSONWithRetry(
        `You are DocuMind's senior document intelligence engine. Synthesize the candidate analysis for "${documentTitle}" into a final ranked topic hierarchy and document analysis. Return JSON only matching this schema: ${analysisSchema}`,
        `Document title: ${documentTitle}\nPages: ${pageCount}\n\nCandidate analysis:\n${JSON.stringify(merged).slice(0, ANALYSIS_CONTEXT_BUDGET)}`,
        { temperature: 0.15 }
      );
      return normalizeAnalysis(synthesis, pageCount, merged);
    } catch {
      return merged;
    }
  } catch (err) {
    console.warn("[documentIntelligence] analyzeDocument failed:", err.message);
    return fallbackAnalysis(documentTitle, sourcePages, rawText, pageCount);
  }
}

function mergeAnalysisCandidates(batches = [], pageCount = 1) {
  const topicMap = new Map();
  const keywords = new Set();
  const definitions = [];
  const keyPoints = [];
  const importantFacts = [];
  const importantConcepts = new Set();

  for (const batch of batches) {
    uniqueStrings(batch.keywords || []).forEach((k) => keywords.add(k));
    uniqueStrings(batch.importantConcepts || []).forEach((k) => importantConcepts.add(k));
    uniqueStrings(batch.keyPoints || []).forEach((k) => keyPoints.push(k));
    uniqueStrings(batch.importantFacts || []).forEach((k) => importantFacts.push(k));
    for (const d of batch.definitions || []) {
      if (d?.term && d?.definition) definitions.push({ term: d.term, definition: d.definition, pageNumber: clampPage(d.pageNumber, pageCount) });
    }
    for (const t of batch.topics || []) {
      const name = String(t?.name || "").trim();
      if (!name) continue;
      const key = normalizeKey(name);
      const existing = topicMap.get(key) || {
        name,
        explanation: "",
        subtopics: new Set(),
        relatedKeywords: new Set(),
        importanceScore: 0,
        pageNumber: clampPage(t.pageNumber, pageCount),
        pageReferences: new Set(),
        section: String(t.section || ""),
      };
      if (!existing.explanation && t.explanation) existing.explanation = String(t.explanation);
      (t.subtopics || []).forEach((s) => existing.subtopics.add(String(s)));
      (t.relatedKeywords || []).forEach((k) => existing.relatedKeywords.add(String(k)));
      existing.importanceScore = Math.max(existing.importanceScore, parseInt(t.importanceScore, 10) || 0);
      if (t.pageNumber) existing.pageReferences.add(clampPage(t.pageNumber, pageCount));
      (t.pageReferences || []).forEach((p) => existing.pageReferences.add(clampPage(p, pageCount)));
      if (!existing.section && t.section) existing.section = String(t.section);
      topicMap.set(key, existing);
    }
  }

  const topics = Array.from(topicMap.values())
    .map((t) => ({
      name: t.name,
      explanation: t.explanation,
      subtopics: Array.from(t.subtopics).slice(0, 8),
      relatedKeywords: Array.from(t.relatedKeywords).slice(0, 10),
      importanceScore: Math.min(100, t.importanceScore || 50),
      pageNumber: t.pageNumber,
      pageReferences: Array.from(t.pageReferences).slice(0, 12),
      section: t.section,
    }))
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .slice(0, 12);

  return {
    overview: `Analysis of "${documentTitle}" covering ${pageCount} pages.`,
    executiveSummary: `This document discusses ${topics.slice(0, 4).map((t) => t.name).join(", ") || "its main subject"}.`,
    keyPoints: uniqueStrings(keyPoints).slice(0, 8),
    importantFacts: uniqueStrings(importantFacts).slice(0, 8),
    definitions: definitions.slice(0, 12),
    importantConcepts: Array.from(importantConcepts).slice(0, 10),
    keywords: Array.from(keywords).slice(0, 20),
    topics,
  };
}

function normalizeAnalysis(result = {}, pageCount = 1, fallback = null) {
  const base = fallback || {};
  const topics = (Array.isArray(result.topics) && result.topics.length ? result.topics : base.topics || [])
    .map((t) => ({
      name: String(t?.name || "").trim(),
      explanation: String(t?.explanation || "").trim(),
      subtopics: uniqueStrings(t?.subtopics || []),
      relatedKeywords: uniqueStrings(t?.relatedKeywords || []),
      importanceScore: Math.max(0, Math.min(100, parseInt(t?.importanceScore, 10) || 50)),
      pageNumber: clampPage(t?.pageNumber, pageCount),
      pageReferences: Array.isArray(t?.pageReferences) ? t.pageReferences.map((p) => clampPage(p, pageCount)) : [],
      section: String(t?.section || "").trim(),
    }))
    .filter((t) => t.name)
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .slice(0, 12);

  return {
    overview: String(result.overview || base.overview || "").trim(),
    executiveSummary: String(result.executiveSummary || base.executiveSummary || "").trim(),
    keyPoints: uniqueStrings(result.keyPoints || base.keyPoints || []).slice(0, 10),
    importantFacts: uniqueStrings(result.importantFacts || base.importantFacts || []).slice(0, 10),
    definitions: (result.definitions || base.definitions || []).slice(0, 15).map((d) => ({
      term: String(d?.term || "").trim(),
      definition: String(d?.definition || "").trim(),
      pageNumber: clampPage(d?.pageNumber, pageCount),
    })).filter((d) => d.term && d.definition),
    importantConcepts: uniqueStrings(result.importantConcepts || base.importantConcepts || []).slice(0, 12),
    keywords: uniqueStrings(result.keywords || base.keywords || []).slice(0, 24),
    topics,
  };
}

function fallbackAnalysis(documentTitle, pages = [], rawText = "", pageCount = 1) {
  const text = rawText || pages.map((p) => p.text).join(" ");
  const words = text.split(/\s+/).filter(Boolean);
  const freq = new Map();
  for (const word of words) {
    const clean = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (clean.length < 5 || STOP_WORDS.has(clean)) continue;
    freq.set(clean, (freq.get(clean) || 0) + 1);
  }
  const keywords = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
  const topics = keywords.slice(0, 6).map((kw, i) => ({
    name: kw.replace(/\b\w/g, (c) => c.toUpperCase()),
    explanation: `Frequently discussed concept in ${documentTitle}.`,
    subtopics: keywords.slice(i + 1, i + 4),
    relatedKeywords: keywords.slice(0, 5),
    importanceScore: Math.max(40, 90 - i * 8),
    pageNumber: 1,
    pageReferences: [1],
    section: "Overview",
  }));
  return {
    overview: `Analysis of "${documentTitle}" containing ${pageCount} pages and ${words.length} words.`,
    executiveSummary: `This document covers ${keywords.slice(0, 4).join(", ") || "its main subject"}.`,
    keyPoints: [`Document contains ${pageCount} pages and ${words.length} words.`, `Core vocabulary: ${keywords.slice(0, 5).join(", ")}.`],
    importantFacts: [`Total pages: ${pageCount}`, `Word count: ${words.length}`],
    definitions: keywords.slice(0, 5).map((kw) => ({ term: kw, definition: `Key concept referenced in ${documentTitle}.`, pageNumber: 1 })),
    importantConcepts: keywords.slice(0, 8),
    keywords,
    topics,
  };
}

async function generateSummaries(documentTitle, pages = [], rawText = "") {
  const sourcePages = pages.length ? pages : pagesFromRawText(rawText);
  const chunks = chunkForLLM(sourcePages, 2000);
  const pageCount = sourcePages.length || 1;

  const summarySchema = `{
  "documentOverview": "...",
  "mainObjective": "...",
  "importantConcepts": ["..."],
  "keyPoints": ["..."],
  "sectionWiseSummary": "Markdown section-by-section breakdown",
  "importantDefinitions": [{"term":"...","definition":"...","pageNumber":1}],
  "keyFindings": ["..."],
  "finalTakeaways": ["..."],
  "shortSummary": "2-3 concise sentences",
  "detailedSummary": "Comprehensive structured narrative"
}`;

  try {
    let sectionSummaries = [];
    // Map phase: summarize chunks, batching when necessary.
    const maxChunks = Math.min(chunks.length, 12);
    for (let i = 0; i < maxChunks; i += 3) {
      const batch = chunks.slice(i, i + 3);
      const batchText = batch.map((c) => `[Pages ${c.startPage}-${c.endPage}]\n${c.text.slice(0, 6000)}`).join("\n\n");
      try {
        const summary = await geminiChat(
          `Summarize these sections of "${documentTitle}" in 4-6 precise sentences. Preserve page ranges and key facts.`,
          batchText,
          { maxTokens: 500, temperature: 0.25 }
        );
        sectionSummaries.push({
          title: `Pages ${batch[0].startPage}–${batch[batch.length - 1].endPage}`,
          summary: summary.trim(),
          pageNumber: batch[0].startPage,
        });
      } catch {
        sectionSummaries.push({
          title: `Pages ${batch[0].startPage}–${batch[batch.length - 1].endPage}`,
          summary: `Covers material on pages ${batch[0].startPage} through ${batch[batch.length - 1].endPage}.`,
          pageNumber: batch[0].startPage,
        });
      }
    }

    const reduceContext = sectionSummaries.map((s) => `### ${s.title}\n${s.summary}`).join("\n\n");
    const result = await geminiJSONWithRetry(
      `You are DocuMind's senior summarization engine. Create a comprehensive structured summary for "${documentTitle}" from the section summaries. Return JSON only matching this schema: ${summarySchema}`,
      `Document title: ${documentTitle}\nPages: ${pageCount}\n\nSection summaries:\n${reduceContext}`,
      { temperature: 0.2 }
    );
    return normalizeSummaries(result, sectionSummaries, pageCount);
  } catch (err) {
    console.warn("[documentIntelligence] generateSummaries failed:", err.message);
    const firstLines = (rawText || pages.map((p) => p.text).join(" ")).slice(0, 800).trim();
    return {
      documentOverview: `A comprehensive study of ${documentTitle} comprising ${pageCount} pages.`,
      mainObjective: `To explain the core concepts and findings presented in ${documentTitle}.`,
      importantConcepts: [],
      keyPoints: [`Document spans ${pageCount} pages.`, `Extracted ${firstLines.split(/\s+/).length} leading words for context.`],
      sectionWiseSummary: chunks.map((c) => `### Pages ${c.startPage}-${c.endPage}\nCovers material on pages ${c.startPage} through ${c.endPage}.`).join("\n\n"),
      importantDefinitions: [],
      keyFindings: [`Total pages analyzed: ${pageCount}`],
      finalTakeaways: [`Grounded in document: ${documentTitle}.`, `Ready for AI questions and quizzes.`],
      shortSummary: `A comprehensive study of ${documentTitle} comprising ${pageCount} pages.`,
      detailedSummary: `## Document Overview: ${documentTitle}\n\nThis document spans ${pageCount} pages.\n\n${firstLines}`,
      chapterSummaries: chunks.slice(0, 8).map((c) => ({ title: `Pages ${c.startPage}-${c.endPage}`, summary: `Covers material on pages ${c.startPage} through ${c.endPage}.`, pageNumber: c.startPage })),
      keyTakeaways: [`Covers ${pageCount} pages of material.`, `Grounded in document: ${documentTitle}.`],
    };
  }
}

function normalizeSummaries(result = {}, chapterSummaries = [], pageCount = 1) {
  const keyTakeaways = uniqueStrings(result.finalTakeaways || result.keyTakeaways || []).slice(0, 8);
  return {
    documentOverview: String(result.documentOverview || result.overview || "").trim(),
    mainObjective: String(result.mainObjective || result.executiveSummary || "").trim(),
    importantConcepts: uniqueStrings(result.importantConcepts || []).slice(0, 12),
    keyPoints: uniqueStrings(result.keyPoints || []).slice(0, 10),
    sectionWiseSummary: String(result.sectionWiseSummary || "").trim(),
    importantDefinitions: (result.importantDefinitions || result.definitions || []).slice(0, 15).map((d) => ({
      term: String(d?.term || "").trim(),
      definition: String(d?.definition || "").trim(),
      pageNumber: clampPage(d?.pageNumber, pageCount),
    })).filter((d) => d.term && d.definition),
    keyFindings: uniqueStrings(result.keyFindings || []).slice(0, 10),
    finalTakeaways: keyTakeaways,
    shortSummary: String(result.shortSummary || "").trim(),
    detailedSummary: String(result.detailedSummary || "").trim(),
    chapterSummaries: chapterSummaries.map((c) => ({
      title: String(c.title || `Pages ${c.pageNumber || 1}`),
      summary: String(c.summary || ""),
      pageNumber: clampPage(c.pageNumber, pageCount),
    })),
    keyTakeaways,
  };
}

async function evaluateDescriptiveAnswer({ question, expectedAnswer = "", keyPoints = [], userAnswer = "", contextText = "", pageNumber = 1 }) {
  if (!userAnswer || !userAnswer.trim()) {
    return {
      score: 0,
      accuracy: 0,
      feedback: "No answer provided.",
      coveredPoints: [],
      missingKeyPoints: keyPoints,
      incorrectStatements: [],
      suggestions: "Please write an answer addressing the key concepts.",
      pageReferences: [pageNumber],
      suggestedImprovements: "Please write an answer addressing the key concepts.",
    };
  }

  const systemPrompt = `You are DocuMind's senior academic evaluator. Evaluate the student's answer semantically against the expected answer, key points, and document context. Do not use simple keyword matching.
Return JSON only:
{"score":0-100,"accuracy":0-100,"feedback":"2-3 sentence critique","coveredPoints":["..."],"missingKeyPoints":["..."],"incorrectStatements":["..."],"suggestions":"specific improvement advice","pageReferences":[1]}`;

  const userMessage = `Question: ${question}\nExpected Answer: ${expectedAnswer}\nKey Points: ${JSON.stringify(keyPoints)}\nPage Reference: ${pageNumber}\nDocument Context:\n${(contextText || "").slice(0, 6000)}\n\nStudent Answer:\n${userAnswer}`;

  try {
    const evaluation = await geminiJSONWithRetry(systemPrompt, userMessage, { temperature: 0.1 });
    const score = Math.max(0, Math.min(100, Math.round(evaluation.score || evaluation.accuracy || 0)));
    return {
      score,
      accuracy: Math.max(0, Math.min(100, Math.round(evaluation.accuracy || score))),
      feedback: String(evaluation.feedback || "Evaluated against document standards.").trim(),
      coveredPoints: uniqueStrings(evaluation.coveredPoints || []).slice(0, 10),
      missingKeyPoints: uniqueStrings(evaluation.missingKeyPoints || keyPoints).slice(0, 10),
      incorrectStatements: uniqueStrings(evaluation.incorrectStatements || []).slice(0, 8),
      suggestions: String(evaluation.suggestions || evaluation.suggestedImprovements || "").trim(),
      pageReferences: Array.isArray(evaluation.pageReferences) ? evaluation.pageReferences.map((p) => clampPage(p, 999)) : [pageNumber],
      suggestedImprovements: String(evaluation.suggestions || evaluation.suggestedImprovements || "").trim(),
    };
  } catch (err) {
    const userCleanText = userAnswer.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    const userWords = userCleanText.split(/\s+/).filter(Boolean);
    let matchedCount = 0;
    const missing = [];
    for (const kp of keyPoints) {
      const kpClean = kp.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
      const kpWords = kpClean.split(/\s+/).filter((w) => w.length > 2);
      const hasMatch = kpClean && (userCleanText.includes(kpClean) || kpWords.some((w) => userWords.includes(w)));
      if (hasMatch) matchedCount++;
      else missing.push(kp);
    }
    const ratio = keyPoints.length ? matchedCount / keyPoints.length : 0.7;
    const lengthBonus = Math.min(20, userWords.length * 0.8);
    const score = Math.round(Math.min(100, ratio * 80 + lengthBonus));
    return {
      score,
      accuracy: score,
      feedback: score >= 70 ? "Good conceptual understanding demonstrated." : "Partial answer. Review the missing key points to strengthen your response.",
      coveredPoints: keyPoints.filter((kp) => !missing.includes(kp)),
      missingKeyPoints: missing,
      incorrectStatements: [],
      suggestions: missing.length ? `Make sure to incorporate: ${missing.join(", ")}.` : "Great job covering the key concepts.",
      pageReferences: [pageNumber],
      suggestedImprovements: missing.length ? `Make sure to incorporate: ${missing.join(", ")}.` : "Great job covering the key concepts.",
    };
  }
}

module.exports = {
  chunkForLLM,
  analyzeDocument,
  generateSummaries,
  generateMCQs,
  generateDescriptiveQuestions,
  evaluateDescriptiveAnswer,
  selectQuestionContext,
  validateMcqQuestion,
  validateDescriptiveQuestion,
  MAX_QUESTIONS,
};
