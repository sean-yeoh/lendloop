// Usage: pnpm bootstrap
// Sets up a new development machine, or repairs one. Safe to run more than once: each step
// skips work that is already done. Steps that need a person (Clerk keys, the Convex login
// question, the n8n owner account) stop with an instruction, or wait at a prompt.
//
// 1. Checks the prerequisites and runs pnpm install.
// 2. pnpm setup:env: creates .env.local from .env.example, if it does not exist.
// 3. Checks the Clerk keys in .env.local, and adds the sign-in page settings if they are missing.
// 4. Configures the local Convex deployment (interactive, first run only).
// 5. Starts the local Convex backend in the background, if it is not running.
// 6. pnpm setup:convex, pnpm setup:clerk, pnpm containers:up, pnpm setup:n8n.
// 7. Stops the Convex backend again, if this script started it.
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

// The Convex backend that this script starts, if any. Stopped on exit.
let backend = null;

const ENV_FILE = ".env.local";
// Non-secret settings that make Clerk use the in-app /sign-in page. Also in .env.example.
const SIGN_IN_SETTINGS = {
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/",
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/",
};

step("Prerequisites");
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12))
  fail(`Node.js 22.12 or later is required. You have ${process.versions.node}.`);
if (!commandExists("podman") && !commandExists("docker"))
  fail("Install Podman or Docker. See docs/setup.md, Prerequisites.");
if (!commandExists("hivemind"))
  warn("Hivemind is not installed. `pnpm dev` needs it: brew install hivemind");
ok(`Node.js ${process.versions.node}, ${commandExists("podman") ? "Podman" : "Docker"}`);

step("Dependencies");
run("pnpm", ["install"]);

step("Environment file");
run("pnpm", ["setup:env"]);

step("Clerk keys");
const env = readEnv();
const missing = ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"].filter(
  (name) => !env[name],
);
if (missing.length > 0) {
  fail(
    `${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not in ${ENV_FILE}.\n` +
      "Create a Clerk development app and add the keys as docs/setup.md step 1 describes, then run pnpm bootstrap again.",
  );
}
const toAdd = Object.entries(SIGN_IN_SETTINGS).filter(([name]) => !env[name]);
if (toAdd.length > 0) {
  appendFileSync(ENV_FILE, `\n${toAdd.map(([name, value]) => `${name}=${value}`).join("\n")}\n`);
  ok(`Added ${toAdd.map(([name]) => name).join(", ")} to ${ENV_FILE}`);
}
ok("Keys present");

step("Convex");
if (!readEnv().CONVEX_DEPLOYMENT) {
  console.log(
    'The Convex CLI asks how to run. Select "Start without an account (run Convex locally)".\n',
  );
  run("pnpm", ["exec", "convex", "dev", "--once"]);
  if (!readEnv().CONVEX_DEPLOYMENT)
    fail(`convex dev did not write CONVEX_DEPLOYMENT to ${ENV_FILE}.`);
}
ok("Local deployment configured");

step("Convex backend");
const convexUrl = readEnv().NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl)
  fail(`NEXT_PUBLIC_CONVEX_URL is not in ${ENV_FILE}. Run pnpm exec convex dev once.`);
if (await responds(`${convexUrl}/version`)) {
  ok(`Already running at ${convexUrl}`);
} else {
  backend = spawn("pnpm", ["exec", "convex", "dev", "--tail-logs", "disable"], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (!(await waitFor(`${convexUrl}/version`, 120)))
    stop("The local Convex backend did not start.");
  ok(`Started at ${convexUrl} for this setup`);
}

try {
  step("pnpm setup:convex");
  run("pnpm", ["setup:convex"]);
  step("pnpm setup:clerk");
  run("pnpm", ["setup:clerk"]);
  step("pnpm containers:up");
  run("pnpm", ["containers:up"]);

  step("n8n owner account");
  const n8nUrl = `http://localhost:${readEnv().N8N_HOST_PORT || "5678"}`;
  if (!(await waitFor(`${n8nUrl}/healthz`, 90))) stop(`n8n did not start at ${n8nUrl}.`);
  if (await n8nNeedsOwner(n8nUrl)) {
    console.log(
      `Open ${n8nUrl} and create the owner account (any email, your name, a password).\n` +
        "This account exists only in your local n8n. docs/setup.md step 2 has the details.",
    );
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    await rl.question("Press Enter when the account exists: ");
    rl.close();
  }
  ok("Owner account exists");

  step("pnpm setup:n8n");
  run("pnpm", ["setup:n8n"]);
} finally {
  backend?.kill("SIGINT");
}

step("Done");
console.log(`Next:
  pnpm dev                          Start the containers, Next.js, and Convex
  pnpm db:seed                      Optional: test users, tools, and loans
  pnpm admin:grant you@example.com  Optional: admin rights, after you sign in once`);

// .env.local as a key/value map. Values are used only to check for presence and are never printed.
function readEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const entries = readFileSync(ENV_FILE, "utf8")
    .split("\n")
    .map((line) => /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/.exec(line))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")]);
  return Object.fromEntries(entries.filter(([, value]) => value));
}

// n8n's settings endpoint says whether the first-run owner setup is still open. If the answer is
// unclear, ask the person.
async function n8nNeedsOwner(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/rest/settings`);
    const settings = await response.json();
    return settings?.data?.userManagement?.showSetupOnFirstLoad !== false;
  } catch {
    return true;
  }
}

async function responds(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(2000) })).ok;
  } catch {
    return false;
  }
}

async function waitFor(url, seconds) {
  for (let i = 0; i < seconds; i++) {
    if (await responds(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function run(command, args) {
  try {
    execFileSync(command, args, { stdio: "inherit" });
  } catch {
    stop(
      `\`${command} ${args.join(" ")}\` failed. Fix the error above, then run pnpm bootstrap again.`,
    );
  }
}

function commandExists(command) {
  try {
    execFileSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Stops the background Convex backend before exiting.
function stop(message) {
  backend?.kill("SIGINT");
  fail(message);
}

function step(title) {
  console.log(`\n▸ ${title}`);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  console.log(`! ${message}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
