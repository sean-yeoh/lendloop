import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

// Development data. Run with `pnpm seed`, which creates the Clerk test users first.
// Internal, so only the CLI with deployment access can call it. Safe to run more than once.

type SeedTool = Pick<Doc<"tools">, "name" | "category" | "condition" | "description">;

// The tools for each seed user, by position in the `users` argument.
const toolsByOwner: SeedTool[][] = [
  [
    { name: "Cordless drill", category: "power_tools", condition: "good", description: "18V with two batteries and a charger. Drill bits included." },
    { name: "Circular saw", category: "power_tools", condition: "fair", description: "7¼ inch blade. Works well, the guard is a bit stiff." },
    { name: "Extension ladder", category: "ladders", condition: "good", description: "6 metres. Fits on a car roof rack." },
    { name: "Pressure washer", category: "cleaning", condition: "new", description: "Electric, 130 bar. Patio cleaner attachment included." },
  ],
  [
    { name: "Lawn mower", category: "garden", condition: "good", description: "Petrol, self-propelled. Please return it with some fuel." },
    { name: "Hedge trimmer", category: "garden", condition: "worn", description: "Cordless. The battery lasts about 30 minutes." },
    { name: "Socket set", category: "hand_tools", condition: "good", description: "94 pieces, metric and imperial, in a case." },
    { name: "Stand mixer", category: "kitchen", condition: "good", description: "5 litre bowl with whisk, dough hook, and paddle." },
  ],
  [
    { name: "Two-person tent", category: "camping", condition: "good", description: "Waterproof, sets up in 10 minutes. Pegs and footprint included." },
    { name: "Camping stove", category: "camping", condition: "fair", description: "Double burner. Gas canisters not included." },
    { name: "Step ladder", category: "ladders", condition: "new", description: "Five steps, aluminium, folds flat." },
    { name: "Carpet cleaner", category: "cleaning", condition: "fair", description: "Upright, with a hose for stairs and car seats." },
  ],
];

export const run = internalMutation({
  args: {
    users: v.array(v.object({ clerkUserId: v.string(), email: v.string(), name: v.string() })),
  },
  handler: async (ctx, { users }) => {
    let usersCreated = 0;
    let usersUpdated = 0;
    let toolsCreated = 0;

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
        userId = await ctx.db.insert("users", { ...seedUser, email: seedUser.email.toLowerCase(), role: "user" });
        usersCreated++;
      }

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

    return { usersCreated, usersUpdated, toolsCreated };
  },
});
