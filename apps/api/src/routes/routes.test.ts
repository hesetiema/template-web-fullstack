import { describe, it, expect } from "vitest";
import { buildApp } from "../app";
import type { Env } from "../env";
import type { TaskRepository } from "../db/repository";
import type { Task } from "../db/schema";

const env: Env = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3000,
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  LOG_LEVEL: "silent",
  CORS_ORIGIN: "http://localhost:5173",
  APP_VERSION: "test",
};

function makeRepo(rows: Task[] = []): TaskRepository {
  const data = [...rows];
  return {
    list: async () => data,
    create: async (input) => {
      const row: Task = { id: data.length + 1, completed: false, createdAt: new Date(), ...input };
      data.push(row);
      return row;
    },
    update: async (id, patch) => {
      const row = data.find((item) => item.id === id);
      if (!row) return undefined;
      Object.assign(row, patch);
      return row;
    },
    remove: async (id) => {
      const index = data.findIndex((item) => item.id === id);
      if (index < 0) return false;
      data.splice(index, 1);
      return true;
    },
  };
}

async function makeApp(repo: TaskRepository = makeRepo()) {
  const app = await buildApp({ env, tasks: repo, checkReady: async () => true });
  return app;
}

describe("health routes", () => {
  it("liveness is always ok", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", version: "test" });
    await app.close();
  });

  it("readiness returns 503 when dependency is down", async () => {
    const app = await buildApp({ env, tasks: makeRepo(), checkReady: async () => false });
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("readiness returns 200 when dependency is up", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", ready: true });
    await app.close();
  });
});

describe("task routes", () => {
  it("lists tasks", async () => {
    const seed: Task = { id: 1, title: "Seed", completed: false, createdAt: new Date() };
    const app = await makeApp(makeRepo([seed]));
    const res = await app.inject({ method: "GET", url: "/api/tasks" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
    await app.close();
  });

  it("rejects an empty title with 400", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "POST", url: "/api/tasks", payload: { title: "  " } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("creates a task and returns 201", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "POST", url: "/api/tasks", payload: { title: "Buy milk" } });
    expect(res.statusCode).toBe(201);
    expect(res.json().data).toMatchObject({ title: "Buy milk", completed: false });
    await app.close();
  });

  it("toggles completion via PATCH", async () => {
    const repo = makeRepo();
    const app = await makeApp(repo);
    const created = await app.inject({ method: "POST", url: "/api/tasks", payload: { title: "Task" } });
    const id = created.json().data.id as number;
    const res = await app.inject({ method: "PATCH", url: `/api/tasks/${id}`, payload: { completed: true } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ id, completed: true });
    await app.close();
  });

  it("returns 404 when patching a missing task", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "PATCH", url: "/api/tasks/999", payload: { completed: true } });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("deletes a task with 204, then 404 on repeat", async () => {
    const repo = makeRepo();
    const app = await makeApp(repo);
    const created = await app.inject({ method: "POST", url: "/api/tasks", payload: { title: "Temp" } });
    const id = created.json().data.id as number;
    const first = await app.inject({ method: "DELETE", url: `/api/tasks/${id}` });
    expect(first.statusCode).toBe(204);
    const second = await app.inject({ method: "DELETE", url: `/api/tasks/${id}` });
    expect(second.statusCode).toBe(404);
    await app.close();
  });
});
