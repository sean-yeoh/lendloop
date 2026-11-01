/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { verifyRequest } from "./lib/signature";
import { MAX_ATTEMPTS } from "./notifications";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const TODAY = "2026-11-10";
const URL_ = "http://n8n.test/webhook/lendloop-notify";
const SECRET = "notify-secret";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  vi.stubEnv("N8N_NOTIFY_URL", URL_);
  vi.stubEnv("N8N_NOTIFY_SECRET", SECRET);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function scenario() {
  const t = convexTest(schema, modules);
  const add = (key: string, role: Doc<"users">["role"] = "user") =>
    t.run((ctx) =>
      ctx.db.insert("users", { clerkUserId: `user_${key}`, email: `${key}@example.com`, name: key, role }),
    );
  await add("alice");
  await add("bob");
  await add("admin", "admin");
  const alice = t.withIdentity({ subject: "user_alice" });
  const bob = t.withIdentity({ subject: "user_bob" });
  const admin = t.withIdentity({ subject: "user_admin" });
  const toolId = await alice.mutation(api.tools.create, {
    name: "Cordless drill",
    category: "power_tools",
    condition: "good",
    description: "",
  });
  const request = () =>
    bob.mutation(api.loans.request, { toolId, startDate: "2026-11-12", endDate: "2026-11-14", today: TODAY });
  return { t, alice, bob, admin, request };
}

function stubFetch(...statuses: number[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL | string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      const status = statuses[Math.min(calls.length - 1, statuses.length - 1)]!;
      return new Response("", { status });
    }),
  );
  return calls;
}

const notifications = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query("notifications").collect());

describe("notification delivery", () => {
  test("sends a signed payload to n8n with only the recipient's email", async () => {
    const { t, request } = await scenario();
    const calls = stubFetch(200);

    await request();
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(calls).toHaveLength(1);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({
      event: "requested",
      recipient: { name: "alice", email: "alice@example.com" },
      counterpart: { name: "bob" },
      tool: { name: "Cordless drill" },
      loan: { startDate: "2026-11-12", endDate: "2026-11-14" },
      path: "/incoming",
    });
    expect(JSON.stringify(body)).not.toContain("bob@example.com");

    const verified = await verifyRequest(
      SECRET,
      {
        method: "POST",
        pathAndQuery: "/webhook/lendloop-notify",
        body: String(calls[0]!.init.body),
        headers: new Headers(calls[0]!.init.headers as Record<string, string>),
      },
      Date.now(),
    );
    expect(verified).toEqual({ ok: true });
    expect(await notifications(t)).toMatchObject([{ status: "sent", attempts: 1 }]);
  });

  test("notifies the borrower when the lender approves", async () => {
    const { t, alice, request } = await scenario();
    const calls = stubFetch(200);
    const loanId = await request();
    await alice.mutation(api.loans.approve, { loanId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const sent = calls.map((call) => JSON.parse(String(call.init.body)));
    expect(sent.map((body) => [body.event, body.recipient.email])).toEqual([
      ["requested", "alice@example.com"],
      ["approved", "bob@example.com"],
    ]);
  });

  test("retries when n8n fails, then succeeds", async () => {
    const { t, request } = await scenario();
    const calls = stubFetch(503, 503, 200);

    await request();
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(calls).toHaveLength(3);
    expect(await notifications(t)).toMatchObject([{ status: "sent", attempts: 3 }]);
  });

  test("marks the notification failed after the last attempt, and keeps the error", async () => {
    const { t, request } = await scenario();
    const calls = stubFetch(500);

    await request();
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(calls).toHaveLength(MAX_ATTEMPTS);
    expect(await notifications(t)).toMatchObject([
      { status: "failed", attempts: MAX_ATTEMPTS, lastError: "n8n responded with HTTP 500" },
    ]);
  });

  test("fails visibly when the webhook is not configured", async () => {
    vi.stubEnv("N8N_NOTIFY_URL", "");
    const { t, request } = await scenario();
    const calls = stubFetch(200);

    await request();
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(calls).toHaveLength(0);
    expect(await notifications(t)).toMatchObject([
      { status: "failed", lastError: "N8N_NOTIFY_URL or N8N_NOTIFY_SECRET is not set on the Convex deployment" },
    ]);
  });
});

describe("admin view", () => {
  test("lists failed notifications and retries them, for admins only", async () => {
    const { t, bob, admin, request } = await scenario();
    stubFetch(500);
    await request();
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const [failed] = await admin.query(api.notifications.listProblems, {});
    expect(failed).toMatchObject({ status: "failed", event: "requested", tool: "Cordless drill" });
    await expect(bob.query(api.notifications.listProblems, {})).rejects.toThrow("Forbidden");
    await expect(bob.mutation(api.notifications.retry, { notificationId: failed!._id })).rejects.toThrow(
      "Forbidden",
    );

    const calls = stubFetch(200);
    await admin.mutation(api.notifications.retry, { notificationId: failed!._id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(calls).toHaveLength(1);
    expect(await notifications(t)).toMatchObject([{ status: "sent" }]);
  });
});
