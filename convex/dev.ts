import { ConvexError, v } from "convex/values";
import type { TableNames } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import schema from "./schema";

// Development tools. Internal: callable only from the CLI with deployment access.

const BATCH = 500;

/**
 * Deletes every document in every table, a batch at a time. Returns `true` while documents remain,
 * so the caller runs it again (scripts/db-reset.mjs). Environment variables are not changed.
 * Refuses to run unless the deployment is a local backend.
 */
export const reset = internalMutation({
  args: { confirm: v.literal("delete all data") },
  handler: async (ctx) => {
    if (!isLocalDeployment(process.env.CONVEX_CLOUD_URL)) {
      throw new ConvexError("dev:reset runs only on a local Convex backend");
    }
    let remaining = false;
    for (const table of Object.keys(schema.tables) as TableNames[]) {
      const docs = await ctx.db.query(table).take(BATCH);
      for (const doc of docs) await ctx.db.delete(doc._id);
      if (docs.length === BATCH) remaining = true;
    }
    return { remaining };
  },
});

export function isLocalDeployment(url: string | undefined): boolean {
  if (!url) return false;
  const { hostname } = new URL(url);
  return hostname === "127.0.0.1" || hostname === "localhost";
}
