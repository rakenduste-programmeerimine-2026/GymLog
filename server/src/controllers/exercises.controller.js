const { createUserClient } = require("../config/db");

async function getExercises(req, res) {
  const supabase = createUserClient(req.token);

  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("*")
    .or(`user_id.is.null,user_id.eq.${req.user.id}`)
    .order("name", { ascending: true });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json(exercises);
}

async function createExercise(req, res) {
  const { name, category } = req.body;

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const supabase = createUserClient(req.token);

  const { data: exercise, error } = await supabase
    .from("exercises")
    .insert({ name, category, user_id: req.user.id })
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json(exercise);
}

module.exports = { getExercises, createExercise };
