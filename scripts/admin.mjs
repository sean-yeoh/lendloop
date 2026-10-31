// Usage: pnpm admin:grant <email> | pnpm admin:revoke <email>
import { execFileSync } from "node:child_process";

const functions = { grant: "users:grantAdmin", revoke: "users:revokeAdmin" };
const [action, email] = process.argv.slice(2);

if (!functions[action] || !email) {
  console.error("Usage: pnpm admin:grant <email> | pnpm admin:revoke <email>");
  process.exit(1);
}

try {
  execFileSync("convex", ["run", functions[action], JSON.stringify({ email })], {
    stdio: "inherit",
  });
} catch {
  process.exit(1);
}
