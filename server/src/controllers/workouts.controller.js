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

async function getWorkouts(req, res) {
  const supabase = createUserClient(req.token);

  const { data: workouts, error } = await supabase
    .from("workouts")
    .select("*, sets:workout_sets(*)")
    .eq("user_id", req.user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json(workouts);
}

async function getWorkoutById(req, res) {
  const supabase = createUserClient(req.token);

  const { data: workout, error } = await supabase
    .from("workouts")
    .select("*, sets:workout_sets(*)")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .maybeSingle();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!workout) {
    return res.status(404).json({ error: "Workout not found" });
  }

  return res.status(200).json(workout);
}

async function updateWorkout(req, res) {
  const { date, name, sets } = req.body;
  const supabase = createUserClient(req.token);

  const updateFields = {};
  if (date !== undefined) updateFields.date = date;
  if (name !== undefined) updateFields.name = name;

  let workout;

  if (Object.keys(updateFields).length > 0) {
    const { data, error } = await supabase
      .from("workouts")
      .update(updateFields)
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }
    workout = data;
  } else {
    const { data, error } = await supabase
      .from("workouts")
      .select()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }
    workout = data;
  }

  if (!workout) {
    return res.status(404).json({ error: "Workout not found" });
  }

  let workoutSets;

  if (Array.isArray(sets)) {
    const { error: deleteError } = await supabase
      .from("workout_sets")
      .delete()
      .eq("workout_id", workout.id);

    if (deleteError) {
      return res.status(400).json({ error: deleteError.message });
    }

    if (sets.length > 0) {
      const setsToInsert = sets.map((set, index) => ({
        workout_id: workout.id,
        exercise_id: set.exercise_id,
        exercise_name: set.exercise_name,
        weight: set.weight,
        reps: set.reps,
        set_order: index + 1,
      }));

      const { data, error } = await supabase
        .from("workout_sets")
        .insert(setsToInsert)
        .select();

      if (error) {
        return res.status(400).json({ error: error.message });
      }
      workoutSets = data;
    } else {
      workoutSets = [];
    }
  } else {
    const { data, error } = await supabase
      .from("workout_sets")
      .select()
      .eq("workout_id", workout.id)
      .order("set_order");

    if (error) {
      return res.status(400).json({ error: error.message });
    }
    workoutSets = data;
  }

  return res.status(200).json({ ...workout, sets: workoutSets });
}

module.exports = {
  createWorkout,
  getWorkouts,
  getWorkoutById,
  updateWorkout,
};
