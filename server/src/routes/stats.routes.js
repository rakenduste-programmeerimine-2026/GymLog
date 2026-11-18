const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const { getCalendarStats } = require("../controllers/stats.controller");

const router = express.Router();

router.use(authMiddleware);

router.get("/calendar", getCalendarStats);

module.exports = router;
