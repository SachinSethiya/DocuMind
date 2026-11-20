const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const { getUserAnalytics } = require("../controllers/analyticsController");

router.use(protect);

router.get("/", getUserAnalytics);
router.get("/overview", getUserAnalytics);
router.get("/student", getUserAnalytics);

module.exports = router;
