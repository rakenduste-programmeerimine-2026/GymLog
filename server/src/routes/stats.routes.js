const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const {
  getCalendarStats,
  getDetailStats,
} = require("../controllers/stats.controller");

const router = express.Router();

router.use(authMiddleware);

router.get("/calendar", getCalendarStats);
router.get("/detail/:workoutId", getDetailStats);

module.exports = router;
