const { createUserClient } = require("../config/db");

async function createWorkout(req, res) {
  const { date, name, sets } = req.body;

  if (!date || !Array.isArray(sets) || sets.length === 0) {
    return res
      .status(400)
      .json({ error: "date and a non-empty sets array are required" });
  }

  const supabase = createUserClient(req.token);

  const { data: workout, error: workoutError } = await supabase
    .from("workouts")
    .insert({ user_id: req.user.id, date, name })
    .select()
    .single();

  if (workoutError) {
    return res.status(400).json({ error: workoutError.message });
  }

  const setsToInsert = sets.map((set, index) => ({
    workout_id: workout.id,
    exercise_id: set.exercise_id,
    exercise_name: set.exercise_name,
    weight: set.weight,
    reps: set.reps,
    set_order: index + 1,
  }));

  const { data: workoutSets, error: setsError } = await supabase
    .from("workout_sets")
    .insert(setsToInsert)
    .select();

  if (setsError) {
    await supabase.from("workouts").delete().eq("id", workout.id);
    return res.status(400).json({ error: setsError.message });
  }

  return res.status(201).json({ ...workout, sets: workoutSets });
}

module.exports = { createWorkout };
