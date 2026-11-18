const request = require("supertest");

jest.mock("../src/config/db", () => {
  const mock = { auth: { getUser: jest.fn() } };
  mock.createUserClient = jest.fn();
  return mock;
});

const db = require("../src/config/db");
const app = require("../src/app");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Error handling", () => {
  test("unknown routes return a JSON 404", async () => {
    const res = await request(app).get("/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Route not found" });
  });

  test("an unexpected error in a route handler returns a generic 500 instead of crashing", async () => {
    db.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    // Simulate an unexpected failure (e.g. a network error), not a normal
    // Supabase { data, error } result.
    db.createUserClient.mockReturnValue({
      from: jest.fn(() => {
        throw new Error("boom");
      }),
    });

    const res = await request(app)
      .get("/workouts")
      .set("Authorization", "Bearer good-token");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});
