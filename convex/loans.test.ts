/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const TODAY = "2026-11-10";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

const drill = { name: "Cordless drill", category: "power_tools", condition: "good", description: "" } as const;

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

// Alice lends a drill. Bob and Carol borrow.
async function scenario() {
  const t = setup();
  const alice = await addUser(t, "alice");
  const bob = await addUser(t, "bob");
  const carol = await addUser(t, "carol");
  const toolId = await alice.as.mutation(api.tools.create, drill);
  const request = (who: typeof bob, startDate: string, endDate: string) =>
    who.as.mutation(api.loans.request, { toolId, startDate, endDate, today: TODAY });
  return { t, alice, bob, carol, toolId, request };
}

async function getLoan(t: T, loanId: Id<"loans">) {
  return (await t.run((ctx) => ctx.db.get(loanId)))!;
}

async function eventTypes(t: T, loanId: Id<"loans">) {
  const events = await t.run((ctx) =>
    ctx.db
      .query("loanEvents")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .collect(),
  );
  return events.map((event) => event.type);
}

describe("request", () => {
  test("creates a requested loan with the lender copied from the tool", async () => {
    const { t, alice, bob, toolId, request } = await scenario();
    const loanId = await request(bob, "2026-11-12", "2026-11-14");

    expect(await getLoan(t, loanId)).toMatchObject({
      toolId,
      borrowerId: bob.id,
      lenderId: alice.id,
      startDate: "2026-11-12",
      endDate: "2026-11-14",
      status: "requested",
    });
    expect(await eventTypes(t, loanId)).toEqual(["requested"]);
  });

  test("rejects a caller that is not signed in", async () => {
    const { t, toolId } = await scenario();
    await expect(
      t.mutation(api.loans.request, { toolId, startDate: TODAY, endDate: TODAY, today: TODAY }),
    ).rejects.toThrow("Not signed in");
  });

  test("rejects the owner's own tool", async () => {
    const { alice, request } = await scenario();
    await expect(request(alice, TODAY, TODAY)).rejects.toThrow("You cannot borrow your own tool");
  });

  test("rejects a removed tool", async () => {
    const { alice, bob, toolId, request } = await scenario();
    await alice.as.mutation(api.tools.remove, { toolId });
    await expect(request(bob, TODAY, TODAY)).rejects.toThrow("Tool not found");
  });

  test("rejects invalid date ranges", async () => {
    const { bob, request } = await scenario();
    await expect(request(bob, "2026-11-09", "2026-11-12")).rejects.toThrow(
      "The start date cannot be in the past",
    );
    await expect(request(bob, "2026-11-12", "2026-11-11")).rejects.toThrow(
      "The end date cannot be before the start date",
    );
    await expect(request(bob, "2026-11-31", "2026-12-01")).rejects.toThrow(
      "startDate must be a date in YYYY-MM-DD format",
    );
  });

  test("accepts a client date one day from the server date, and rejects more", async () => {
    const { bob, toolId } = await scenario();
    const ask = (today: string) =>
      bob.as.mutation(api.loans.request, { toolId, startDate: "2026-11-20", endDate: "2026-11-20", today });

    await expect(ask("2026-11-11")).resolves.toBeDefined();
    await expect(ask("2026-11-08")).rejects.toThrow("today does not match the current date");
  });

  test("rejects dates that overlap an approved loan, including a shared day", async () => {
    const { alice, bob, carol, request } = await scenario();
    const loanId = await request(bob, "2026-11-12", "2026-11-15");
    await alice.as.mutation(api.loans.approve, { loanId });

    await expect(request(carol, "2026-11-15", "2026-11-16")).rejects.toThrow(
      "The tool is already booked for some of these dates",
    );
    await expect(request(carol, "2026-11-16", "2026-11-17")).resolves.toBeDefined();
  });

  test("allows overlapping requests from different borrowers, but not from the same one", async () => {
    const { bob, carol, request } = await scenario();
    await request(bob, "2026-11-12", "2026-11-14");

    await expect(request(carol, "2026-11-13", "2026-11-15")).resolves.toBeDefined();
    await expect(request(bob, "2026-11-14", "2026-11-16")).rejects.toThrow(
      "You already requested this tool for some of these dates",
    );
  });
});

describe("approve", () => {
  test("approves and declines only the overlapping pending requests", async () => {
    const { t, alice, bob, carol, request } = await scenario();
    const chosen = await request(bob, "2026-11-12", "2026-11-14");
    const overlapping = await request(carol, "2026-11-14", "2026-11-16");
    const separate = await request(carol, "2026-11-20", "2026-11-21");

    await alice.as.mutation(api.loans.approve, { loanId: chosen });

    expect((await getLoan(t, chosen)).status).toBe("approved");
    expect((await getLoan(t, overlapping)).status).toBe("declined");
    expect((await getLoan(t, separate)).status).toBe("requested");
    expect(await eventTypes(t, chosen)).toEqual(["requested", "approved"]);
    expect(await eventTypes(t, overlapping)).toEqual(["requested", "declined"]);
  });

  test("rejects the borrower and other users", async () => {
    const { bob, carol, request } = await scenario();
    const loanId = await request(bob, "2026-11-12", "2026-11-14");

    await expect(bob.as.mutation(api.loans.approve, { loanId })).rejects.toThrow("Forbidden");
    await expect(carol.as.mutation(api.loans.approve, { loanId })).rejects.toThrow("Forbidden");
  });

  test("rejects a loan that is not requested", async () => {
    const { alice, bob, request } = await scenario();
    const loanId = await request(bob, "2026-11-12", "2026-11-14");
    await alice.as.mutation(api.loans.decline, { loanId });

    await expect(alice.as.mutation(api.loans.approve, { loanId })).rejects.toThrow(
      "This loan is declined, so this action is not possible",
    );
  });

  test("rejects an overlap with a loan that was approved first", async () => {
    const { t, alice, bob, carol, toolId, request } = await scenario();
    const loanId = await request(bob, "2026-11-12", "2026-11-14");
    // A conflicting approved loan that the request check did not see, for example from a race.
    await t.run((ctx) =>
      ctx.db.insert("loans", {
        toolId,
        borrowerId: carol.id,
        lenderId: alice.id,
        startDate: "2026-11-13",
        endDate: "2026-11-13",
        status: "approved",
      }),
    );

    await expect(alice.as.mutation(api.loans.approve, { loanId })).rejects.toThrow(
      "Another loan is already approved for some of these dates",
    );
  });
});

describe("decline and cancel", () => {
  test("the lender declines, and the borrower cannot", async () => {
    const { t, alice, bob, request } = await scenario();
    const loanId = await request(bob, "2026-11-12", "2026-11-14");

    await expect(bob.as.mutation(api.loans.decline, { loanId })).rejects.toThrow("Forbidden");
    await alice.as.mutation(api.loans.decline, { loanId });
    expect((await getLoan(t, loanId)).status).toBe("declined");
    expect(await eventTypes(t, loanId)).toEqual(["requested", "declined"]);
  });

  test("the borrower cancels a request, and the lender cannot", async () => {
    const { t, alice, bob, request } = await scenario();
    const loanId = await request(bob, "2026-11-12", "2026-11-14");

    await expect(alice.as.mutation(api.loans.cancel, { loanId })).rejects.toThrow("Forbidden");
    await bob.as.mutation(api.loans.cancel, { loanId });
    expect((await getLoan(t, loanId)).status).toBe("cancelled");
    expect(await eventTypes(t, loanId)).toEqual(["requested", "cancelled"]);
  });

  test("the borrower cannot cancel an approved loan", async () => {
    const { alice, bob, request } = await scenario();
    const loanId = await request(bob, "2026-11-12", "2026-11-14");
    await alice.as.mutation(api.loans.approve, { loanId });

    await expect(bob.as.mutation(api.loans.cancel, { loanId })).rejects.toThrow(
      "This loan is approved, so this action is not possible",
    );
  });
});

describe("markReturned", () => {
  test("the lender marks an approved loan returned, and the tool is available again", async () => {
    const { t, alice, bob, toolId, request } = await scenario();
    const loanId = await request(bob, TODAY, "2026-11-12");
    await alice.as.mutation(api.loans.approve, { loanId });

    const [onLoan] = await bob.as.query(api.tools.list, { today: TODAY });
    expect(onLoan.availability).toEqual({ state: "on_loan", until: "2026-11-12" });

    await alice.as.mutation(api.loans.markReturned, { loanId });

    const returned = await getLoan(t, loanId);
    expect(returned.status).toBe("returned");
    // convex-test moves the clock forward slightly between transactions.
    expect(returned.returnedAt! - Date.parse(`${TODAY}T12:00:00Z`)).toBeLessThan(1000);
    expect(await eventTypes(t, loanId)).toEqual(["requested", "approved", "returned"]);
    const [available] = await bob.as.query(api.tools.list, { today: TODAY });
    expect(available).toMatchObject({ _id: toolId, availability: { state: "available" } });
  });

  test("rejects the borrower and a loan that is not approved", async () => {
    const { alice, bob, request } = await scenario();
    const loanId = await request(bob, "2026-11-12", "2026-11-14");

    await expect(alice.as.mutation(api.loans.markReturned, { loanId })).rejects.toThrow(
      "This loan is requested, so this action is not possible",
    );
    await alice.as.mutation(api.loans.approve, { loanId });
    await expect(bob.as.mutation(api.loans.markReturned, { loanId })).rejects.toThrow("Forbidden");
  });
});

describe("lists", () => {
  test("myRequests and incoming show only the caller's loans, with names and no emails", async () => {
    const { alice, bob, carol, request } = await scenario();
    await request(bob, "2026-11-12", "2026-11-14");
    await request(carol, "2026-11-20", "2026-11-21");

    const bobRequests = await bob.as.query(api.loans.myRequests, {});
    expect(bobRequests).toMatchObject([
      { status: "requested", tool: { name: "Cordless drill" }, lender: { name: "alice" } },
    ]);

    const aliceIncoming = await alice.as.query(api.loans.incoming, {});
    expect(aliceIncoming.map((loan) => loan.borrower.name)).toEqual(["carol", "bob"]);
    expect(await alice.as.query(api.loans.myRequests, {})).toEqual([]);

    expect(JSON.stringify([bobRequests, aliceIncoming])).not.toContain("@example.com");
  });

  test("listAll is for admins only", async () => {
    const { t, bob, request } = await scenario();
    const admin = await addUser(t, "admin", { role: "admin" });
    await request(bob, "2026-11-12", "2026-11-14");

    await expect(bob.as.query(api.loans.listAll, {})).rejects.toThrow("Forbidden");
    expect(await admin.as.query(api.loans.listAll, {})).toMatchObject([
      { tool: { name: "Cordless drill" }, borrower: { name: "bob" }, lender: { name: "alice" } },
    ]);
  });
});

describe("bookedRanges", () => {
  test("returns only the dates of approved loans, and nothing when signed out", async () => {
    const { t, alice, bob, carol, toolId, request } = await scenario();
    const approved = await request(bob, "2026-11-12", "2026-11-14");
    await request(carol, "2026-11-20", "2026-11-21");
    await alice.as.mutation(api.loans.approve, { loanId: approved });

    expect(await carol.as.query(api.loans.bookedRanges, { toolId })).toEqual([
      { startDate: "2026-11-12", endDate: "2026-11-14" },
    ]);
    expect(await t.query(api.loans.bookedRanges, { toolId })).toEqual([]);
  });
});

describe("signed out", () => {
  test("list queries return no data, and mutations still reject", async () => {
    const { t, bob, request } = await scenario();
    const loanId = await request(bob, "2026-11-12", "2026-11-14");

    expect(await t.query(api.loans.myRequests, {})).toEqual([]);
    expect(await t.query(api.loans.incoming, {})).toEqual([]);
    expect(await t.query(api.loans.navCounts, { today: TODAY })).toEqual({ incomingPending: 0, myOverdue: 0 });
    await expect(t.mutation(api.loans.cancel, { loanId })).rejects.toThrow("Not signed in");
    await expect(t.query(api.loans.listAll, {})).rejects.toThrow("Not signed in");
  });
});

describe("navCounts", () => {
  test("counts pending requests for the lender and overdue loans for the borrower", async () => {
    const { t, alice, bob, carol, toolId, request } = await scenario();
    await request(bob, "2026-11-12", "2026-11-14");
    await request(carol, "2026-11-20", "2026-11-21");
    // An approved loan that ended yesterday is overdue. A returned one is not.
    const insertLoan = (fields: Pick<Doc<"loans">, "startDate" | "endDate" | "status">) =>
      t.run((ctx) => ctx.db.insert("loans", { toolId, borrowerId: bob.id, lenderId: alice.id, ...fields }));
    await insertLoan({ startDate: "2026-11-01", endDate: "2026-11-09", status: "approved" });
    await insertLoan({ startDate: "2026-11-01", endDate: "2026-11-05", status: "returned" });
    await insertLoan({ startDate: "2026-11-09", endDate: "2026-11-10", status: "approved" });

    expect(await alice.as.query(api.loans.navCounts, { today: TODAY })).toEqual({
      incomingPending: 2,
      myOverdue: 0,
    });
    expect(await bob.as.query(api.loans.navCounts, { today: TODAY })).toEqual({
      incomingPending: 0,
      myOverdue: 1,
    });
  });
});
