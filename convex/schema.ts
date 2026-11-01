import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Fixed lists. Adding a value is a safe schema change. Removing one needs a data migration first.
export const toolCategory = v.union(
  v.literal("power_tools"),
  v.literal("hand_tools"),
  v.literal("garden"),
  v.literal("kitchen"),
  v.literal("camping"),
  v.literal("cleaning"),
  v.literal("ladders"),
  v.literal("other"),
);

export const toolCondition = v.union(
  v.literal("new"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("worn"),
);

// "removed" is a soft delete, so loan history keeps a valid tool reference.
export const toolStatus = v.union(v.literal("active"), v.literal("removed"));

// Overdue is not a status. It is calculated: approved and endDate before today.
export const loanStatus = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);

export const loanEventType = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
  v.literal("reminder_sent"),
);

export const loanEventSource = v.union(v.literal("user"), v.literal("n8n"));

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    // Set by admins only. A missing value means false.
    trustedLender: v.optional(v.boolean()),
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_email", ["email"]),

  // Availability is not stored here. It is calculated from approved loans.
  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: toolCategory,
    condition: toolCondition,
    description: v.string(),
    status: toolStatus,
  })
    .index("by_owner_status", ["ownerId", "status"])
    .index("by_status_category", ["status", "category"]),

  loans: defineTable({
    toolId: v.id("tools"),
    borrowerId: v.id("users"),
    // Copied from tools.ownerId when the request is created, for the incoming requests view.
    lenderId: v.id("users"),
    // Calendar dates as "YYYY-MM-DD". This format sorts and compares correctly as a string.
    startDate: v.string(),
    endDate: v.string(),
    status: loanStatus,
    // Set when the lender marks the loan returned. A value after endDate means a late return.
    returnedAt: v.optional(v.number()),
  })
    .index("by_tool_status", ["toolId", "status"])
    .index("by_borrower", ["borrowerId"])
    .index("by_borrower_status_endDate", ["borrowerId", "status", "endDate"])
    .index("by_lender", ["lenderId"])
    .index("by_lender_status", ["lenderId", "status"])
    .index("by_status_endDate", ["status", "endDate"]),

  loanEvents: defineTable({
    loanId: v.id("loans"),
    type: loanEventType,
    source: loanEventSource,
    at: v.number(),
  }).index("by_loan", ["loanId"]),
});
