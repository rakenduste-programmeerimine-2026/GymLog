const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const {
  getExercises,
  createExercise,
} = require("../controllers/exercises.controller");

const router = express.Router();

router.use(authMiddleware);

router.get("/", getExercises);
router.post("/", createExercise);

module.exports = router;
