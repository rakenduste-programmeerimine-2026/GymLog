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

describe("Exercises endpoints", () => {
  test("GET /exercises without a token is rejected with 401", async () => {
    const res = await request(app).get("/exercises");
    expect(res.status).toBe(401);
  });

  test("GET /exercises returns global and the user's own exercises", async () => {
    authenticate();

    const exercises = [
      { id: "e1", name: "Squat", category: "Legs", user_id: null },
      { id: "e2", name: "My Curl", category: "Arms", user_id: AUTH_USER.id },
    ];

    const fromMock = makeSupabaseFrom([{ data: exercises, error: null }]);
    db.createUserClient.mockReturnValue({ from: fromMock });

    const res = await request(app)
      .get("/exercises")
      .set("Authorization", "Bearer good-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(exercises);

    // The query must filter to global exercises (user_id IS NULL) OR the
    // logged-in user's own exercises. Real isolation from other users is
    // additionally enforced by Supabase Row Level Security.
    const builder = fromMock.mock.results[0].value;
    expect(builder.or).toHaveBeenCalledWith(
      `user_id.is.null,user_id.eq.${AUTH_USER.id}`,
    );
  });

  test("POST /exercises requires a name", async () => {
    authenticate();

    const res = await request(app)
      .post("/exercises")
      .set("Authorization", "Bearer good-token")
      .send({ category: "Legs" });

    expect(res.status).toBe(400);
  });

  test("POST /exercises always saves the exercise under the logged-in user's id", async () => {
    authenticate();

    const created = {
      id: "e3",
      name: "Bulgarian Split Squat",
      category: "Legs",
      user_id: AUTH_USER.id,
    };

    const fromMock = makeSupabaseFrom([{ data: created, error: null }]);
    db.createUserClient.mockReturnValue({ from: fromMock });

    // Even if the client tries to set a different user_id, the server must
    // ignore it and use the authenticated user's own id instead.
    const res = await request(app)
      .post("/exercises")
      .set("Authorization", "Bearer good-token")
      .send({ name: "Bulgarian Split Squat", category: "Legs", user_id: "someone-else" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(created);

    const builder = fromMock.mock.results[0].value;
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: AUTH_USER.id }),
    );
  });
});
