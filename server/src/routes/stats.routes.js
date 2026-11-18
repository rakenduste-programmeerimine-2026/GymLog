const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const asyncHandler = require("../middleware/asyncHandler");
const {
  getCalendarStats,
  getDetailStats,
} = require("../controllers/stats.controller");

const router = express.Router();

router.use(asyncHandler(authMiddleware));

router.get("/calendar", asyncHandler(getCalendarStats));
router.get("/detail/:workoutId", asyncHandler(getDetailStats));

module.exports = router;
