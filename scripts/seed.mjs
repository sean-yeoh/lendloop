// Usage: pnpm seed
// Creates Clerk test users in the development instance, then seeds their Convex rows and tools.
// Safe to run more than once. Requires CLERK_SECRET_KEY (development key) and a running `convex dev`.
import { execFileSync } from "node:child_process";
import { createClerkClient } from "@clerk/backend";

// "+clerk_test" addresses never receive email in a Clerk development instance.
// Their verification code is always 424242.
const seedUsers = [
  { email: "alice+clerk_test@example.com", firstName: "Alice", lastName: "Smith" },
  { email: "bob+clerk_test@example.com", firstName: "Bob", lastName: "Jones" },
  { email: "carol+clerk_test@example.com", firstName: "Carol", lastName: "Brown" },
];

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) fail("CLERK_SECRET_KEY is not set. Add it to .env.local.");
if (!secretKey.startsWith("sk_test_")) fail("Seed only runs against a Clerk development instance (sk_test_ key).");

// Optional. If set, new test users get this password. Otherwise they sign in with an email code.
const password = process.env.SEED_USER_PASSWORD;

const clerk = createClerkClient({ secretKey });
const users = [];

for (const seedUser of seedUsers) {
  const { data } = await clerk.users.getUserList({ emailAddress: [seedUser.email] });
  let user = data[0];
  if (user) {
    // Keep the names in step with this list, so a renamed seed user updates on the next run.
    if (user.firstName !== seedUser.firstName || user.lastName !== seedUser.lastName) {
      user = await clerk.users.updateUser(user.id, {
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
      });
      console.log(`Clerk user renamed: ${seedUser.email}`);
    } else {
      console.log(`Clerk user exists: ${seedUser.email}`);
    }
  } else {
    user = await clerk.users.createUser({
      emailAddress: [seedUser.email],
      firstName: seedUser.firstName,
      lastName: seedUser.lastName,
      ...(password ? { password } : { skipPasswordRequirement: true }),
    });
    console.log(`Clerk user created: ${seedUser.email}`);
  }
  users.push({
    clerkUserId: user.id,
    email: seedUser.email,
    name: `${seedUser.firstName} ${seedUser.lastName}`,
  });
}

try {
  execFileSync("convex", ["run", "seed:run", JSON.stringify({ users })], { stdio: "inherit" });
} catch {
  process.exit(1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
