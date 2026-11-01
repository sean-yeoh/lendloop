import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { findUserByClerkId, getCurrentUser, requireUser } from "./lib/auth";
import { recordLoanEvent } from "./lib/events";

// Account deletion.
//
// The user row is anonymized, not deleted, because the other person's loan history refers to it.
// Clerk keeps no LendLoop data, so deleting the Clerk user removes the sign-in data.
//
// Users delete their account in LendLoop (deleteMyAccount). An approved loan that is not returned
// blocks deletion, on either side, because the tool still has to come back. Clerk's own delete
// button is turned off per user (convex/clerk.ts). A deletion in the Clerk Dashboard cannot be
// blocked, so the user.deleted webhook (convex/http.ts) closes the account without the check.

export const DELETED_NAME = "Deleted user";

/** What deleting the signed-in user's account would do, or why it is not possible yet. */
export const deletionStatus = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return null;
    const [blocking, listings, borrowing, lending] = await Promise.all([
      activeLoans(ctx, me),
      ctx.db
        .query("tools")
        .withIndex("by_owner_status", (q) => q.eq("ownerId", me._id).eq("status", "active"))
        .collect(),
      pendingAsBorrower(ctx, me),
      pendingAsLender(ctx, me),
    ]);
    return {
      blockingLoans: await Promise.all(
        blocking.map(async (loan) => {
          const asLender = loan.lenderId === me._id;
          const [tool, other] = await Promise.all([
            ctx.db.get(loan.toolId),
            ctx.db.get(asLender ? loan.borrowerId : loan.lenderId),
          ]);
          return {
            _id: loan._id,
            role: asLender ? ("lender" as const) : ("borrower" as const),
            toolName: tool?.name ?? "Unknown tool",
            otherName: other?.name ?? DELETED_NAME,
            startDate: loan.startDate,
            endDate: loan.endDate,
          };
        }),
      ),
      listingCount: listings.length,
      pendingRequestCount: borrowing.length + lending.length,
    };
  },
});

/** Deletes the signed-in user's account. The Clerk user is deleted right after, with retries. */
export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const blocking = await activeLoans(ctx, me);
    if (blocking.length > 0) {
      throw new ConvexError(
        `You have ${blocking.length} active ${blocking.length === 1 ? "loan" : "loans"}. ` +
          "All borrowed and lent tools must be returned before you can delete your account.",
      );
    }
    await closeAccount(ctx, me);
    await ctx.scheduler.runAfter(0, internal.clerk.deleteUser, { clerkUserId: me.clerkUserId });
  },
});

/** Called by the Clerk user.deleted webhook. Safe to repeat. */
export const closeDeletedClerkUser = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const user = await findUserByClerkId(ctx, clerkUserId);
    if (!user) return "unknown user" as const;
    if (user.deletedAt) return "already closed" as const;
    // Active loans stay as they are, so the other person can still mark the tool returned.
    await closeAccount(ctx, user);
    return "closed" as const;
  },
});

// Removes the user's listings, closes their pending requests, and removes their personal data.
async function closeAccount(ctx: MutationCtx, user: Doc<"users">) {
  const tools = await ctx.db
    .query("tools")
    .withIndex("by_owner_status", (q) => q.eq("ownerId", user._id).eq("status", "active"))
    .collect();
  for (const tool of tools) await ctx.db.patch(tool._id, { status: "removed" });

  // Each status change notifies the other person, as it does when they act themselves.
  for (const loan of await pendingAsLender(ctx, user)) {
    await ctx.db.patch(loan._id, { status: "declined" });
    await recordLoanEvent(ctx, loan._id, "declined");
  }
  for (const loan of await pendingAsBorrower(ctx, user)) {
    await ctx.db.patch(loan._id, { status: "cancelled" });
    await recordLoanEvent(ctx, loan._id, "cancelled");
  }

  // The Clerk user ID stays, so a repeated webhook and a sign-in with an old session are
  // recognized. It identifies no one once the Clerk user is deleted.
  await ctx.db.patch(user._id, {
    name: DELETED_NAME,
    email: "",
    role: "user",
    trustedLender: undefined,
    deletedAt: Date.now(),
  });
}

// Approved and not returned, as borrower or lender. Includes future and overdue loans.
async function activeLoans(ctx: QueryCtx, user: Doc<"users">) {
  const [borrowed, lent] = await Promise.all([
    ctx.db
      .query("loans")
      .withIndex("by_borrower_status_endDate", (q) =>
        q.eq("borrowerId", user._id).eq("status", "approved"),
      )
      .collect(),
    ctx.db
      .query("loans")
      .withIndex("by_lender_status", (q) => q.eq("lenderId", user._id).eq("status", "approved"))
      .collect(),
  ]);
  return [...borrowed, ...lent];
}

async function pendingAsBorrower(ctx: QueryCtx, user: Doc<"users">) {
  return await ctx.db
    .query("loans")
    .withIndex("by_borrower_status_endDate", (q) =>
      q.eq("borrowerId", user._id).eq("status", "requested"),
    )
    .collect();
}

async function pendingAsLender(ctx: QueryCtx, user: Doc<"users">) {
  return await ctx.db
    .query("loans")
    .withIndex("by_lender_status", (q) => q.eq("lenderId", user._id).eq("status", "requested"))
    .collect();
}
