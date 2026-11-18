const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const {
  createWorkout,
  getWorkouts,
  getWorkoutById,
} = require("../controllers/workouts.controller");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createWorkout);
router.get("/", getWorkouts);
router.get("/:id", getWorkoutById);

module.exports = router;
