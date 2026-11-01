/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import { signRequest } from "./lib/signature";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const TODAY = "2026-11-10";
const SECRET = "api-secret";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  vi.stubEnv("N8N_API_SECRET", SECRET);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// Bob borrowed Alice's drill. It was due two days ago.
async function scenario() {
  const t = convexTest(schema, modules);
  const loanId = await t.run(async (ctx) => {
    const alice = await ctx.db.insert("users", { clerkUserId: "a", email: "alice@example.com", name: "Alice", role: "user" });
    const bob = await ctx.db.insert("users", { clerkUserId: "b", email: "bob@example.com", name: "Bob", role: "user" });
    const toolId = await ctx.db.insert("tools", {
      ownerId: alice,
      name: "Cordless drill",
      category: "power_tools",
      condition: "good",
      description: "",
      status: "active",
    });
    await ctx.db.insert("loans", {
      toolId,
      borrowerId: alice,
      lenderId: bob,
      startDate: "2026-11-01",
      endDate: "2026-11-20",
      status: "approved",
    });
    return await ctx.db.insert("loans", {
      toolId,
      borrowerId: bob,
      lenderId: alice,
      startDate: "2026-11-01",
      endDate: "2026-11-08",
      status: "approved",
    });
  });
  return { t, loanId };
}

async function signedFetch(
  t: ReturnType<typeof convexTest>,
  method: "GET" | "POST",
  pathAndQuery: string,
  body = "",
  secret = SECRET,
) {
  const headers = await signRequest(secret, { method, pathAndQuery, body }, Date.now());
  return await t.fetch(pathAndQuery, { method, headers, ...(method === "POST" ? { body } : {}) });
}

describe("GET /n8n/overdue", () => {
  test("returns overdue loans with only the fields that the reminder needs", async () => {
    const { t, loanId } = await scenario();
    const response = await signedFetch(t, "GET", `/n8n/overdue?date=${TODAY}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        loanId,
        borrower: { name: "Bob", email: "bob@example.com" },
        lender: { name: "Alice" },
        tool: { name: "Cordless drill" },
        endDate: "2026-11-08",
        daysOverdue: 2,
      },
    ]);
  });

  test("rejects unsigned requests, the wrong secret, and a changed query", async () => {
    const { t } = await scenario();
    expect((await t.fetch(`/n8n/overdue?date=${TODAY}`)).status).toBe(401);
    expect((await signedFetch(t, "GET", `/n8n/overdue?date=${TODAY}`, "", "wrong")).status).toBe(401);

    const headers = await signRequest(SECRET, { method: "GET", pathAndQuery: `/n8n/overdue?date=${TODAY}`, body: "" }, Date.now());
    expect((await t.fetch("/n8n/overdue?date=2026-11-09", { headers })).status).toBe(401);
  });

  test("rejects a date that is not today", async () => {
    const { t } = await scenario();
    const response = await signedFetch(t, "GET", "/n8n/overdue?date=2026-10-01");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "today does not match the current date" });
  });
});

describe("POST /n8n/reminders", () => {
  test("records one reminder per loan per day, however often it is sent", async () => {
    const { t, loanId } = await scenario();
    const body = JSON.stringify({ loanId, date: TODAY });

    const first = await signedFetch(t, "POST", "/n8n/reminders", body);
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ created: true });

    const retry = await signedFetch(t, "POST", "/n8n/reminders", body);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ created: false });

    const events = await t.run((ctx) =>
      ctx.db
        .query("loanEvents")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId as Id<"loans">))
        .collect(),
    );
    expect(events).toMatchObject([{ type: "reminder_sent", source: "n8n" }]);

    // A reminded loan is not listed again on the same day.
    const overdue = await signedFetch(t, "GET", `/n8n/overdue?date=${TODAY}`);
    expect(await overdue.json()).toEqual([]);
  });

  test("rejects an unsigned request, bad JSON, and an unknown loan", async () => {
    const { t } = await scenario();
    const body = JSON.stringify({ loanId: "nope", date: TODAY });
    expect((await t.fetch("/n8n/reminders", { method: "POST", body })).status).toBe(401);
    expect((await signedFetch(t, "POST", "/n8n/reminders", "{not json")).status).toBe(400);
    expect((await signedFetch(t, "POST", "/n8n/reminders", JSON.stringify({ date: TODAY }))).status).toBe(400);
    expect((await signedFetch(t, "POST", "/n8n/reminders", body)).status).toBe(404);
  });

  test("returns 500 when the secret is not configured", async () => {
    vi.stubEnv("N8N_API_SECRET", "");
    const { t } = await scenario();
    expect((await t.fetch(`/n8n/overdue?date=${TODAY}`)).status).toBe(500);
  });
});
