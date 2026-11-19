const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");
const Document = require("../models/Document");
const User = require("../models/User");
const Lecture = require("../models/Lecture");
const {
  generateMCQs,
  generateDescriptiveQuestions,
  evaluateDescriptiveAnswer,
} = require("../services/documentAnalysisService");

// ─────────────────────────────────────────────────────────────────
// Core Feature 6 & 7 & 8: Generate DocuMind Quiz
// ─────────────────────────────────────────────────────────────────
exports.generateQuiz = async (req, res) => {
  const {
    documentId,
    lectureId, // legacy fallback
    text,
    topic = "All Topics",
    difficulty = "medium",
    questionType = "mcq",
    numQuestions = 5,
  } = req.body;

  let doc = null;
  let contextText = text || "";
  let docTitle = "Document Quiz";

  if (documentId) {
    doc = await Document.findOne({ _id: documentId, userId: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: "Document not found or access denied." });
    }
    docTitle = doc.title;
    contextText = doc.rawText || (doc.pages || []).map((p) => `[Page ${p.pageNumber}]\n${p.text}`).join("\n\n");
  } else if (lectureId) {
    const lecture = await Lecture.findById(lectureId);
    if (lecture) {
      docTitle = lecture.title;
      contextText = (lecture.transcript || []).map((s) => s.text).join(" ");
    }
  }

  if (!contextText.trim()) {
    return res.status(400).json({ message: "No document text available to generate questions from." });
  }

  const count = Math.max(1, Math.min(20, parseInt(numQuestions, 10) || 5));
  let questions = [];

  if (questionType === "mcq") {
    questions = await generateMCQs({
      documentTitle: docTitle,
      contextText,
      topic,
      difficulty,
      count,
    });
  } else if (questionType === "descriptive") {
    questions = await generateDescriptiveQuestions({
      documentTitle: docTitle,
      contextText,
      topic,
      difficulty,
      count,
    });
  } else {
    // Mixed: half MCQs, half Descriptive
    const mcqCount = Math.ceil(count / 2);
    const descCount = Math.floor(count / 2);
    const mcqs = await generateMCQs({
      documentTitle: docTitle,
      contextText,
      topic,
      difficulty,
      count: mcqCount,
    });
    const descs = await generateDescriptiveQuestions({
      documentTitle: docTitle,
      contextText,
      topic,
      difficulty,
      count: descCount,
    });
    questions = [...mcqs, ...descs];
  }

  // Persist Quiz record in MongoDB if documentId is provided
  let createdQuiz = null;
  if (doc) {
    createdQuiz = await Quiz.create({
      userId: req.user._id,
      documentId: doc._id,
      documentTitle: doc.title,
      title: `${difficulty.toUpperCase()} Quiz: ${doc.title} (${topic})`,
      topic,
      difficulty,
      questionType,
      questions,
    });
  }

  res.status(201).json({
    success: true,
    quiz: createdQuiz || {
      id: "temp",
      title: `${difficulty.toUpperCase()} Quiz: ${docTitle}`,
      questions,
    },
  });
};

// ─────────────────────────────────────────────────────────────────
// GET /api/quizzes
// List quizzes for authenticated user
// ─────────────────────────────────────────────────────────────────
exports.getAllQuizzes = async (req, res) => {
  const query = { userId: req.user._id };
  if (req.query.documentId) {
    query.documentId = req.query.documentId;
  }

  const quizzes = await Quiz.find(query).sort({ createdAt: -1 });
  res.json({ quizzes });
};

// ─────────────────────────────────────────────────────────────────
// GET /api/quizzes/:id
// Get single quiz
// ─────────────────────────────────────────────────────────────────
exports.getQuizById = async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.id, userId: req.user._id });
  if (!quiz) {
    return res.status(404).json({ message: "Quiz not found or access denied." });
  }
  res.json({ quiz });
};

// ─────────────────────────────────────────────────────────────────
// POST /api/quizzes/:id/attempt or POST /api/quizzes/attempt
// Submit quiz answers, perform AI scoring & evaluation
// ─────────────────────────────────────────────────────────────────
exports.attemptQuiz = async (req, res) => {
  const quizId = req.params.id || req.body.quizId;
  const { answers = [], timeSpent = 0 } = req.body;

  if (!Array.isArray(answers)) {
    return res.status(400).json({ message: "Answers must be an array." });
  }

  // Check if it is a DocuMind Quiz
  const quiz = await Quiz.findOne({ _id: quizId, userId: req.user._id });

  if (quiz) {
    let totalScoreSum = 0;
    let correctCount = 0;
    const evaluatedAnswers = [];

    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i];
      const userAns = answers[i] !== undefined ? answers[i] : null;

      if (q.type === "mcq") {
        const selectedIdx = typeof userAns === "number" ? userAns : typeof userAns === "object" ? userAns?.selectedOption : -1;
        const isCorrect = selectedIdx === q.correctAnswer;
        if (isCorrect) {
          correctCount++;
          totalScoreSum += 100;
        }

        evaluatedAnswers.push({
          questionIndex: i,
          question: q.question,
          type: "mcq",
          selected: q.options[selectedIdx] || "No answer",
          selectedOption: selectedIdx,
          correct: isCorrect,
          score: isCorrect ? 100 : 0,
          explanation: q.explanation,
          pageNumber: q.pageNumber,
          topic: q.topic,
          difficulty: q.difficulty,
        });
      } else {
        // Descriptive question evaluation
        const textAnswer = typeof userAns === "string" ? userAns : userAns?.userTextAnswer || "";
        const evalResult = await evaluateDescriptiveAnswer({
          question: q.question,
          expectedAnswer: q.expectedAnswer,
          keyPoints: q.keyPoints,
          userAnswer: textAnswer,
        });

        const isPassing = evalResult.score >= 60;
        if (isPassing) correctCount++;
        totalScoreSum += evalResult.score;

        evaluatedAnswers.push({
          questionIndex: i,
          question: q.question,
          type: "descriptive",
          userAnswer: textAnswer,
          correct: isPassing,
          score: evalResult.score,
          feedback: evalResult.feedback,
          missingKeyPoints: evalResult.missingKeyPoints,
          suggestedImprovements: evalResult.suggestedImprovements,
          explanation: q.explanation || q.expectedAnswer,
          pageNumber: q.pageNumber,
          topic: q.topic,
          difficulty: q.difficulty,
        });
      }
    }

    const totalQuestions = quiz.questions.length;
    const averageScore = totalQuestions > 0 ? Math.round(totalScoreSum / totalQuestions) : 0;
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const attempt = await QuizAttempt.create({
      student: req.user._id,
      quiz: quiz._id,
      document: quiz.documentId,
      documentTitle: quiz.documentTitle,
      topic: quiz.topic,
      difficulty: quiz.difficulty,
      score: averageScore,
      total: totalQuestions,
      correct: correctCount,
      accuracy,
      timeSpent,
      answers: evaluatedAnswers,
    });

    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        scores: averageScore,
        quizAttempts: {
          quizId: quiz._id.toString(),
          score: averageScore,
          completedAt: attempt.createdAt,
        },
      },
    });

    return res.json({
      success: true,
      message: "Quiz evaluated successfully.",
      score: averageScore,
      accuracy,
      correct: correctCount,
      total: totalQuestions,
      attempt,
    });
  }

  // Legacy lecture quiz fallback
  const lecture = await Lecture.findById(quizId);
  if (!lecture) {
    return res.status(404).json({ message: "Quiz not found" });
  }

  const questions = buildQuestionsFromLecture(lecture);
  let correct = 0;
  const detailedAnswers = questions.map((question, index) => {
    const isCorrect = answers[index] === question.correctAnswer;
    if (isCorrect) correct += 1;
    return {
      questionIndex: index,
      question: question.question,
      selected: question.options[answers[index]] || "N/A",
      correct: isCorrect,
    };
  });

  const total = questions.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  const attempt = await QuizAttempt.create({
    lecture: quizId,
    student: req.user._id,
    score,
    total,
    correct,
    accuracy: score,
    answers: detailedAnswers,
  });

  res.json({
    success: true,
    message: "Quiz submitted successfully",
    score,
    correct,
    total,
    attempt: {
      id: attempt._id.toString(),
      quizId,
      score,
      completedAt: attempt.createdAt,
    },
  });
};

// ─────────────────────────────────────────────────────────────────
// POST /api/quizzes/evaluate-answer
// Evaluate a single descriptive answer in real time
// ─────────────────────────────────────────────────────────────────
exports.evaluateAnswer = async (req, res) => {
  const { question, expectedAnswer, keyPoints = [], userAnswer } = req.body;
  if (!question || !userAnswer) {
    return res.status(400).json({ message: "`question` and `userAnswer` are required." });
  }

  const evaluation = await evaluateDescriptiveAnswer({
    question,
    expectedAnswer: expectedAnswer || "",
    keyPoints,
    userAnswer,
  });

  res.json(evaluation);
};

// ─────────────────────────────────────────────────────────────────
// GET /api/quizzes/history
// List quiz attempts for authenticated user
// ─────────────────────────────────────────────────────────────────
exports.getQuizHistory = async (req, res) => {
  const query = { student: req.user._id };
  if (req.query.documentId) {
    query.document = req.query.documentId;
  }

  const attempts = await QuizAttempt.find(query)
    .populate("document", "title fileName")
    .sort({ createdAt: -1 });

  res.json({ attempts });
};

// ─────────────────────────────────────────────────────────────────
// Backward compatibility functions for legacy tests
// ─────────────────────────────────────────────────────────────────
function parseQuizLines(lines = []) {
  const normalizedLines = lines
    .map((line) => line.trim())
    .filter((line) => line && line !== "---");
  const questions = [];
  const optionPatterns = [/^[Aa][.)]\s+/, /^[Bb][.)]\s+/, /^[Cc][.)]\s+/, /^[Dd][.)]\s+/];
  const answerMatchPattern = /^(?:Answer|Correct)[:\s]*([A-Da-d])$/;

  for (let index = 0; index < normalizedLines.length; ) {
    const hasMcqShape =
      index + 4 < normalizedLines.length &&
      optionPatterns.every((pattern, offset) => pattern.test(normalizedLines[index + offset + 1]));

    if (!hasMcqShape) {
      questions.push({
        id: `q-${questions.length}`,
        question: normalizedLines[index],
        options: ["True", "False", "Not mentioned", "Cannot determine"],
        correctAnswer: 0,
      });
      index += 1;
      continue;
    }

    const options = optionPatterns.map((pattern, offset) =>
      normalizedLines[index + offset + 1].replace(pattern, "").trim()
    );
    const answerLine = normalizedLines[index + 5] || "";
    const answerMatch = answerLine.match(answerMatchPattern);
    const answerMap = { a: 0, b: 1, c: 2, d: 3 };

    questions.push({
      id: `q-${questions.length}`,
      question: normalizedLines[index].replace(/^(?:Q?\d+[.)]\s*)/, "").trim(),
      options,
      correctAnswer: answerMatch ? answerMap[answerMatch[1].toLowerCase()] ?? 0 : 0,
    });

    index += answerMatch ? 6 : 5;
  }

  return questions;
}

function buildQuestionsFromLecture(lecture) {
  if (lecture?.quizStructured?.length) {
    return lecture.quizStructured.map((question, index) => ({
      id: `q-${index}`,
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
    }));
  }

  const quizLines = lecture?.quiz?.merged?.length
    ? lecture.quiz.merged
    : lecture?.quiz?.ai?.length
      ? lecture.quiz.ai
      : lecture?.quiz?.local || [];

  return parseQuizLines(quizLines);
}

function lectureToQuizPayload(lecture) {
  const questions = buildQuestionsFromLecture(lecture);
  if (!questions?.length) {
    return null;
  }
  return {
    id: lecture._id.toString(),
    lectureId: lecture._id.toString(),
    title: `Quiz: ${lecture.title}`,
    questions,
  };
}

exports.getQuizByLecture = async (req, res) => {
  const lecture = await Lecture.findById(req.params.lectureId);
  if (!lecture) return res.status(404).json({ message: "Lecture not found" });
  const quiz = lectureToQuizPayload(lecture);
  res.json({ quizzes: quiz ? [quiz] : [] });
};

module.exports = {
  ...module.exports,
  parseQuizLines,
  buildQuestionsFromLecture,
  lectureToQuizPayload,
};
