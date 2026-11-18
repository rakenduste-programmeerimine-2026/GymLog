const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const { createWorkout } = require("../controllers/workouts.controller");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createWorkout);

module.exports = router;
