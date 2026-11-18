const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const { createWorkout, getWorkouts } = require("../controllers/workouts.controller");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createWorkout);
router.get("/", getWorkouts);

module.exports = router;
