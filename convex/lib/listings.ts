import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { recordLoanEvent } from "./events";

// Removing a listing. Shared by tools.remove and account deletion (convex/account.ts).

/** Approved loans that are not returned: in progress, overdue, or booked for later. */
export async function approvedLoansForTool(ctx: QueryCtx, toolId: Id<"tools">) {
  return await ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", "approved"))
    .collect();
}

/**
 * Soft-deletes a tool. Pending requests are declined. Approved bookings that start after `today`
 * are cancelled with the "withdrawn" event, so the borrower is told. Loans that have started stay,
 * because the tool must still come back. Every change notifies the borrower.
 */
export async function removeTool(ctx: MutationCtx, tool: Doc<"tools">, today: string) {
  await ctx.db.patch(tool._id, { status: "removed" });

  const pending = await ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) => q.eq("toolId", tool._id).eq("status", "requested"))
    .collect();
  for (const loan of pending) {
    await ctx.db.patch(loan._id, { status: "declined" });
    await recordLoanEvent(ctx, loan._id, "declined");
  }

  const future = (await approvedLoansForTool(ctx, tool._id)).filter(
    (loan) => loan.startDate > today,
  );
  for (const loan of future) {
    await ctx.db.patch(loan._id, { status: "cancelled" });
    await recordLoanEvent(ctx, loan._id, "withdrawn");
  }
}
