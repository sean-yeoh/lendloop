import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { assertDate } from "./lib/dates";

// Development data. Run with `pnpm seed`, which creates the Clerk test users first.
// Internal, so only the CLI with deployment access can call it. Safe to run more than once.

type SeedTool = Pick<Doc<"tools">, "name" | "category" | "condition" | "description">;

// The tools for each seed user, by position in the `users` argument.
const toolsByOwner: SeedTool[][] = [
  [
    {
      name: "Cordless drill",
      category: "power_tools",
      condition: "good",
      description: "18V with two batteries and a charger. Drill bits included.",
    },
    {
      name: "Circular saw",
      category: "power_tools",
      condition: "fair",
      description: "7¼ inch blade. Works well, the guard is a bit stiff.",
    },
    {
      name: "Extension ladder",
      category: "ladders",
      condition: "good",
      description: "6 metres. Fits on a car roof rack.",
    },
    {
      name: "Pressure washer",
      category: "cleaning",
      condition: "new",
      description: "Electric, 130 bar. Patio cleaner attachment included.",
    },
  ],
  [
    {
      name: "Lawn mower",
      category: "garden",
      condition: "good",
      description: "Petrol, self-propelled. Please return it with some fuel.",
    },
    {
      name: "Hedge trimmer",
      category: "garden",
      condition: "worn",
      description: "Cordless. The battery lasts about 30 minutes.",
    },
    {
      name: "Socket set",
      category: "hand_tools",
      condition: "good",
      description: "94 pieces, metric and imperial, in a case.",
    },
    {
      name: "Stand mixer",
      category: "kitchen",
      condition: "good",
      description: "5 litre bowl with whisk, dough hook, and paddle.",
    },
  ],
  [
    {
      name: "Two-person tent",
      category: "camping",
      condition: "good",
      description: "Waterproof, sets up in 10 minutes. Pegs and footprint included.",
    },
    {
      name: "Camping stove",
      category: "camping",
      condition: "fair",
      description: "Double burner. Gas canisters not included.",
    },
    {
      name: "Step ladder",
      category: "ladders",
      condition: "new",
      description: "Five steps, aluminium, folds flat.",
    },
    {
      name: "Carpet cleaner",
      category: "cleaning",
      condition: "fair",
      description: "Upright, with a hose for stairs and car seats.",
    },
  ],
];

// Loans between seed users, by position in the `users` argument. Days are relative to `today`.
// Together they cover every status, an overdue loan, a late return, and overlapping requests.
type SeedLoan = {
  borrower: number;
  lender: number;
  tool: string;
  from: number;
  to: number;
  status: Doc<"loans">["status"];
  returnedDay?: number;
  reminders?: number[];
};

const seedLoans: SeedLoan[] = [
  // Waiting for Alice's answer. The two requests overlap, so approving one declines the other.
  { borrower: 1, lender: 0, tool: "Circular saw", from: 5, to: 7, status: "requested" },
  { borrower: 2, lender: 0, tool: "Circular saw", from: 6, to: 8, status: "requested" },
  // On loan now, and booked in the future.
  { borrower: 2, lender: 1, tool: "Lawn mower", from: -2, to: 3, status: "approved" },
  { borrower: 0, lender: 2, tool: "Two-person tent", from: 10, to: 14, status: "approved" },
  // Overdue, with daily reminders from n8n.
  {
    borrower: 1,
    lender: 2,
    tool: "Step ladder",
    from: -10,
    to: -3,
    status: "approved",
    reminders: [-2, -1],
  },
  { borrower: 0, lender: 1, tool: "Socket set", from: -6, to: -1, status: "approved" },
  // History.
  {
    borrower: 2,
    lender: 0,
    tool: "Pressure washer",
    from: -20,
    to: -15,
    status: "returned",
    returnedDay: -15,
  },
  {
    borrower: 0,
    lender: 1,
    tool: "Hedge trimmer",
    from: -14,
    to: -10,
    status: "returned",
    returnedDay: -8,
  },
  { borrower: 2, lender: 0, tool: "Extension ladder", from: 2, to: 3, status: "declined" },
  { borrower: 1, lender: 2, tool: "Camping stove", from: 4, to: 5, status: "cancelled" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export const run = internalMutation({
  args: {
    users: v.array(v.object({ clerkUserId: v.string(), email: v.string(), name: v.string() })),
    // The caller's local date, so the loan dates match what the app shows as today.
    today: v.string(),
  },
  handler: async (ctx, { users, today }) => {
    assertDate(today, "today");
    let usersCreated = 0;
    let usersUpdated = 0;
    let toolsCreated = 0;
    const userIds: Id<"users">[] = [];

    for (const [index, seedUser] of users.entries()) {
      let userId: Id<"users">;
      const existing = await ctx.db
        .query("users")
        .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", seedUser.clerkUserId))
        .unique();
      if (existing) {
        userId = existing._id;
        // Update the name from the seed list. Never change the role.
        if (existing.name !== seedUser.name) {
          await ctx.db.patch(userId, { name: seedUser.name });
          usersUpdated++;
        }
      } else {
        userId = await ctx.db.insert("users", {
          ...seedUser,
          email: seedUser.email.toLowerCase(),
          role: "user",
        });
        usersCreated++;
      }
      userIds.push(userId);

      const owned = await ctx.db
        .query("tools")
        .withIndex("by_owner_status", (q) => q.eq("ownerId", userId).eq("status", "active"))
        .collect();
      const ownedNames = new Set(owned.map((tool) => tool.name));
      for (const tool of toolsByOwner[index] ?? []) {
        if (ownedNames.has(tool.name)) continue;
        await ctx.db.insert("tools", { ...tool, ownerId: userId, status: "active" });
        toolsCreated++;
      }
    }

    const loansCreated = await reseedLoans(ctx, userIds, today);
    return { usersCreated, usersUpdated, toolsCreated, loansCreated };
  },
});

// Replaces the loans between seed users, so the dates stay relative to today on every run.
// Loans that involve any other user are never changed.
async function reseedLoans(ctx: MutationCtx, userIds: Id<"users">[], today: string) {
  const seedUserIds = new Set(userIds);
  for (const userId of userIds) {
    const borrowed = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", userId))
      .collect();
    for (const loan of borrowed) {
      if (!seedUserIds.has(loan.lenderId)) continue;
      const events = await ctx.db
        .query("loanEvents")
        .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
        .collect();
      for (const event of events) await ctx.db.delete(event._id);
      await ctx.db.delete(loan._id);
    }
  }

  const todayMs = Date.parse(today);
  const day = (offset: number) => new Date(todayMs + offset * DAY_MS).toISOString().slice(0, 10);
  // Noon UTC on the given day, for event and return timestamps.
  const at = (offset: number) => todayMs + offset * DAY_MS + DAY_MS / 2;

  let created = 0;
  for (const seed of seedLoans) {
    const borrowerId = userIds[seed.borrower];
    const lenderId = userIds[seed.lender];
    if (!borrowerId || !lenderId) continue;
    const tool = await ctx.db
      .query("tools")
      .withIndex("by_owner_status", (q) => q.eq("ownerId", lenderId).eq("status", "active"))
      .filter((q) => q.eq(q.field("name"), seed.tool))
      .first();
    // The tester may have removed a seed tool. Skip its loans.
    if (!tool) continue;

    const loanId = await ctx.db.insert("loans", {
      toolId: tool._id,
      borrowerId,
      lenderId,
      startDate: day(seed.from),
      endDate: day(seed.to),
      status: seed.status,
      ...(seed.returnedDay !== undefined ? { returnedAt: at(seed.returnedDay) } : {}),
    });
    created++;

    const requestedDay = Math.min(seed.from, 0) - 3;
    const events: { type: Doc<"loanEvents">["type"]; source: "user" | "n8n"; day: number }[] = [
      { type: "requested", source: "user", day: requestedDay },
    ];
    if (seed.status !== "requested") {
      const answer = seed.status === "returned" ? "approved" : seed.status;
      events.push({ type: answer, source: "user", day: requestedDay + 1 });
    }
    for (const reminderDay of seed.reminders ?? []) {
      events.push({ type: "reminder_sent", source: "n8n", day: reminderDay });
    }
    if (seed.returnedDay !== undefined) {
      events.push({ type: "returned", source: "user", day: seed.returnedDay });
    }
    for (const event of events) {
      await ctx.db.insert("loanEvents", {
        loanId,
        type: event.type,
        source: event.source,
        at: at(event.day),
      });
    }
  }
  return created;
}
