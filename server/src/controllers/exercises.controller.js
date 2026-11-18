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

module.exports = { getExercises };
