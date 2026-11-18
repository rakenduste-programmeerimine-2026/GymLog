const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const asyncHandler = require("../middleware/asyncHandler");
const {
  getExercises,
  createExercise,
} = require("../controllers/exercises.controller");

const router = express.Router();

router.use(asyncHandler(authMiddleware));

router.get("/", asyncHandler(getExercises));
router.post("/", asyncHandler(createExercise));

module.exports = router;
