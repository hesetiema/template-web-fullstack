import { describe, it, expect } from "vitest";
import { buildApp } from "../app";
import type { Env } from "../env";
import type { UserRepository } from "../db/repository";
import type { User } from "../db/schema";

const env: Env = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3000,
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  LOG_LEVEL: "silent",
  CORS_ORIGIN: "http://localhost:5173",
  APP_VERSION: "test",
};

function makeRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  const rows: User[] = [];
  return {
    list: async () => rows,
    create: async (input) => {
      const row: User = { id: rows.length + 1, createdAt: new Date(), ...input };
      rows.push(row);
      return row;
    },
    ...overrides,
  };
}

describe("health routes", () => {
  it("liveness is always ok and does not call readiness check", async () => {
    const app = await buildApp({ env, users: makeRepo(), checkReady: async () => false });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", version: "test" });
    await app.close();
  });

  it("readiness returns 503 when dependency is down", async () => {
    const app = await buildApp({ env, users: makeRepo(), checkReady: async () => false });
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("readiness returns 200 when dependency is up", async () => {
    const app = await buildApp({ env, users: makeRepo(), checkReady: async () => true });
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", ready: true });
    await app.close();
  });
});

describe("user routes", () => {
  it("validates input and returns 400 for an invalid email", async () => {
    const app = await buildApp({ env, users: makeRepo(), checkReady: async () => true });
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "Ada", email: "not-an-email" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("creates a user and returns 201", async () => {
    const app = await buildApp({ env, users: makeRepo(), checkReady: async () => true });
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "Ada", email: "ada@example.com" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data).toMatchObject({ name: "Ada", email: "ada@example.com" });
    await app.close();
  });
});
