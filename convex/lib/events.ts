import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// Request events that n8n notifies a user about. Reminders come from n8n itself.
const NOTIFY: ReadonlySet<Doc<"loanEvents">["type"]> = new Set([
  "requested",
  "approved",
  "declined",
  "cancelled",
  "returned",
]);

// Records a user action on a loan. For notifying events, the outbox row is written in the same
// transaction, so a committed status change always has a notification queued.
export async function recordLoanEvent(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  type: Doc<"loanEvents">["type"],
) {
  const loanEventId = await ctx.db.insert("loanEvents", { loanId, type, source: "user", at: Date.now() });
  if (NOTIFY.has(type)) {
    const notificationId = await ctx.db.insert("notifications", {
      loanEventId,
      status: "pending",
      attempts: 0,
    });
    await ctx.scheduler.runAfter(0, internal.notifications.deliver, { notificationId });
  }
  return loanEventId;
}
