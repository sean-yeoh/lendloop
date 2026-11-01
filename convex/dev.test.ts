/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { isLocalDeployment } from "./dev";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => vi.unstubAllEnvs());

async function withData() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      clerkUserId: "user_a",
      email: "a@example.com",
      name: "A",
      role: "user",
    });
    await ctx.db.insert("tools", {
      ownerId,
      name: "Drill",
      category: "power_tools",
      condition: "good",
      description: "",
      status: "active",
    });
  });
  return t;
}

const count = (t: ReturnType<typeof convexTest>) =>
  t.run(
    async (ctx) =>
      (await ctx.db.query("users").collect()).length +
      (await ctx.db.query("tools").collect()).length,
  );

describe("dev:reset", () => {
  test("deletes every document on a local backend", async () => {
    vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210");
    const t = await withData();

    expect(await t.mutation(internal.dev.reset, { confirm: "delete all data" })).toEqual({
      remaining: false,
    });
    expect(await count(t)).toBe(0);
  });

  test("refuses to run on a cloud deployment", async () => {
    vi.stubEnv("CONVEX_CLOUD_URL", "https://happy-animal-123.convex.cloud");
    const t = await withData();

    await expect(t.mutation(internal.dev.reset, { confirm: "delete all data" })).rejects.toThrow(
      /local/,
    );
    expect(await count(t)).toBe(2);
  });

  test("recognizes only localhost addresses as local", () => {
    expect(isLocalDeployment("http://localhost:3210")).toBe(true);
    expect(isLocalDeployment("http://127.0.0.1:3210")).toBe(true);
    expect(isLocalDeployment("https://127.0.0.1.example.com")).toBe(false);
    expect(isLocalDeployment(undefined)).toBe(false);
  });
});
