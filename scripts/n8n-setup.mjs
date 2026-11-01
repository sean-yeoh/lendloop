// Usage: make n8n-setup  (or: node scripts/n8n-setup.mjs)
// Connects the local n8n container to the local Convex deployment. Safe to run more than once.
//
// 1. Creates the two signing secrets on the Convex deployment, if they do not exist yet.
// 2. Sets N8N_NOTIFY_URL on Convex to the local n8n webhook.
// 3. Imports the n8n credentials (signing secrets and Mailpit SMTP) and the workflows in n8n/workflows.
// 4. Publishes the workflows and restarts n8n.
//
// Secret values go through pipes only. They are never printed or passed as command arguments.
// Requires: `convex dev` running, the n8n container running, and the n8n owner account created.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync } from "node:fs";
import path from "node:path";

const WORKFLOW_DIR = "n8n/workflows";
const NOTIFY_PATH = "/webhook/lendloop-notify";
const n8nPort = process.env.N8N_HOST_PORT || "5678";

const engine = commandExists("podman") ? "podman" : "docker";
const container = findN8nContainer();

// 1. Signing secrets, one per direction. Existing values are kept.
const notifySecret = ensureConvexSecret("N8N_NOTIFY_SECRET");
const apiSecret = ensureConvexSecret("N8N_API_SECRET");

// 2. Where Convex sends request notifications. Convex runs on the host, so it uses the host port.
convexEnvSet("N8N_NOTIFY_URL", `http://localhost:${n8nPort}${NOTIFY_PATH}`);
log(`Convex: N8N_NOTIFY_URL points to http://localhost:${n8nPort}${NOTIFY_PATH}`);

// 3. Credentials. The IDs match the references in the workflow files. n8n encrypts the data on import.
const credentials = [
  {
    id: "LendLoopSigIn001",
    name: "LendLoop signing: Convex to n8n",
    type: "crypto",
    data: { hmacSecret: notifySecret },
  },
  {
    id: "LendLoopSigOut01",
    name: "LendLoop signing: n8n to Convex",
    type: "crypto",
    data: { hmacSecret: apiSecret },
  },
  {
    id: "LendLoopSmtp0001",
    name: "LendLoop Mailpit SMTP",
    type: "smtp",
    // Mailpit in the compose network: no TLS and no login.
    data: { host: "mailpit", port: 1025, secure: false, disableStartTls: true, user: "", password: "" },
  },
];
n8nWithFile("/tmp/lendloop-credentials.json", JSON.stringify(credentials), "import:credentials");
log("n8n: imported 3 credentials");

const workflows = readdirSync(WORKFLOW_DIR).filter((file) => file.endsWith(".json"));
execFileSync(engine, ["exec", container, "rm", "-rf", "/tmp/lendloop-workflows"]);
execFileSync(engine, ["cp", WORKFLOW_DIR, `${container}:/tmp/lendloop-workflows`]);
run(engine, ["exec", container, "n8n", "import:workflow", "--separate", "--input=/tmp/lendloop-workflows"]);
log(`n8n: imported ${workflows.length} workflows`);

// 4. Publish, then restart, because n8n reads published workflows at startup.
for (const file of workflows) {
  const id = path.basename(file, ".json");
  run(engine, ["exec", container, "n8n", "publish:workflow", `--id=${id}`]);
}
execFileSync(engine, ["exec", container, "rm", "-rf", "/tmp/lendloop-workflows"]);
run(engine, ["restart", container]);
log(`n8n: published ${workflows.length} workflows and restarted. Open http://localhost:${n8nPort}`);

function findN8nContainer() {
  const ids = execFileSync(engine, [
    "ps",
    "--filter",
    "label=com.docker.compose.project=lendloop",
    "--filter",
    "label=com.docker.compose.service=n8n",
    "--format",
    "{{.Names}}",
  ])
    .toString()
    .trim();
  if (!ids) fail("The n8n container is not running. Run `make container-up` first.");
  return ids.split("\n")[0];
}

function ensureConvexSecret(name) {
  let value = "";
  try {
    value = execFileSync("pnpm", ["exec", "convex", "env", "get", name], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    // Not set yet.
  }
  if (/^[0-9a-f]{64}$/.test(value)) {
    log(`Convex: ${name} exists, kept`);
    return value;
  }
  value = randomBytes(32).toString("hex");
  convexEnvSet(name, value);
  log(`Convex: ${name} created`);
  return value;
}

// The value goes through stdin, so it is not visible in the process list or shell history.
function convexEnvSet(name, value) {
  execFileSync("pnpm", ["exec", "convex", "env", "set", name, "--force"], {
    input: value,
    stdio: ["pipe", "ignore", "inherit"],
  });
}

// Writes a file inside the container from stdin, runs an n8n import, and deletes the file.
function n8nWithFile(file, content, command) {
  execFileSync(
    engine,
    ["exec", "-i", container, "sh", "-c", `cat > ${file} && n8n ${command} --input=${file}; status=$?; rm -f ${file}; exit $status`],
    { input: content, stdio: ["pipe", "ignore", "inherit"] },
  );
}

function run(command, args) {
  execFileSync(command, args, { stdio: ["ignore", "ignore", "inherit"] });
}

function commandExists(command) {
  try {
    execFileSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function log(message) {
  console.log(`✓ ${message}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
