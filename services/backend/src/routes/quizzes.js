const express = require("express");
const router = express.Router();
const {
  generateQuiz,
  attemptQuiz,
  getAllQuizzes,
  getQuizById,
  getQuizHistory,
  evaluateAnswer,
  getQuizByLecture,
} = require("../controllers/quizController");
const { protect } = require("../middlewares/auth");

router.use(protect);

router.get("/", getAllQuizzes);
router.get("/history", getQuizHistory);
router.get("/lecture/:lectureId", getQuizByLecture);
router.get("/:id", getQuizById);
router.post("/generate", generateQuiz);
router.post("/attempt", attemptQuiz);
router.post("/:id/attempt", attemptQuiz);
router.post("/evaluate-answer", evaluateAnswer);

module.exports = router;
