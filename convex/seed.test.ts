/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const users = [
  { clerkUserId: "user_alice", email: "Alice+clerk_test@example.com", name: "Alice Smith" },
  { clerkUserId: "user_bob", email: "bob+clerk_test@example.com", name: "Bob Jones" },
];

test("creates users and tools, and does nothing on a second run", async () => {
  const t = convexTest(schema, modules);

  expect(await t.mutation(internal.seed.run, { users })).toEqual({ usersCreated: 2, usersUpdated: 0, toolsCreated: 8 });
  expect(await t.mutation(internal.seed.run, { users })).toEqual({ usersCreated: 0, usersUpdated: 0, toolsCreated: 0 });

  const rows = await t.run((ctx) => ctx.db.query("users").collect());
  expect(rows).toMatchObject([
    { email: "alice+clerk_test@example.com", role: "user" },
    { email: "bob+clerk_test@example.com", role: "user" },
  ]);
});

test("renames an existing seed user", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.seed.run, { users });

  const renamed = [{ ...users[0], name: "Alice Renamed" }, users[1]];
  expect(await t.mutation(internal.seed.run, { users: renamed })).toEqual({
    usersCreated: 0,
    usersUpdated: 1,
    toolsCreated: 0,
  });
  const [alice] = await t.run((ctx) => ctx.db.query("users").collect());
  expect(alice.name).toBe("Alice Renamed");
});

test("keeps an existing user's role and does not duplicate their tools", async () => {
  const t = convexTest(schema, modules);
  await t.run((ctx) =>
    ctx.db.insert("users", { clerkUserId: "user_alice", email: "alice@example.com", name: "Alice", role: "admin" }),
  );

  await t.mutation(internal.seed.run, { users: users.slice(0, 1) });

  const [alice] = await t.run((ctx) => ctx.db.query("users").collect());
  expect(alice.role).toBe("admin");
  const tools = await t.run((ctx) => ctx.db.query("tools").collect());
  expect(tools).toHaveLength(4);
  expect(tools.every((tool) => tool.ownerId === alice._id)).toBe(true);
});
