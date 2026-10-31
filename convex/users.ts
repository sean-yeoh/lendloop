import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

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
    const name = identity.name ?? email;

    const existing = await getCurrentUser(ctx);
    if (existing) {
      if (existing.email !== email || existing.name !== name) {
        await ctx.db.patch(existing._id, { email, name });
      }
      return existing._id;
    }
    return await ctx.db.insert("users", {
      clerkUserId: identity.subject,
      email,
      name,
      role: "user",
    });
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
  if (!user) throw new ConvexError(`No user with email ${email}. The user must sign in once first.`);
  return user;
}

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
