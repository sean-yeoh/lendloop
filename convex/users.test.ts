/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { QueryCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const alice = { subject: "user_alice", email: "Alice@Example.com", name: "Alice" };

function setup() {
  return convexTest(schema, modules);
}

async function getUsers(t: ReturnType<typeof setup>) {
  return await t.run((ctx) => ctx.db.query("users").collect());
}

describe("ensureUser", () => {
  test("creates a user with the user role from the token", async () => {
    const t = setup();
    await t.withIdentity(alice).mutation(api.users.ensureUser, {});

    expect(await getUsers(t)).toMatchObject([
      { clerkUserId: "user_alice", email: "alice@example.com", name: "Alice", role: "user" },
    ]);
  });

  test("does not create a duplicate on a second call", async () => {
    const t = setup();
    const asAlice = t.withIdentity(alice);
    const firstId = await asAlice.mutation(api.users.ensureUser, {});
    const secondId = await asAlice.mutation(api.users.ensureUser, {});

    expect(secondId).toBe(firstId);
    expect(await getUsers(t)).toHaveLength(1);
  });

  test("updates email and name but keeps the role", async () => {
    const t = setup();
    await t.withIdentity(alice).mutation(api.users.ensureUser, {});
    await t.mutation(internal.users.grantAdmin, { email: "alice@example.com" });

    await t
      .withIdentity({ ...alice, email: "alice@new.example.com", name: "Alice B" })
      .mutation(api.users.ensureUser, {});

    expect(await getUsers(t)).toMatchObject([
      { email: "alice@new.example.com", name: "Alice B", role: "admin" },
    ]);
  });

  test("uses the email as the name when the token has no name", async () => {
    const t = setup();
    await t.withIdentity({ subject: "user_bob", email: "bob@example.com" }).mutation(api.users.ensureUser, {});

    expect(await getUsers(t)).toMatchObject([{ name: "bob@example.com" }]);
  });

  test("rejects a caller that is not signed in", async () => {
    const t = setup();
    await expect(t.mutation(api.users.ensureUser, {})).rejects.toThrow("Not signed in");
  });

  test("rejects a token without an email claim", async () => {
    const t = setup();
    await expect(
      t.withIdentity({ subject: "user_noemail" }).mutation(api.users.ensureUser, {}),
    ).rejects.toThrow("no email claim");
    expect(await getUsers(t)).toHaveLength(0);
  });
});

describe("me", () => {
  test("returns null when not signed in", async () => {
    const t = setup();
    expect(await t.query(api.users.me, {})).toBeNull();
  });

  test("returns the signed-in user with the role", async () => {
    const t = setup();
    const asAlice = t.withIdentity(alice);
    await asAlice.mutation(api.users.ensureUser, {});

    expect(await asAlice.query(api.users.me, {})).toMatchObject({
      email: "alice@example.com",
      role: "user",
    });
  });
});

describe("grantAdmin and revokeAdmin", () => {
  test("grant, grant again, revoke, revoke again", async () => {
    const t = setup();
    await t.withIdentity(alice).mutation(api.users.ensureUser, {});
    const args = { email: "ALICE@example.com" };

    expect(await t.mutation(internal.users.grantAdmin, args)).toBe("granted");
    expect(await t.mutation(internal.users.grantAdmin, args)).toBe("already admin");
    expect(await getUsers(t)).toMatchObject([{ role: "admin" }]);

    expect(await t.mutation(internal.users.revokeAdmin, args)).toBe("revoked");
    expect(await t.mutation(internal.users.revokeAdmin, args)).toBe("not admin");
    expect(await getUsers(t)).toMatchObject([{ role: "user" }]);
  });

  test("fail for an unknown email", async () => {
    const t = setup();
    await expect(
      t.mutation(internal.users.grantAdmin, { email: "nobody@example.com" }),
    ).rejects.toThrow("No user with email");
    await expect(
      t.mutation(internal.users.revokeAdmin, { email: "nobody@example.com" }),
    ).rejects.toThrow("No user with email");
  });
});

describe("requireAdmin", () => {
  const adminOnly = async (ctx: QueryCtx) => (await requireAdmin(ctx)).email;

  test("rejects a caller that is not signed in", async () => {
    const t = setup();
    await expect(t.query(adminOnly)).rejects.toThrow("Not signed in");
  });

  test("rejects a normal user", async () => {
    const t = setup();
    const asAlice = t.withIdentity(alice);
    await asAlice.mutation(api.users.ensureUser, {});
    await expect(asAlice.query(adminOnly)).rejects.toThrow("Forbidden");
  });

  test("accepts an admin", async () => {
    const t = setup();
    const asAlice = t.withIdentity(alice);
    await asAlice.mutation(api.users.ensureUser, {});
    await t.mutation(internal.users.grantAdmin, { email: "alice@example.com" });
    expect(await asAlice.query(adminOnly)).toBe("alice@example.com");
  });
});

describe("Trusted Lender", () => {
  async function adminAndBob(t: ReturnType<typeof setup>) {
    const asAdmin = t.withIdentity(alice);
    await asAdmin.mutation(api.users.ensureUser, {});
    await t.mutation(internal.users.grantAdmin, { email: "alice@example.com" });
    const asBob = t.withIdentity({ subject: "user_bob", email: "bob@example.com", name: "Bob" });
    const bobId = await asBob.mutation(api.users.ensureUser, {});
    return { asAdmin, asBob, bobId };
  }

  test("an admin marks and unmarks a Trusted Lender", async () => {
    const t = setup();
    const { asAdmin, bobId } = await adminAndBob(t);

    await asAdmin.mutation(api.users.setTrustedLender, { userId: bobId, trusted: true });
    expect((await t.run((ctx) => ctx.db.get(bobId)))?.trustedLender).toBe(true);
    await asAdmin.mutation(api.users.setTrustedLender, { userId: bobId, trusted: false });
    expect((await t.run((ctx) => ctx.db.get(bobId)))?.trustedLender).toBe(false);
  });

  test("a normal user cannot mark anyone, including themselves", async () => {
    const t = setup();
    const { asBob, bobId } = await adminAndBob(t);
    await expect(
      asBob.mutation(api.users.setTrustedLender, { userId: bobId, trusted: true }),
    ).rejects.toThrow("Forbidden");
  });

  test("listForAdmin returns names and tool counts, never emails, to admins only", async () => {
    const t = setup();
    const { asAdmin, asBob } = await adminAndBob(t);
    await asBob.mutation(api.tools.create, {
      name: "Rake",
      category: "garden",
      condition: "good",
      description: "",
    });

    const users = await asAdmin.query(api.users.listForAdmin, {});
    expect(users).toMatchObject([
      { name: "Alice", role: "admin", trustedLender: false, toolCount: 0 },
      { name: "Bob", role: "user", trustedLender: false, toolCount: 1 },
    ]);
    expect(JSON.stringify(users)).not.toContain("@example.com");
    await expect(asBob.query(api.users.listForAdmin, {})).rejects.toThrow("Forbidden");
  });
});
