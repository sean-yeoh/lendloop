// Usage: pnpm setup:clerk
// Connects the local Convex deployment to the Clerk development instance. Safe to run more than once.
//
// 1. Copies CLERK_SECRET_KEY to Convex, for deleting Clerk users and turning off Clerk's own
//    Delete account button (convex/clerk.ts).
// 2. Copies CLERK_WEBHOOK_SIGNING_SECRET to Convex, if it is set, for the user.deleted webhook.
// 3. Turns off Clerk's own Delete account for users created before this setting existed.
//
// Both values come from .env.local and go to Convex through stdin only. They are never printed.
// Requires: `convex dev` running.
import { execFileSync } from "node:child_process";
import { createClerkClient } from "@clerk/backend";

const secretKey = process.env.CLERK_SECRET_KEY;
const webhookSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

if (!secretKey) fail("CLERK_SECRET_KEY is not set. Add it to .env.local.");
if (!secretKey.startsWith("sk_test_"))
  fail("This script is for a Clerk development instance (sk_test_ key) only.");

convexEnvSet("CLERK_SECRET_KEY", secretKey);
log("Convex: CLERK_SECRET_KEY set");

if (webhookSecret) {
  if (!webhookSecret.startsWith("whsec_"))
    fail("CLERK_WEBHOOK_SIGNING_SECRET must start with whsec_.");
  convexEnvSet("CLERK_WEBHOOK_SIGNING_SECRET", webhookSecret);
  log("Convex: CLERK_WEBHOOK_SIGNING_SECRET set");
} else {
  console.log(
    "- CLERK_WEBHOOK_SIGNING_SECRET is not in .env.local. Skipped. See docs/setup.md, step 7.",
  );
}

const clerk = createClerkClient({ secretKey });
const PAGE = 100;
let changed = 0;
for (let offset = 0; ; offset += PAGE) {
  const { data } = await clerk.users.getUserList({ limit: PAGE, offset });
  for (const user of data) {
    if (!user.deleteSelfEnabled) continue;
    await clerk.users.updateUser(user.id, { deleteSelfEnabled: false });
    changed++;
  }
  if (data.length < PAGE) break;
}
log(`Clerk: Delete account turned off for ${changed} existing ${changed === 1 ? "user" : "users"}`);

// The value goes through stdin, so it is not visible in the process list or shell history.
function convexEnvSet(name, value) {
  execFileSync("pnpm", ["exec", "convex", "env", "set", name, "--force"], {
    input: value,
    stdio: ["pipe", "ignore", "inherit"],
  });
}

function log(message) {
  console.log(`✓ ${message}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
