/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const TODAY = "2026-11-10";

const drill = {
  name: "Cordless drill",
  category: "power_tools",
  condition: "good",
  description: "18V, two batteries.",
} as const;

function setup() {
  return convexTest(schema, modules);
}

type T = ReturnType<typeof setup>;

async function addUser(t: T, key: string, extra: Partial<Doc<"users">> = {}) {
  const id = await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkUserId: `user_${key}`,
      email: `${key}@example.com`,
      name: key,
      role: "user",
      ...extra,
    }),
  );
  return { id, as: t.withIdentity({ subject: `user_${key}` }) };
}

async function addLoan(
  t: T,
  toolId: Id<"tools">,
  borrowerId: Id<"users">,
  fields: Pick<Doc<"loans">, "startDate" | "endDate" | "status">,
) {
  return await t.run(async (ctx) => {
    const tool = await ctx.db.get(toolId);
    return await ctx.db.insert("loans", { toolId, borrowerId, lenderId: tool!.ownerId, ...fields });
  });
}

describe("create", () => {
  test("sets the owner from the token and trims input", async () => {
    const t = setup();
    const alice = await addUser(t, "alice");
    const toolId = await alice.as.mutation(api.tools.create, {
      ...drill,
      name: "  Cordless drill  ",
      description: " 18V, two batteries. ",
    });

    const tool = await t.run((ctx) => ctx.db.get(toolId));
    expect(tool).toMatchObject({ ...drill, ownerId: alice.id, status: "active" });
  });

  test("rejects a caller that is not signed in", async () => {
    const t = setup();
    await expect(t.mutation(api.tools.create, drill)).rejects.toThrow("Not signed in");
  });

  test("rejects an empty name", async () => {
    const t = setup();
    const alice = await addUser(t, "alice");
    await expect(alice.as.mutation(api.tools.create, { ...drill, name: "   " })).rejects.toThrow(
      "Name is required",
    );
  });

  test("rejects a name or description that is too long", async () => {
    const t = setup();
    const alice = await addUser(t, "alice");
    await expect(
      alice.as.mutation(api.tools.create, { ...drill, name: "x".repeat(81) }),
    ).rejects.toThrow("Name must be 80 characters or fewer");
    await expect(
      alice.as.mutation(api.tools.create, { ...drill, description: "x".repeat(501) }),
    ).rejects.toThrow("Description must be 500 characters or fewer");
  });
});

describe("update", () => {
  test("lets the owner edit the tool", async () => {
    const t = setup();
    const alice = await addUser(t, "alice");
    const toolId = await alice.as.mutation(api.tools.create, drill);
    await alice.as.mutation(api.tools.update, { toolId, ...drill, condition: "worn" });

    expect(await t.run((ctx) => ctx.db.get(toolId))).toMatchObject({ condition: "worn" });
  });

  test("rejects other users and admins", async () => {
    const t = setup();
    const alice = await addUser(t, "alice");
    const bob = await addUser(t, "bob");
    const admin = await addUser(t, "admin", { role: "admin" });
    const toolId = await alice.as.mutation(api.tools.create, drill);

    await expect(bob.as.mutation(api.tools.update, { toolId, ...drill })).rejects.toThrow("Forbidden");
    await expect(admin.as.mutation(api.tools.update, { toolId, ...drill })).rejects.toThrow("Forbidden");
  });

  test("rejects a removed tool", async () => {
    const t = setup();
    const alice = await addUser(t, "alice");
    const toolId = await alice.as.mutation(api.tools.create, drill);
    await alice.as.mutation(api.tools.remove, { toolId });

    await expect(alice.as.mutation(api.tools.update, { toolId, ...drill })).rejects.toThrow(
      "Tool not found",
    );
  });
});

describe("remove", () => {
  test("lets the owner and admins remove a tool, but not other users", async () => {
    const t = setup();
    const alice = await addUser(t, "alice");
    const bob = await addUser(t, "bob");
    const admin = await addUser(t, "admin", { role: "admin" });
    const first = await alice.as.mutation(api.tools.create, drill);
    const second = await alice.as.mutation(api.tools.create, drill);

    await expect(bob.as.mutation(api.tools.remove, { toolId: first })).rejects.toThrow("Forbidden");
    await alice.as.mutation(api.tools.remove, { toolId: first });
    await admin.as.mutation(api.tools.remove, { toolId: second });

    const tools = await t.run((ctx) => ctx.db.query("tools").collect());
    expect(tools.map((tool) => tool.status)).toEqual(["removed", "removed"]);
  });

  test("declines pending requests and keeps approved loans", async () => {
    const t = setup();
    const alice = await addUser(t, "alice");
    const bob = await addUser(t, "bob");
    const toolId = await alice.as.mutation(api.tools.create, drill);
    const pending = await addLoan(t, toolId, bob.id, {
      startDate: "2026-11-20",
      endDate: "2026-11-21",
      status: "requested",
    });
    const approved = await addLoan(t, toolId, bob.id, {
      startDate: "2026-11-09",
      endDate: "2026-11-11",
      status: "approved",
    });

    await alice.as.mutation(api.tools.remove, { toolId });

    const loans = await t.run(async (ctx) => [await ctx.db.get(pending), await ctx.db.get(approved)]);
    expect(loans.map((loan) => loan?.status)).toEqual(["declined", "approved"]);
    const events = await t.run((ctx) => ctx.db.query("loanEvents").collect());
    expect(events).toMatchObject([{ loanId: pending, type: "declined", source: "user" }]);
  });
});

describe("listPublic", () => {
  test("returns only name and category of active tools, without sign-in", async () => {
    const t = setup();
    const alice = await addUser(t, "alice");
    await alice.as.mutation(api.tools.create, drill);
    const removed = await alice.as.mutation(api.tools.create, { ...drill, name: "Old saw" });
    await alice.as.mutation(api.tools.remove, { toolId: removed });

    expect(await t.query(api.tools.listPublic, {})).toEqual([
      { name: "Cordless drill", category: "power_tools" },
    ]);
  });
});

describe("list", () => {
  test("rejects a caller that is not signed in", async () => {
    const t = setup();
    await expect(t.query(api.tools.list, { today: TODAY })).rejects.toThrow("Not signed in");
  });

  test("rejects an invalid date", async () => {
    const t = setup();
    const alice = await addUser(t, "alice");
    await expect(alice.as.query(api.tools.list, { today: "2026-02-30" })).rejects.toThrow(
      "today must be a date in YYYY-MM-DD format",
    );
  });

  test("filters by category", async () => {
    const t = setup();
    const alice = await addUser(t, "alice");
    await alice.as.mutation(api.tools.create, drill);
    await alice.as.mutation(api.tools.create, { ...drill, name: "Rake", category: "garden" });

    const garden = await alice.as.query(api.tools.list, { today: TODAY, category: "garden" });
    expect(garden.map((tool) => tool.name)).toEqual(["Rake"]);
    const all = await alice.as.query(api.tools.list, { today: TODAY });
    expect(all).toHaveLength(2);
  });

  test("shows the owner name and Trusted Lender flag, but not the email", async () => {
    const t = setup();
    const alice = await addUser(t, "alice", { trustedLender: true });
    const bob = await addUser(t, "bob");
    await alice.as.mutation(api.tools.create, drill);

    const [asBob] = await bob.as.query(api.tools.list, { today: TODAY });
    expect(asBob.owner).toEqual({ name: "alice", trustedLender: true });
    expect(asBob.isMine).toBe(false);
    expect(JSON.stringify(asBob)).not.toContain("@example.com");

    const [asAlice] = await alice.as.query(api.tools.list, { today: TODAY });
    expect(asAlice.isMine).toBe(true);
  });

  test("calculates availability from approved loans", async () => {
    const t = setup();
    const alice = await addUser(t, "alice");
    const bob = await addUser(t, "bob");
    const make = (name: string) => alice.as.mutation(api.tools.create, { ...drill, name });
    const free = await make("free");
    const requested = await make("requested");
    const future = await make("future");
    const out = await make("out");
    const late = await make("late");
    const returned = await make("returned");

    await addLoan(t, requested, bob.id, { startDate: "2026-11-09", endDate: "2026-11-11", status: "requested" });
    await addLoan(t, future, bob.id, { startDate: "2026-11-11", endDate: "2026-11-12", status: "approved" });
    await addLoan(t, out, bob.id, { startDate: "2026-11-10", endDate: "2026-11-10", status: "approved" });
    await addLoan(t, late, bob.id, { startDate: "2026-11-01", endDate: "2026-11-09", status: "approved" });
    await addLoan(t, returned, bob.id, { startDate: "2026-11-01", endDate: "2026-11-09", status: "returned" });

    const tools = await bob.as.query(api.tools.list, { today: TODAY });
    const byId = new Map(tools.map((tool) => [tool._id, tool.availability]));
    expect(byId.get(free)).toEqual({ state: "available" });
    expect(byId.get(requested)).toEqual({ state: "available" });
    expect(byId.get(future)).toEqual({ state: "available", nextBookedFrom: "2026-11-11" });
    expect(byId.get(out)).toEqual({ state: "on_loan", until: "2026-11-10" });
    expect(byId.get(late)).toEqual({ state: "overdue", since: "2026-11-09" });
    expect(byId.get(returned)).toEqual({ state: "available" });
  });
});

describe("mine", () => {
  test("returns only the caller's active tools", async () => {
    const t = setup();
    const alice = await addUser(t, "alice");
    const bob = await addUser(t, "bob");
    await alice.as.mutation(api.tools.create, drill);
    const removed = await alice.as.mutation(api.tools.create, { ...drill, name: "Old saw" });
    await alice.as.mutation(api.tools.remove, { toolId: removed });
    await bob.as.mutation(api.tools.create, { ...drill, name: "Bob's ladder", category: "ladders" });

    const tools = await alice.as.query(api.tools.mine, { today: TODAY });
    expect(tools).toMatchObject([{ name: "Cordless drill", availability: { state: "available" } }]);
  });
});
