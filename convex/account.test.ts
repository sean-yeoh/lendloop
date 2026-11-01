/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { MAX_ATTEMPTS } from "./notifications";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const TODAY = "2026-11-10";
const CLERK_KEY = "sk_test_unit";
// Standard Webhooks secret format: "whsec_" and a base64 key.
const WEBHOOK_SECRET = `whsec_${btoa("unit-test-webhook-key-32-bytes!!")}`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  vi.stubEnv("CLERK_SECRET_KEY", CLERK_KEY);
  vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", WEBHOOK_SECRET);
  vi.stubEnv("N8N_NOTIFY_URL", "http://n8n.test/webhook/lendloop-notify");
  vi.stubEnv("N8N_NOTIFY_SECRET", "notify-secret");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Records outgoing requests. Clerk answers with the given statuses in order, n8n always with 200.
function stubFetch(...clerkStatuses: number[]) {
  const clerkCalls: { url: string; method: string; headers: Headers; body: string | null }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL | string, init: RequestInit = {}) => {
      if (!String(url).startsWith("https://api.clerk.com/"))
        return new Response("", { status: 200 });
      clerkCalls.push({
        url: String(url),
        method: init.method ?? "GET",
        headers: new Headers(init.headers),
        body: typeof init.body === "string" ? init.body : null,
      });
      const status =
        clerkStatuses[Math.min(clerkCalls.length - 1, clerkStatuses.length - 1)] ?? 200;
      return new Response("", { status });
    }),
  );
  return clerkCalls;
}

// Alice lends a drill and a ladder. Bob and Carol borrow.
async function scenario() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = (key: string, extra: Partial<Doc<"users">> = {}) =>
      ctx.db.insert("users", {
        clerkUserId: `user_${key}`,
        email: `${key}@example.com`,
        name: key,
        role: "user",
        ...extra,
      });
    const alice = await user("alice", { trustedLender: true });
    const bob = await user("bob");
    const carol = await user("carol");
    const tool = (name: string, ownerId: Id<"users">) =>
      ctx.db.insert("tools", {
        ownerId,
        name,
        category: "power_tools",
        condition: "good",
        description: "",
        status: "active",
      });
    return {
      alice,
      bob,
      carol,
      drill: await tool("Cordless drill", alice),
      ladder: await tool("Ladder", alice),
      saw: await tool("Saw", carol),
    };
  });
  const loan = (fields: Pick<Doc<"loans">, "toolId" | "borrowerId" | "lenderId" | "status">) =>
    t.run((ctx) =>
      ctx.db.insert("loans", { startDate: "2026-11-12", endDate: "2026-11-14", ...fields }),
    );
  return {
    t,
    ...ids,
    loan,
    asAlice: t.withIdentity({ subject: "user_alice" }),
    asBob: t.withIdentity({ subject: "user_bob" }),
  };
}

const getDoc = <T extends "users" | "tools" | "loans">(
  t: ReturnType<typeof convexTest>,
  id: Id<T>,
) => t.run((ctx) => ctx.db.get(id)) as Promise<Doc<T>>;

describe("deletionStatus", () => {
  test("lists approved loans on both sides as blocking, with names only", async () => {
    const s = await scenario();
    const lent = await s.loan({
      toolId: s.drill,
      borrowerId: s.bob,
      lenderId: s.alice,
      status: "approved",
    });
    const borrowed = await s.loan({
      toolId: s.saw,
      borrowerId: s.alice,
      lenderId: s.carol,
      status: "approved",
    });
    await s.loan({ toolId: s.ladder, borrowerId: s.bob, lenderId: s.alice, status: "requested" });
    await s.loan({ toolId: s.drill, borrowerId: s.carol, lenderId: s.alice, status: "returned" });

    const status = await s.asAlice.query(api.account.deletionStatus, {});

    expect(status).toEqual({
      blockingLoans: expect.arrayContaining([
        {
          _id: lent,
          role: "lender",
          toolName: "Cordless drill",
          otherName: "bob",
          startDate: "2026-11-12",
          endDate: "2026-11-14",
        },
        {
          _id: borrowed,
          role: "borrower",
          toolName: "Saw",
          otherName: "carol",
          startDate: "2026-11-12",
          endDate: "2026-11-14",
        },
      ]),
      listingCount: 2,
      pendingRequestCount: 1,
    });
    expect(status!.blockingLoans).toHaveLength(2);
    expect(JSON.stringify(status)).not.toContain("@example.com");
  });

  test("returns null when signed out", async () => {
    const s = await scenario();
    expect(await s.t.query(api.account.deletionStatus, {})).toBeNull();
  });
});

describe("deleteMyAccount", () => {
  test.each(["lender", "borrower"] as const)(
    "is refused while the user is the %s on an approved loan",
    async (role) => {
      const s = await scenario();
      stubFetch();
      await s.loan(
        role === "lender"
          ? { toolId: s.drill, borrowerId: s.bob, lenderId: s.alice, status: "approved" }
          : { toolId: s.saw, borrowerId: s.alice, lenderId: s.carol, status: "approved" },
      );

      await expect(s.asAlice.mutation(api.account.deleteMyAccount, {})).rejects.toThrow(
        /1 active loan/,
      );
      expect(await getDoc(s.t, s.alice)).toMatchObject({
        name: "alice",
        email: "alice@example.com",
      });
    },
  );

  test("removes listings, closes pending requests, anonymizes the user, and deletes the Clerk user", async () => {
    const s = await scenario();
    const clerkCalls = stubFetch(200);
    const incoming = await s.loan({
      toolId: s.drill,
      borrowerId: s.bob,
      lenderId: s.alice,
      status: "requested",
    });
    const outgoing = await s.loan({
      toolId: s.saw,
      borrowerId: s.alice,
      lenderId: s.carol,
      status: "requested",
    });
    const history = await s.loan({
      toolId: s.ladder,
      borrowerId: s.bob,
      lenderId: s.alice,
      status: "returned",
    });

    await s.asAlice.mutation(api.account.deleteMyAccount, {});
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);

    const alice = await getDoc(s.t, s.alice);
    expect(alice).toMatchObject({
      name: "Deleted user",
      email: "",
      role: "user",
      deletedAt: expect.any(Number),
    });
    expect(alice.trustedLender).toBeUndefined();
    expect((await getDoc(s.t, s.drill)).status).toBe("removed");
    expect((await getDoc(s.t, s.ladder)).status).toBe("removed");
    expect((await getDoc(s.t, s.saw)).status).toBe("active");
    expect((await getDoc(s.t, incoming)).status).toBe("declined");
    expect((await getDoc(s.t, outgoing)).status).toBe("cancelled");
    expect((await getDoc(s.t, history)).status).toBe("returned");

    expect(clerkCalls).toHaveLength(1);
    expect(clerkCalls[0]).toMatchObject({
      url: "https://api.clerk.com/v1/users/user_alice",
      method: "DELETE",
    });
    expect(clerkCalls[0]!.headers.get("Authorization")).toBe(`Bearer ${CLERK_KEY}`);

    // Bob's history now shows the anonymized name.
    const bobsRequests = await s.asBob.query(api.loans.myRequests, {});
    expect(bobsRequests.find((loan) => loan._id === history)).toMatchObject({
      lender: { name: "Deleted user" },
    });
  });

  test("notifies the other person of each closed request, but nothing goes to the deleted user", async () => {
    const s = await scenario();
    stubFetch(200);
    await s.loan({ toolId: s.drill, borrowerId: s.bob, lenderId: s.alice, status: "requested" });
    await s.loan({ toolId: s.saw, borrowerId: s.alice, lenderId: s.carol, status: "requested" });

    await s.asAlice.mutation(api.account.deleteMyAccount, {});
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);

    const n8nBodies = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => !String(url).startsWith("https://api.clerk.com/"))
      .map(([, init]) => JSON.parse(String(init!.body)));
    expect(n8nBodies.map((body) => [body.event, body.recipient.email]).toSorted()).toEqual([
      ["cancelled", "carol@example.com"],
      ["declined", "bob@example.com"],
    ]);
    expect(n8nBodies.every((body) => body.counterpart.name === "Deleted user")).toBe(true);
  });

  test("retries the Clerk deletion, then stops after the last attempt", async () => {
    const s = await scenario();
    const clerkCalls = stubFetch(500);

    await s.asAlice.mutation(api.account.deleteMyAccount, {});
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(clerkCalls).toHaveLength(MAX_ATTEMPTS);
  });

  test("treats a Clerk user that no longer exists as deleted", async () => {
    const s = await scenario();
    const clerkCalls = stubFetch(404);

    await s.asAlice.mutation(api.account.deleteMyAccount, {});
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(clerkCalls).toHaveLength(1);
  });

  test("signs the user out of LendLoop: queries see no user and ensureUser is refused", async () => {
    const s = await scenario();
    stubFetch(200);
    await s.asAlice.mutation(api.account.deleteMyAccount, {});

    expect(await s.asAlice.query(api.users.me, {})).toBeNull();
    await expect(
      s.t
        .withIdentity({ subject: "user_alice", email: "alice@example.com", name: "Alice" })
        .mutation(api.users.ensureUser, {}),
    ).rejects.toThrow(/deleted/);
    await expect(s.asAlice.mutation(api.account.deleteMyAccount, {})).rejects.toThrow(
      /Not signed in/,
    );
    expect(await getDoc(s.t, s.alice)).toMatchObject({ name: "Deleted user", email: "" });
  });
});

describe("ensureUser and Clerk self-deletion", () => {
  test("turns off Clerk's own Delete account for a new user", async () => {
    const t = convexTest(schema, modules);
    const clerkCalls = stubFetch(200);

    await t
      .withIdentity({ subject: "user_dana", email: "dana@example.com", name: "Dana" })
      .mutation(api.users.ensureUser, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(clerkCalls).toHaveLength(1);
    expect(clerkCalls[0]).toMatchObject({
      url: "https://api.clerk.com/v1/users/user_dana",
      method: "PATCH",
    });
    expect(JSON.parse(clerkCalls[0]!.body!)).toEqual({ delete_self_enabled: false });
  });

  test("does nothing without CLERK_SECRET_KEY", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "");
    const t = convexTest(schema, modules);
    const clerkCalls = stubFetch(200);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await t
      .withIdentity({ subject: "user_dana", email: "dana@example.com", name: "Dana" })
      .mutation(api.users.ensureUser, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(clerkCalls).toHaveLength(0);
  });
});

// Signs a body the way Clerk does (Standard Webhooks): base64 HMAC-SHA256 of "id.timestamp.body",
// keyed with the base64-decoded secret after "whsec_".
async function clerkWebhook(
  t: ReturnType<typeof convexTest>,
  event: object,
  { secret = WEBHOOK_SECRET, sentAt = Date.now() } = {},
) {
  const body = JSON.stringify(event);
  const id = "msg_unit";
  const timestamp = String(Math.floor(sentAt / 1000));
  const keyBytes = Uint8Array.from(atob(secret.slice("whsec_".length)), (char) =>
    char.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return await t.fetch("/clerk/webhook", {
    method: "POST",
    headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` },
    body,
  });
}

const userDeleted = (id: string) => ({
  type: "user.deleted",
  object: "event",
  data: { id, object: "user", deleted: true },
});

describe("POST /clerk/webhook", () => {
  test("user.deleted closes the account, even with an active loan, and is safe to repeat", async () => {
    const s = await scenario();
    stubFetch(200);
    const active = await s.loan({
      toolId: s.drill,
      borrowerId: s.bob,
      lenderId: s.alice,
      status: "approved",
    });
    const pending = await s.loan({
      toolId: s.ladder,
      borrowerId: s.bob,
      lenderId: s.alice,
      status: "requested",
    });

    const first = await clerkWebhook(s.t, userDeleted("user_alice"));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ result: "closed" });

    expect(await getDoc(s.t, s.alice)).toMatchObject({ name: "Deleted user", email: "" });
    expect((await getDoc(s.t, s.drill)).status).toBe("removed");
    expect((await getDoc(s.t, pending)).status).toBe("declined");
    // The active loan stays, so Bob's return can still be recorded.
    expect((await getDoc(s.t, active)).status).toBe("approved");

    const again = await clerkWebhook(s.t, userDeleted("user_alice"));
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ result: "already closed" });
  });

  test("acknowledges an unknown user and other event types", async () => {
    const s = await scenario();
    expect(await (await clerkWebhook(s.t, userDeleted("user_nobody"))).json()).toEqual({
      result: "unknown user",
    });
    const other = await clerkWebhook(s.t, {
      type: "user.updated",
      object: "event",
      data: { id: "user_alice" },
    });
    expect(other.status).toBe(200);
    expect(await other.json()).toEqual({ ignored: "user.updated" });
    expect(await getDoc(s.t, s.alice)).toMatchObject({ name: "alice" });
  });

  test("rejects a wrong signature and an unsigned request", async () => {
    const s = await scenario();
    const wrong = await clerkWebhook(s.t, userDeleted("user_alice"), {
      secret: `whsec_${btoa("some-other-key-of-32-bytes-long!")}`,
    });
    expect(wrong.status).toBe(400);
    const unsigned = await s.t.fetch("/clerk/webhook", {
      method: "POST",
      body: JSON.stringify(userDeleted("user_alice")),
    });
    expect(unsigned.status).toBe(400);
    expect(await getDoc(s.t, s.alice)).toMatchObject({ name: "alice", email: "alice@example.com" });
  });

  test("rejects a replayed request older than five minutes", async () => {
    const s = await scenario();
    const response = await clerkWebhook(s.t, userDeleted("user_alice"), {
      sentAt: Date.now() - 10 * 60_000,
    });
    expect(response.status).toBe(400);
    expect(await getDoc(s.t, s.alice)).toMatchObject({ name: "alice" });
  });

  test("returns 500 when the signing secret is not set", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", "");
    const s = await scenario();
    const response = await clerkWebhook(s.t, userDeleted("user_alice"));
    expect(response.status).toBe(500);
  });
});
