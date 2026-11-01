import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { assertClientToday } from "./lib/dates";

// Functions behind the signed n8n endpoints in http.ts. Internal, so only those endpoints call them.

const LIMIT = 200;

export function reminderKey(loanId: string, date: string) {
  return `reminder:${loanId}:${date}`;
}

// Overdue loans that have no reminder for `date` yet. Contains only what the reminder email needs.
export const overdueForReminders = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    assertClientToday(date, Date.now());
    const overdue = await ctx.db
      .query("loans")
      .withIndex("by_status_endDate", (q) => q.eq("status", "approved").lt("endDate", date))
      .take(LIMIT);

    const due = [];
    for (const loan of overdue) {
      const sent = await ctx.db
        .query("loanEvents")
        .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", reminderKey(loan._id, date)))
        .first();
      if (sent) continue;
      const [tool, borrower, lender] = await Promise.all([
        ctx.db.get(loan.toolId),
        ctx.db.get(loan.borrowerId),
        ctx.db.get(loan.lenderId),
      ]);
      if (!tool || !borrower || !lender) continue;
      due.push({
        loanId: loan._id,
        borrower: { name: borrower.name, email: borrower.email },
        lender: { name: lender.name },
        tool: { name: tool.name },
        endDate: loan.endDate,
        daysOverdue: Math.round((Date.parse(date) - Date.parse(loan.endDate)) / 86_400_000),
      });
    }
    return due;
  },
});

// Idempotent write-back: one reminder event per loan per day, however often n8n retries.
export const recordReminder = internalMutation({
  args: { loanId: v.string(), date: v.string() },
  handler: async (ctx, { loanId, date }) => {
    assertClientToday(date, Date.now());
    const id = ctx.db.normalizeId("loans", loanId);
    const loan = id && (await ctx.db.get(id));
    if (!id || !loan) return { status: 404 as const, error: "Loan not found" };

    const key = reminderKey(id, date);
    const existing = await ctx.db
      .query("loanEvents")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", key))
      .first();
    if (existing) return { status: 200 as const, created: false };

    await ctx.db.insert("loanEvents", {
      loanId: id,
      type: "reminder_sent",
      source: "n8n",
      at: Date.now(),
      idempotencyKey: key,
    });
    return { status: 201 as const, created: true };
  },
});
