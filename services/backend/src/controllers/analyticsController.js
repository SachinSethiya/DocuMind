const QuizAttempt = require("../models/QuizAttempt");
const Document = require("../models/Document");
const User = require("../models/User");

/**
 * Core Feature 13: User Performance Analytics (100% User-Isolated)
 * Returns document and learning intelligence metrics calculated from actual attempts.
 */
exports.getUserAnalytics = async (req, res) => {
  const userId = req.user._id;

  // 1. Fetch user's total documents count
  const totalDocuments = await Document.countDocuments({ userId });
  const completedDocuments = await Document.countDocuments({
    userId,
    status: { $in: ["completed", "ready"] },
  });

  // 2. Fetch all quiz attempts by this user
  const attempts = await QuizAttempt.find({ student: userId })
    .populate("document", "title")
    .sort({ createdAt: 1 })
    .lean();

  const totalQuizzesAttempted = attempts.length;

  if (totalQuizzesAttempted === 0) {
    return res.json({
      totalDocuments,
      completedDocuments,
      totalQuizzesAttempted: 0,
      totalQuestionsAttempted: 0,
      totalCorrectAnswers: 0,
      totalIncorrectAnswers: 0,
      averageScore: 0,
      overallAccuracy: 0,
      difficultyBreakdown: {
        easy: { attempts: 0, avgScore: 0, accuracy: 0 },
        medium: { attempts: 0, avgScore: 0, accuracy: 0 },
        hard: { attempts: 0, avgScore: 0, accuracy: 0 },
      },
      topicBreakdown: [],
      weakTopics: [],
      strongTopics: [],
      recommendations: [
        "Upload a document and generate your first quiz to begin tracking performance.",
      ],
      scoreHistory: [],
      recentActivity: [],
    });
  }

  // 3. Aggregate totals
  let totalQuestionsAttempted = 0;
  let totalCorrectAnswers = 0;
  const allScores = [];

  const byDifficulty = {
    easy: { scores: [], correct: 0, total: 0 },
    medium: { scores: [], correct: 0, total: 0 },
    hard: { scores: [], correct: 0, total: 0 },
  };

  const byTopic = {};

  for (const a of attempts) {
    const score = a.score || 0;
    allScores.push(score);

    const questionsCount = a.total || a.answers?.length || 0;
    const correctCount = a.correct !== undefined ? a.correct : a.answers?.filter((ans) => ans.correct).length || 0;

    totalQuestionsAttempted += questionsCount;
    totalCorrectAnswers += correctCount;

    // Difficulty breakdown
    const diff = (a.difficulty || "medium").toLowerCase();
    const targetDiff = byDifficulty[diff] || byDifficulty.medium;
    targetDiff.scores.push(score);
    targetDiff.correct += correctCount;
    targetDiff.total += questionsCount;

    // Topic breakdown
    const topic = a.topic || "General";
    if (!byTopic[topic]) {
      byTopic[topic] = { topic, scores: [], correct: 0, total: 0, attempts: 0 };
    }
    byTopic[topic].scores.push(score);
    byTopic[topic].correct += correctCount;
    byTopic[topic].total += questionsCount;
    byTopic[topic].attempts += 1;
  }

  const averageScore = Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length);
  const overallAccuracy =
    totalQuestionsAttempted > 0
      ? Math.round((totalCorrectAnswers / totalQuestionsAttempted) * 100)
      : 0;
  const totalIncorrectAnswers = totalQuestionsAttempted - totalCorrectAnswers;

  // Process difficulty breakdown
  const difficultyBreakdown = {
    easy: {
      attempts: byDifficulty.easy.scores.length,
      avgScore: byDifficulty.easy.scores.length
        ? Math.round(byDifficulty.easy.scores.reduce((s, x) => s + x, 0) / byDifficulty.easy.scores.length)
        : 0,
      accuracy: byDifficulty.easy.total > 0
        ? Math.round((byDifficulty.easy.correct / byDifficulty.easy.total) * 100)
        : 0,
    },
    medium: {
      attempts: byDifficulty.medium.scores.length,
      avgScore: byDifficulty.medium.scores.length
        ? Math.round(byDifficulty.medium.scores.reduce((s, x) => s + x, 0) / byDifficulty.medium.scores.length)
        : 0,
      accuracy: byDifficulty.medium.total > 0
        ? Math.round((byDifficulty.medium.correct / byDifficulty.medium.total) * 100)
        : 0,
    },
    hard: {
      attempts: byDifficulty.hard.scores.length,
      avgScore: byDifficulty.hard.scores.length
        ? Math.round(byDifficulty.hard.scores.reduce((s, x) => s + x, 0) / byDifficulty.hard.scores.length)
        : 0,
      accuracy: byDifficulty.hard.total > 0
        ? Math.round((byDifficulty.hard.correct / byDifficulty.hard.total) * 100)
        : 0,
    },
  };

  // Process topics
  const topicBreakdown = Object.values(byTopic).map((t) => {
    const avgScore = Math.round(t.scores.reduce((s, x) => s + x, 0) / t.scores.length);
    const accuracy = t.total > 0 ? Math.round((t.correct / t.total) * 100) : avgScore;
    return {
      topic: t.topic,
      attempts: t.attempts,
      avgScore,
      accuracy,
      correct: t.correct,
      total: t.total,
      needsImprovement: accuracy < 70,
    };
  });

  topicBreakdown.sort((a, b) => a.accuracy - b.accuracy);

  const weakTopics = topicBreakdown.filter((t) => t.accuracy < 70).map((t) => t.topic);
  const strongTopics = topicBreakdown.filter((t) => t.accuracy >= 80).map((t) => t.topic);

  // Recommendations based on actual quiz attempts
  const recommendations = [];
  if (weakTopics.length > 0) {
    weakTopics.slice(0, 3).forEach((t) => {
      recommendations.push(`You need more practice with the topic: "${t}". Review document sections and attempt medium-difficulty quizzes.`);
    });
  }
  if (difficultyBreakdown.hard.attempts === 0 && averageScore >= 75) {
    recommendations.push("You're performing well on standard questions. Try challenging yourself with a Hard difficulty quiz!");
  }
  if (recommendations.length === 0) {
    recommendations.push("Excellent work! You have maintained a strong accuracy rate across all document topics.");
  }

  // Chronological score history for charts
  const scoreHistory = attempts.map((a, i) => ({
    attemptNumber: i + 1,
    date: a.createdAt,
    score: a.score,
    accuracy: a.accuracy !== undefined ? a.accuracy : a.score,
    title: a.document?.title || a.documentTitle || "Quiz",
    topic: a.topic || "General",
    difficulty: a.difficulty || "medium",
  }));

  // Recent activity (latest 5)
  const recentActivity = [...attempts]
    .reverse()
    .slice(0, 5)
    .map((a) => ({
      id: a._id.toString(),
      documentTitle: a.document?.title || a.documentTitle || "Document Quiz",
      score: a.score,
      accuracy: a.accuracy !== undefined ? a.accuracy : a.score,
      difficulty: a.difficulty || "medium",
      topic: a.topic || "General",
      completedAt: a.createdAt,
    }));

  res.json({
    totalDocuments,
    completedDocuments,
    totalQuizzesAttempted,
    totalQuestionsAttempted,
    totalCorrectAnswers,
    totalIncorrectAnswers,
    averageScore,
    overallAccuracy,
    difficultyBreakdown,
    topicBreakdown,
    weakTopics,
    strongTopics,
    recommendations,
    scoreHistory,
    recentActivity,
  });
};

// Backward compatibility alias for legacy route
exports.getStudentAnalytics = exports.getUserAnalytics;
