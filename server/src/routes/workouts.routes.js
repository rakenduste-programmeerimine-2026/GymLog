const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const {
  createWorkout,
  getWorkouts,
  getWorkoutById,
  updateWorkout,
  deleteWorkout,
} = require("../controllers/workouts.controller");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createWorkout);
router.get("/", getWorkouts);
router.get("/:id", getWorkoutById);
router.put("/:id", updateWorkout);
router.delete("/:id", deleteWorkout);

module.exports = router;
