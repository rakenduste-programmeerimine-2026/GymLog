const request = require("supertest");

jest.mock("../src/config/db", () => {
  const mock = { auth: { getUser: jest.fn() } };
  mock.createUserClient = jest.fn();
  return mock;
});

const db = require("../src/config/db");
const { makeSupabaseFrom } = require("./helpers/supabaseMock");
const app = require("../src/app");

const AUTH_USER = { id: "user-1", email: "test@example.com" };

function authenticate() {
  db.auth.getUser.mockResolvedValue({ data: { user: AUTH_USER }, error: null });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Workouts endpoints", () => {
  test("GET /workouts without a token is rejected with 401", async () => {
    const res = await request(app).get("/workouts");
    expect(res.status).toBe(401);
  });

  test("GET /workouts with an invalid token is rejected with 401", async () => {
    db.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid"),
    });

    const res = await request(app)
      .get("/workouts")
      .set("Authorization", "Bearer bad-token");

    expect(res.status).toBe(401);
  });

  test("POST /workouts creates a workout with its sets", async () => {
    authenticate();

    const workout = {
      id: "w1",
      user_id: AUTH_USER.id,
      date: "2026-11-18",
      name: "Legs",
    };
    const sets = [
      {
        id: "s1",
        workout_id: "w1",
        exercise_name: "Squat",
        weight: 80,
        reps: 8,
        set_order: 1,
      },
    ];

    db.createUserClient.mockReturnValue({
      from: makeSupabaseFrom([
        { data: workout, error: null },
        { data: sets, error: null },
      ]),
    });

    const res = await request(app)
      .post("/workouts")
      .set("Authorization", "Bearer good-token")
      .send({
        date: "2026-11-18",
        name: "Legs",
        sets: [{ exercise_name: "Squat", weight: 80, reps: 8 }],
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: "w1", sets });
  });

  test("POST /workouts requires a date and a non-empty sets array", async () => {
    authenticate();

    const res = await request(app)
      .post("/workouts")
      .set("Authorization", "Bearer good-token")
      .send({ date: "2026-11-18", sets: [] });

    expect(res.status).toBe(400);
  });

  test("GET /workouts lists the logged-in user's workouts", async () => {
    authenticate();

    const workouts = [
      { id: "w1", user_id: AUTH_USER.id, date: "2026-11-18", sets: [] },
    ];

    db.createUserClient.mockReturnValue({
      from: makeSupabaseFrom([{ data: workouts, error: null }]),
    });

    const res = await request(app)
      .get("/workouts")
      .set("Authorization", "Bearer good-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(workouts);
  });

  test("GET /workouts/:id returns 404 when the workout does not exist or belongs to someone else", async () => {
    authenticate();

    db.createUserClient.mockReturnValue({
      from: makeSupabaseFrom([{ data: null, error: null }]),
    });

    const res = await request(app)
      .get("/workouts/missing-id")
      .set("Authorization", "Bearer good-token");

    expect(res.status).toBe(404);
  });

  test("GET /workouts/:id returns the workout with its sets", async () => {
    authenticate();

    const workout = {
      id: "w1",
      user_id: AUTH_USER.id,
      date: "2026-11-18",
      sets: [{ id: "s1", exercise_name: "Squat", weight: 80, reps: 8 }],
    };

    db.createUserClient.mockReturnValue({
      from: makeSupabaseFrom([{ data: workout, error: null }]),
    });

    const res = await request(app)
      .get("/workouts/w1")
      .set("Authorization", "Bearer good-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(workout);
  });

  test("DELETE /workouts/:id removes the workout and its sets", async () => {
    authenticate();

    db.createUserClient.mockReturnValue({
      from: makeSupabaseFrom([
        { data: { id: "w1" }, error: null }, // find workout
        { data: null, error: null }, // delete workout_sets
        { data: null, error: null }, // delete workouts
      ]),
    });

    const res = await request(app)
      .delete("/workouts/w1")
      .set("Authorization", "Bearer good-token");

    expect(res.status).toBe(204);
  });

  test("DELETE /workouts/:id returns 404 for a workout that isn't the user's", async () => {
    authenticate();

    db.createUserClient.mockReturnValue({
      from: makeSupabaseFrom([{ data: null, error: null }]),
    });

    const res = await request(app)
      .delete("/workouts/not-mine")
      .set("Authorization", "Bearer good-token");

    expect(res.status).toBe(404);
  });
});
