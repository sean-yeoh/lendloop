import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getCurrentUser, requireUser } from "./lib/auth";
import { assertDate } from "./lib/dates";
import { recordLoanEvent } from "./lib/events";
import { DESCRIPTION_MAX, NAME_MAX } from "./lib/limits";
import { toolCategory, toolCondition } from "./schema";

// Lists are capped until they are paginated.
const LIST_LIMIT = 200;

// nextBookedFrom: the start of the earliest approved loan that begins after today, if any.
export type Availability =
  | { state: "available"; nextBookedFrom?: string }
  | { state: "on_loan"; until: string }
  | { state: "overdue"; since: string };

// Public page: name and category only. No IDs, owners, or availability.
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_status_category", (q) => q.eq("status", "active"))
      .take(LIST_LIMIT);
    return tools.map((tool) => ({ name: tool.name, category: tool.category }));
  },
});

// "today" comes from the client in its local time zone. Convex does not re-run a query when
// Date.now() changes, and a date argument changes only once a day, so caching stays effective.
export const list = query({
  args: { today: v.string(), category: v.optional(toolCategory) },
  handler: async (ctx, { today, category }) => {
    // Signed-out callers get no data, not an error. On sign-out, the Convex client re-runs open
    // queries without a token before the page can skip them.
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    assertDate(today, "today");

    const tools = await ctx.db
      .query("tools")
      .withIndex("by_status_category", (q) =>
        category === undefined
          ? q.eq("status", "active")
          : q.eq("status", "active").eq("category", category),
      )
      .take(LIST_LIMIT);

    const owners = new Map<Id<"users">, Doc<"users"> | null>();
    return await Promise.all(
      tools.map(async (tool) => {
        if (!owners.has(tool.ownerId)) owners.set(tool.ownerId, await ctx.db.get(tool.ownerId));
        const owner = owners.get(tool.ownerId);
        return {
          ...toolFields(tool),
          isMine: tool.ownerId === me._id,
          // Signed-in users see the owner's name and Trusted Lender badge, never the email.
          owner: { name: owner?.name ?? "Unknown", trustedLender: owner?.trustedLender ?? false },
          availability: await getAvailability(ctx, tool._id, today),
        };
      }),
    );
  },
});

export const mine = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    // Signed-out callers get no data, not an error. On sign-out, the Convex client re-runs open
    // queries without a token before the page can skip them.
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    assertDate(today, "today");

    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner_status", (q) => q.eq("ownerId", me._id).eq("status", "active"))
      .take(LIST_LIMIT);
    return await Promise.all(
      tools.map(async (tool) => ({
        ...toolFields(tool),
        availability: await getAvailability(ctx, tool._id, today),
      })),
    );
  },
});

const toolInput = v.object({
  name: v.string(),
  category: toolCategory,
  condition: toolCondition,
  description: v.string(),
});

export const create = mutation({
  args: toolInput,
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    return await ctx.db.insert("tools", {
      ...cleanInput(args),
      ownerId: me._id,
      status: "active",
    });
  },
});

// Owners only. Admins can remove a listing, but not edit it.
export const update = mutation({
  args: { toolId: v.id("tools"), ...toolInput.fields },
  handler: async (ctx, { toolId, ...input }) => {
    const me = await requireUser(ctx);
    const tool = await getActiveTool(ctx, toolId);
    if (tool.ownerId !== me._id) throw new ConvexError("Forbidden");
    await ctx.db.patch(toolId, cleanInput(input));
  },
});

// Soft delete by the owner or an admin. Pending requests are declined. Approved loans stay,
// because the borrower still has to return the tool.
export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const me = await requireUser(ctx);
    const tool = await getActiveTool(ctx, toolId);
    if (tool.ownerId !== me._id && me.role !== "admin") throw new ConvexError("Forbidden");

    await ctx.db.patch(toolId, { status: "removed" });

    const pending = await ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", "requested"))
      .collect();
    for (const loan of pending) {
      await ctx.db.patch(loan._id, { status: "declined" });
      await recordLoanEvent(ctx, loan._id, "declined");
    }
  },
});

function toolFields(tool: Doc<"tools">) {
  return {
    _id: tool._id,
    name: tool.name,
    category: tool.category,
    condition: tool.condition,
    description: tool.description,
  };
}

function cleanInput(input: Infer<typeof toolInput>) {
  const name = input.name.trim();
  const description = input.description.trim();
  if (name.length === 0) throw new ConvexError("Name is required");
  if (name.length > NAME_MAX) throw new ConvexError(`Name must be ${NAME_MAX} characters or fewer`);
  if (description.length > DESCRIPTION_MAX) {
    throw new ConvexError(`Description must be ${DESCRIPTION_MAX} characters or fewer`);
  }
  return { name, category: input.category, condition: input.condition, description };
}

async function getActiveTool(ctx: MutationCtx, toolId: Id<"tools">) {
  const tool = await ctx.db.get(toolId);
  if (!tool || tool.status !== "active") throw new ConvexError("Tool not found");
  return tool;
}

// A tool is out when an approved loan has started. If that loan ended before today, it is overdue.
async function getAvailability(
  ctx: QueryCtx,
  toolId: Id<"tools">,
  today: string,
): Promise<Availability> {
  const approved = await ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", "approved"))
    .collect();
  const started = approved.filter((loan) => loan.startDate <= today);

  const overdue = started.find((loan) => loan.endDate < today);
  if (overdue) return { state: "overdue", since: overdue.endDate };
  const current = started[0];
  if (current) return { state: "on_loan", until: current.endDate };

  const upcoming = approved
    .map((loan) => loan.startDate)
    .filter((startDate) => startDate > today)
    .toSorted();
  return upcoming[0] ? { state: "available", nextBookedFrom: upcoming[0] } : { state: "available" };
}
