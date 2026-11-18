const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const { getExercises } = require("../controllers/exercises.controller");

const router = express.Router();

router.use(authMiddleware);

router.get("/", getExercises);

module.exports = router;
