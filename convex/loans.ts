import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireAdmin, requireUser } from "./lib/auth";
import { assertClientToday, assertDate, rangesOverlap } from "./lib/dates";

// Lists are capped until they are paginated.
const LIST_LIMIT = 200;

export const request = mutation({
  args: { toolId: v.id("tools"), startDate: v.string(), endDate: v.string(), today: v.string() },
  handler: async (ctx, { toolId, startDate, endDate, today }) => {
    const me = await requireUser(ctx);
    assertClientToday(today, Date.now());
    assertDate(startDate, "startDate");
    assertDate(endDate, "endDate");
    if (startDate < today) throw new ConvexError("The start date cannot be in the past");
    if (endDate < startDate) throw new ConvexError("The end date cannot be before the start date");

    const tool = await ctx.db.get(toolId);
    if (!tool || tool.status !== "active") throw new ConvexError("Tool not found");
    if (tool.ownerId === me._id) throw new ConvexError("You cannot borrow your own tool");

    const range = { startDate, endDate };
    if ((await loansForTool(ctx, toolId, "approved")).some((loan) => rangesOverlap(loan, range))) {
      throw new ConvexError("The tool is already booked for some of these dates");
    }
    const pending = await loansForTool(ctx, toolId, "requested");
    if (pending.some((loan) => loan.borrowerId === me._id && rangesOverlap(loan, range))) {
      throw new ConvexError("You already requested this tool for some of these dates");
    }

    const loanId = await ctx.db.insert("loans", {
      toolId,
      borrowerId: me._id,
      lenderId: tool.ownerId,
      startDate,
      endDate,
      status: "requested",
    });
    await addEvent(ctx, loanId, "requested");
    return loanId;
  },
});

// Approving declines the other pending requests that overlap, because only one can happen.
export const approve = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const loan = await getLoanFor(ctx, loanId, "lender");
    assertStatus(loan, "requested");

    const approved = await loansForTool(ctx, loan.toolId, "approved");
    if (approved.some((other) => rangesOverlap(other, loan))) {
      throw new ConvexError("Another loan is already approved for some of these dates");
    }

    await ctx.db.patch(loanId, { status: "approved" });
    await addEvent(ctx, loanId, "approved");

    for (const other of await loansForTool(ctx, loan.toolId, "requested")) {
      if (other._id !== loanId && rangesOverlap(other, loan)) {
        await ctx.db.patch(other._id, { status: "declined" });
        await addEvent(ctx, other._id, "declined");
      }
    }
  },
});

export const decline = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const loan = await getLoanFor(ctx, loanId, "lender");
    assertStatus(loan, "requested");
    await ctx.db.patch(loanId, { status: "declined" });
    await addEvent(ctx, loanId, "declined");
  },
});

export const cancel = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const loan = await getLoanFor(ctx, loanId, "borrower");
    assertStatus(loan, "requested");
    await ctx.db.patch(loanId, { status: "cancelled" });
    await addEvent(ctx, loanId, "cancelled");
  },
});

// Only the lender marks a return, because only the lender knows that the tool is back.
export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const loan = await getLoanFor(ctx, loanId, "lender");
    assertStatus(loan, "approved");
    await ctx.db.patch(loanId, { status: "returned", returnedAt: Date.now() });
    await addEvent(ctx, loanId, "returned");
  },
});

// "My requests": the caller's loans as borrower. Shows the lender's name, never the email.
export const myRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", me._id))
      .order("desc")
      .take(LIST_LIMIT);
    return await Promise.all(
      loans.map(async (loan) => ({
        ...loanFields(loan),
        tool: await toolSummary(ctx, loan.toolId),
        lender: await personSummary(ctx, loan.lenderId),
      })),
    );
  },
});

// "Incoming requests": loans for the caller's tools. Shows the borrower's name, never the email.
export const incoming = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_lender", (q) => q.eq("lenderId", me._id))
      .order("desc")
      .take(LIST_LIMIT);
    return await Promise.all(
      loans.map(async (loan) => ({
        ...loanFields(loan),
        tool: await toolSummary(ctx, loan.toolId),
        borrower: await personSummary(ctx, loan.borrowerId),
      })),
    );
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const loans = await ctx.db.query("loans").order("desc").take(LIST_LIMIT);
    return await Promise.all(
      loans.map(async (loan) => ({
        ...loanFields(loan),
        tool: await toolSummary(ctx, loan.toolId),
        borrower: await personSummary(ctx, loan.borrowerId),
        lender: await personSummary(ctx, loan.lenderId),
      })),
    );
  },
});

async function getLoanFor(ctx: MutationCtx, loanId: Id<"loans">, role: "lender" | "borrower") {
  const me = await requireUser(ctx);
  const loan = await ctx.db.get(loanId);
  if (!loan) throw new ConvexError("Loan not found");
  const ownerId = role === "lender" ? loan.lenderId : loan.borrowerId;
  if (ownerId !== me._id) throw new ConvexError("Forbidden");
  return loan;
}

function assertStatus(loan: Doc<"loans">, expected: Doc<"loans">["status"]) {
  if (loan.status !== expected) {
    throw new ConvexError(`This loan is ${loan.status}, so this action is not possible`);
  }
}

async function loansForTool(ctx: QueryCtx, toolId: Id<"tools">, status: Doc<"loans">["status"]) {
  return await ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", status))
    .collect();
}

async function addEvent(ctx: MutationCtx, loanId: Id<"loans">, type: Doc<"loanEvents">["type"]) {
  await ctx.db.insert("loanEvents", { loanId, type, source: "user", at: Date.now() });
}

function loanFields(loan: Doc<"loans">) {
  return {
    _id: loan._id,
    _creationTime: loan._creationTime,
    startDate: loan.startDate,
    endDate: loan.endDate,
    status: loan.status,
    returnedAt: loan.returnedAt,
  };
}

async function toolSummary(ctx: QueryCtx, toolId: Id<"tools">) {
  const tool = await ctx.db.get(toolId);
  return { name: tool?.name ?? "Unknown tool", category: tool?.category ?? "other" };
}

async function personSummary(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  return { name: user?.name ?? "Unknown", trustedLender: user?.trustedLender ?? false };
}
