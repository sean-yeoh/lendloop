// Usage: pnpm containers:up | containers:down | containers:logs
// Runs Docker Compose, or Podman Compose, with the given arguments. Docker is the default when it
// is installed. Set COMPOSE to choose, for example COMPOSE="podman compose" (scripts/lib/containers.mjs).
//
// Host port overrides (N8N_HOST_PORT, MAILPIT_HOST_PORT) come from the environment. The pnpm
// scripts load them, and COMPOSE, from .env.local, if the file exists.
import { spawnSync } from "node:child_process";
import { composeCommand } from "./lib/containers.mjs";

const compose = composeCommand();
if (!compose) {
  console.error("Install Docker or Podman, or set COMPOSE. See docs/setup.md, Prerequisites.");
  process.exit(1);
}
const [command, ...prefix] = compose;
const result = spawnSync(command, [...prefix, ...process.argv.slice(2)], { stdio: "inherit" });
if (result.error) {
  console.error(`Could not run ${command}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
