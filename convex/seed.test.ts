/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const TODAY = "2026-11-10";

const users = [
  { clerkUserId: "user_alice", email: "Alice+clerk_test@example.com", name: "Alice Smith" },
  { clerkUserId: "user_bob", email: "bob+clerk_test@example.com", name: "Bob Jones" },
  { clerkUserId: "user_carol", email: "carol+clerk_test@example.com", name: "Carol Brown" },
];

function setup() {
  return convexTest(schema, modules);
}

test("creates users, tools, and loans, and a second run creates no duplicates", async () => {
  const t = setup();

  expect(await t.mutation(internal.seed.run, { users, today: TODAY })).toEqual({
    usersCreated: 3,
    usersUpdated: 0,
    toolsCreated: 12,
    loansCreated: 10,
  });
  expect(await t.mutation(internal.seed.run, { users, today: TODAY })).toEqual({
    usersCreated: 0,
    usersUpdated: 0,
    toolsCreated: 0,
    loansCreated: 10,
  });

  const rows = await t.run((ctx) => ctx.db.query("users").collect());
  expect(rows.map((user) => [user.email, user.role])).toEqual([
    ["alice+clerk_test@example.com", "user"],
    ["bob+clerk_test@example.com", "user"],
    ["carol+clerk_test@example.com", "user"],
  ]);
  expect(await t.run((ctx) => ctx.db.query("loans").collect())).toHaveLength(10);
});

test("seeds loans in every status, relative to today", async () => {
  const t = setup();
  await t.mutation(internal.seed.run, { users, today: TODAY });

  const loans = await t.run((ctx) => ctx.db.query("loans").collect());
  expect(new Set(loans.map((loan) => loan.status))).toEqual(
    new Set(["requested", "approved", "declined", "cancelled", "returned"]),
  );
  const overdue = loans.filter((loan) => loan.status === "approved" && loan.endDate < TODAY);
  expect(overdue.map((loan) => loan.endDate).toSorted()).toEqual(["2026-11-07", "2026-11-09"]);

  const events = await t.run((ctx) => ctx.db.query("loanEvents").collect());
  expect(
    events.filter((event) => event.type === "reminder_sent" && event.source === "n8n"),
  ).toHaveLength(2);
});

test("keeps loans that involve users outside the seed", async () => {
  const t = setup();
  await t.mutation(internal.seed.run, { users, today: TODAY });
  const outsiderLoan = await t.run(async (ctx) => {
    const outsider = await ctx.db.insert("users", {
      clerkUserId: "user_sean",
      email: "sean@example.com",
      name: "Sean",
      role: "user",
    });
    const tool = (await ctx.db.query("tools").first())!;
    return await ctx.db.insert("loans", {
      toolId: tool._id,
      borrowerId: outsider,
      lenderId: tool.ownerId,
      startDate: "2026-11-20",
      endDate: "2026-11-21",
      status: "requested",
    });
  });

  await t.mutation(internal.seed.run, { users, today: TODAY });

  expect(await t.run((ctx) => ctx.db.get(outsiderLoan))).not.toBeNull();
});

test("renames an existing seed user", async () => {
  const t = setup();
  await t.mutation(internal.seed.run, { users, today: TODAY });

  const renamed = [{ ...users[0], name: "Alice Renamed" }, ...users.slice(1)];
  expect(await t.mutation(internal.seed.run, { users: renamed, today: TODAY })).toMatchObject({
    usersCreated: 0,
    usersUpdated: 1,
    toolsCreated: 0,
  });
  const [alice] = await t.run((ctx) => ctx.db.query("users").collect());
  expect(alice.name).toBe("Alice Renamed");
});

test("keeps an existing user's role and does not duplicate their tools", async () => {
  const t = setup();
  await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkUserId: "user_alice",
      email: "alice@example.com",
      name: "Alice",
      role: "admin",
    }),
  );

  await t.mutation(internal.seed.run, { users: users.slice(0, 1), today: TODAY });

  const [alice] = await t.run((ctx) => ctx.db.query("users").collect());
  expect(alice.role).toBe("admin");
  const tools = await t.run((ctx) => ctx.db.query("tools").collect());
  expect(tools).toHaveLength(4);
  expect(tools.every((tool) => tool.ownerId === alice._id)).toBe(true);
});

test("creates the seed admin with the admin role, restores it, and changes no other role", async () => {
  const t = setup();
  const admin = {
    clerkUserId: "user_admin",
    email: "admin+clerk_test@example.com",
    name: "Admin User",
    role: "admin" as const,
  };
  const withAdmin = [...users, admin];

  expect(await t.mutation(internal.seed.run, { users: withAdmin, today: TODAY })).toMatchObject({
    usersCreated: 4,
    toolsCreated: 12,
  });
  const roles = async () =>
    Object.fromEntries(
      (await t.run((ctx) => ctx.db.query("users").collect())).map((user) => [user.name, user.role]),
    );
  expect(await roles()).toEqual({
    "Alice Smith": "user",
    "Bob Jones": "user",
    "Carol Brown": "user",
    "Admin User": "admin",
  });
  // The admin owns no tools.
  const tools = await t.run((ctx) => ctx.db.query("tools").collect());
  const adminRow = (await t.run((ctx) => ctx.db.query("users").collect())).find(
    (user) => user.name === "Admin User",
  )!;
  expect(tools.some((tool) => tool.ownerId === adminRow._id)).toBe(false);

  // Someone revoked the role: the next seed run restores it.
  await t.run((ctx) => ctx.db.patch(adminRow._id, { role: "user" }));
  expect(await t.mutation(internal.seed.run, { users: withAdmin, today: TODAY })).toMatchObject({
    usersCreated: 0,
    usersUpdated: 1,
  });
  expect((await roles())["Admin User"]).toBe("admin");
});
