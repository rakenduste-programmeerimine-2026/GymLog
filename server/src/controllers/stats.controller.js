const { createUserClient } = require("../config/db");

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function pad(n) {
  return String(n).padStart(2, "0");
}

async function getCalendarStats(req, res) {
  const { month } = req.query;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res
      .status(400)
      .json({ error: "month query param is required in YYYY-MM format" });
  }

  const [year, monthNum] = month.split("-").map(Number);
  const totalDays = daysInMonth(year, monthNum);

  const firstDate = `${month}-01`;
  const lastDate = `${month}-${pad(totalDays)}`;

  const supabase = createUserClient(req.token);

  const { data: workouts, error } = await supabase
    .from("workouts")
    .select("date")
    .eq("user_id", req.user.id)
    .gte("date", firstDate)
    .lte("date", lastDate);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const workoutDates = new Set(workouts.map((w) => w.date));

  const calendar = {};
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${month}-${pad(day)}`;
    calendar[dateStr] = workoutDates.has(dateStr);
  }

  return res.status(200).json(calendar);
}

function calculateVolume(sets) {
  return sets.reduce((sum, set) => sum + (set.weight || 0) * (set.reps || 0), 0);
}

async function getDetailStats(req, res) {
  const supabase = createUserClient(req.token);

  const { data: workout, error } = await supabase
    .from("workouts")
    .select("*, sets:workout_sets(*)")
    .eq("id", req.params.workoutId)
    .eq("user_id", req.user.id)
    .maybeSingle();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!workout) {
    return res.status(404).json({ error: "Workout not found" });
  }

  const totalVolume = calculateVolume(workout.sets);

  const exerciseNames = [...new Set(workout.sets.map((set) => set.exercise_name))];

  const exerciseTrends = {};

  for (const name of exerciseNames) {
    const { data: history, error: historyError } = await supabase
      .from("workout_sets")
      .select("weight, reps, workouts!inner(date, user_id)")
      .eq("exercise_name", name)
      .eq("workouts.user_id", req.user.id)
      .order("date", { foreignTable: "workouts", ascending: true });

    if (historyError) {
      return res.status(400).json({ error: historyError.message });
    }

    exerciseTrends[name] = history.map((row) => ({
      date: row.workouts.date,
      weight: row.weight,
      reps: row.reps,
    }));
  }

  let comparison = null;

  if (workout.name) {
    const { data: previous, error: previousError } = await supabase
      .from("workouts")
      .select("*, sets:workout_sets(*)")
      .eq("user_id", req.user.id)
      .eq("name", workout.name)
      .lt("date", workout.date)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousError) {
      return res.status(400).json({ error: previousError.message });
    }

    if (previous) {
      const previousVolume = calculateVolume(previous.sets);
      comparison = {
        previousWorkoutId: previous.id,
        previousDate: previous.date,
        previousVolume,
        volumeDifference: totalVolume - previousVolume,
      };
    }
  }

  return res.status(200).json({
    workoutId: workout.id,
    date: workout.date,
    name: workout.name,
    totalVolume,
    exerciseTrends,
    comparison,
  });
}

module.exports = { getCalendarStats, getDetailStats };
