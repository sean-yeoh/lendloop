import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { findUserByClerkId, getCurrentUser, requireAdmin } from "./lib/auth";

// Lists are capped until they are paginated.
const LIST_LIMIT = 200;

/** Creates or updates the signed-in user's row from the verified Clerk token. */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not signed in");
    if (!identity.email) {
      // Claim names only, no values. Add the email claim in Clerk under Sessions > Customize session token.
      const claims = Object.keys(identity).join(", ");
      throw new ConvexError(`Clerk token has no email claim. Claims present: ${claims}`);
    }

    const email = identity.email.toLowerCase();
    // Names are shown to other users, so the fallback must not be the full email address.
    const name = identity.name?.trim() || identity.email.split("@")[0]!.split("+")[0]!;

    const existing = await findUserByClerkId(ctx, identity.subject);
    if (existing?.deletedAt) throw new ConvexError("This account was deleted");
    if (existing) {
      if (existing.email !== email || existing.name !== name) {
        await ctx.db.patch(existing._id, { email, name });
      }
      return existing._id;
    }
    const userId = await ctx.db.insert("users", {
      clerkUserId: identity.subject,
      email,
      name,
      role: "user",
    });
    // Account deletion goes through LendLoop, which checks for active loans first. See convex/account.ts.
    await ctx.scheduler.runAfter(0, internal.clerk.disableSelfDelete, {
      clerkUserId: identity.subject,
    });
    return userId;
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return { _id: user._id, name: user.name, email: user.email, role: user.role };
  },
});

async function getUserByEmail(ctx: MutationCtx, email: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
    .unique();
  if (!user)
    throw new ConvexError(`No user with email ${email}. The user must sign in once first.`);
  return user;
}

// Admin view of users. Names only, never emails: Trusted Lender decisions need no contact data.
export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = (await ctx.db.query("users").take(LIST_LIMIT)).filter((user) => !user.deletedAt);
    return await Promise.all(
      users.map(async (user) => {
        const tools = await ctx.db
          .query("tools")
          .withIndex("by_owner_status", (q) => q.eq("ownerId", user._id).eq("status", "active"))
          .take(LIST_LIMIT);
        return {
          _id: user._id,
          name: user.name,
          role: user.role,
          trustedLender: user.trustedLender ?? false,
          toolCount: tools.length,
        };
      }),
    );
  },
});

// Trusted Lender is a badge for borrowers. It changes no loan rules.
export const setTrustedLender = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user || user.deletedAt) throw new ConvexError("User not found");
    await ctx.db.patch(userId, { trustedLender: trusted });
  },
});

// Internal: callable only from the CLI, the dashboard, or other server functions.
export const grantAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await getUserByEmail(ctx, email);
    if (user.role === "admin") return "already admin";
    await ctx.db.patch(user._id, { role: "admin" });
    return "granted";
  },
});

export const revokeAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await getUserByEmail(ctx, email);
    if (user.role !== "admin") return "not admin";
    await ctx.db.patch(user._id, { role: "user" });
    return "revoked";
  },
});
