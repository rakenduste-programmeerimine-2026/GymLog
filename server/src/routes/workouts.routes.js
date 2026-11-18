const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const asyncHandler = require("../middleware/asyncHandler");
const {
  createWorkout,
  getWorkouts,
  getWorkoutById,
  updateWorkout,
  deleteWorkout,
} = require("../controllers/workouts.controller");

const router = express.Router();

router.use(asyncHandler(authMiddleware));

router.post("/", asyncHandler(createWorkout));
router.get("/", asyncHandler(getWorkouts));
router.get("/:id", asyncHandler(getWorkoutById));
router.put("/:id", asyncHandler(updateWorkout));
router.delete("/:id", asyncHandler(deleteWorkout));

module.exports = router;
