// Usage: pnpm db:reset  (add --yes to skip the question)
// Deletes all data in the local Convex deployment: users, tools, loans, activity, and
// notifications. Environment variables and secrets are kept, so no setup step must run again.
// Run `pnpm db:seed` afterwards for test data. Requires: `convex dev` running.
//
// convex/dev.ts refuses to run on a deployment that is not a local backend.
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

if (!process.argv.includes("--yes")) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Delete all data in the local Convex deployment? Type yes: ");
  rl.close();
  if (answer.trim() !== "yes") {
    console.log("Cancelled.");
    process.exit(0);
  }
}

const args = JSON.stringify({ confirm: "delete all data" });
for (;;) {
  let output;
  try {
    output = execFileSync("pnpm", ["exec", "convex", "run", "dev:reset", args], {
      stdio: ["ignore", "pipe", "inherit"],
    }).toString();
  } catch {
    process.exit(1);
  }
  if (!JSON.parse(output).remaining) break;
}
console.log("✓ All data deleted. Run `pnpm db:seed` for test data.");
