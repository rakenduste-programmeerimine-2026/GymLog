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

module.exports = { getCalendarStats };
