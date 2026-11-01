// Usage: pnpm setup:convex
// Sets CLERK_JWT_ISSUER_DOMAIN on the local Convex deployment, so Convex accepts Clerk session
// tokens (convex/auth.config.ts). The value is the Clerk Frontend API URL, which the publishable
// key encodes: "pk_test_" + base64("<frontend-api-host>$"). Safe to run more than once.
// Requires: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local, and `convex dev` running.
import { execFileSync } from "node:child_process";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) fail("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Add it to .env.local.");

const match = /^pk_(test|live)_(.+)$/.exec(publishableKey);
const decoded = match ? Buffer.from(match[2], "base64").toString("utf8") : "";
if (!decoded.endsWith("$") || !/^[a-z0-9.-]+$/i.test(decoded.slice(0, -1))) {
  fail("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not a valid Clerk publishable key.");
}
const issuer = `https://${decoded.slice(0, -1)}`;

let current = "";
try {
  current = execFileSync("pnpm", ["exec", "convex", "env", "get", "CLERK_JWT_ISSUER_DOMAIN"], {
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();
} catch {
  // Not set yet.
}
if (current === issuer) {
  console.log(`✓ Convex: CLERK_JWT_ISSUER_DOMAIN is ${issuer}`);
} else if (current && !process.argv.includes("--force")) {
  fail(
    `CLERK_JWT_ISSUER_DOMAIN on Convex is ${current}, but the publishable key belongs to ${issuer}.\n` +
      "If you switched Clerk apps, run `pnpm setup:convex --force` to replace it.",
  );
} else {
  execFileSync("pnpm", ["exec", "convex", "env", "set", "CLERK_JWT_ISSUER_DOMAIN", issuer], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  console.log(`✓ Convex: CLERK_JWT_ISSUER_DOMAIN set to ${issuer}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
