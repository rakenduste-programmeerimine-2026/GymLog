const express = require("express");
const cors = require("cors");

const workoutsRoutes = require("./routes/workouts.routes");
const exercisesRoutes = require("./routes/exercises.routes");
const statsRoutes = require("./routes/stats.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "gymlog-server" });
});

app.use("/workouts", workoutsRoutes);
app.use("/exercises", exercisesRoutes);
app.use("/stats", statsRoutes);

module.exports = app;
