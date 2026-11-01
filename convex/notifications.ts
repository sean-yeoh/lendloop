import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { signRequest } from "./lib/signature";

// Delays before each retry. After the last one, the notification is marked failed.
export const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const REQUEST_TIMEOUT_MS = 10_000;

// Who gets each notification, and which app page they can act on.
const RECIPIENTS: Record<string, { to: "lender" | "borrower"; path: string }> = {
  requested: { to: "lender", path: "/incoming" },
  cancelled: { to: "lender", path: "/incoming" },
  approved: { to: "borrower", path: "/requests" },
  declined: { to: "borrower", path: "/requests" },
  returned: { to: "borrower", path: "/requests" },
  withdrawn: { to: "borrower", path: "/requests" },
};

// The webhook body. Only the fields that the email needs: no IDs of other users, and only the
// recipient's email address.
export const payload = internalQuery({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const notification = await ctx.db.get(notificationId);
    if (!notification || notification.status !== "pending") return null;
    const event = await ctx.db.get(notification.loanEventId);
    const loan = event && (await ctx.db.get(event.loanId));
    const route = event && RECIPIENTS[event.type];
    if (!event || !loan || !route) return null;

    const [tool, borrower, lender] = await Promise.all([
      ctx.db.get(loan.toolId),
      ctx.db.get(loan.borrowerId),
      ctx.db.get(loan.lenderId),
    ]);
    const recipient = route.to === "lender" ? lender : borrower;
    const counterpart = route.to === "lender" ? borrower : lender;
    // A deleted account has no email address left to notify.
    if (!tool || !recipient || !counterpart || recipient.deletedAt) return null;

    return {
      // Stable per notification, so n8n can ignore a delivery that it already handled.
      id: notificationId,
      event: event.type,
      occurredAt: new Date(event.at).toISOString(),
      recipient: { name: recipient.name, email: recipient.email },
      counterpart: { name: counterpart.name },
      tool: { name: tool.name },
      loan: { startDate: loan.startDate, endDate: loan.endDate },
      path: route.path,
    };
  },
});

// Sends one notification to the n8n webhook, signed with N8N_NOTIFY_SECRET.
export const deliver = internalAction({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const body = await ctx.runQuery(internal.notifications.payload, { notificationId });
    if (!body) return;

    const url = process.env.N8N_NOTIFY_URL;
    const secret = process.env.N8N_NOTIFY_SECRET;
    let error: string | undefined;
    if (!url || !secret) {
      error = "N8N_NOTIFY_URL or N8N_NOTIFY_SECRET is not set on the Convex deployment";
    } else {
      try {
        const json = JSON.stringify(body);
        const target = new URL(url);
        const headers = await signRequest(
          secret,
          { method: "POST", pathAndQuery: target.pathname + target.search, body: json },
          Date.now(),
        );
        const response = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: json,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) error = `n8n responded with HTTP ${response.status}`;
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      }
    }
    await ctx.runMutation(internal.notifications.recordAttempt, { notificationId, error });
  },
});

export const recordAttempt = internalMutation({
  args: { notificationId: v.id("notifications"), error: v.optional(v.string()) },
  handler: async (ctx, { notificationId, error }) => {
    const notification = await ctx.db.get(notificationId);
    if (!notification || notification.status !== "pending") return;
    const attempts = notification.attempts + 1;

    if (error === undefined) {
      await ctx.db.patch(notificationId, {
        status: "sent",
        attempts,
        sentAt: Date.now(),
        lastError: undefined,
      });
      return;
    }
    if (attempts >= MAX_ATTEMPTS) {
      await ctx.db.patch(notificationId, { status: "failed", attempts, lastError: error });
      return;
    }
    await ctx.db.patch(notificationId, { attempts, lastError: error });
    await ctx.scheduler.runAfter(RETRY_DELAYS_MS[attempts - 1]!, internal.notifications.deliver, {
      notificationId,
    });
  },
});

// Admin view of deliveries that are retrying or failed. Event details only, no emails.
export const listProblems = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows: Doc<"notifications">[] = [];
    for (const status of ["failed", "pending"] as const) {
      rows.push(
        ...(await ctx.db
          .query("notifications")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .take(100)),
      );
    }
    const problems = rows.filter((row) => row.status === "failed" || row.attempts > 0);
    return await Promise.all(
      problems.map(async (row) => {
        const event = await ctx.db.get(row.loanEventId);
        const loan = event && (await ctx.db.get(event.loanId));
        const tool = loan && (await ctx.db.get(loan.toolId));
        return {
          _id: row._id,
          status: row.status,
          attempts: row.attempts,
          lastError: row.lastError ?? null,
          event: event?.type ?? "unknown",
          at: event?.at ?? row._creationTime,
          tool: tool?.name ?? "Unknown tool",
        };
      }),
    );
  },
});

// Lets an admin send a failed notification again, for example after n8n was down.
export const retry = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    await requireAdmin(ctx);
    const notification = await ctx.db.get(notificationId);
    if (!notification) throw new ConvexError("Notification not found");
    await ctx.db.patch(notificationId, { status: "pending", attempts: 0, lastError: undefined });
    await ctx.scheduler.runAfter(0, internal.notifications.deliver, { notificationId });
  },
});
