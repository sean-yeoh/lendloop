// Usage: pnpm containers:up | containers:down | containers:logs
// Runs `podman compose` if Podman is installed, otherwise `docker compose`, with the given
// arguments. Set COMPOSE to choose, for example COMPOSE="docker compose".
//
// Host port overrides (N8N_HOST_PORT, MAILPIT_HOST_PORT) come from the environment. The pnpm
// scripts load them from .env.local, if the file exists.
import { execFileSync, spawnSync } from "node:child_process";

const [command, ...prefix] = (process.env.COMPOSE || defaultCompose()).split(" ");
const result = spawnSync(command, [...prefix, ...process.argv.slice(2)], { stdio: "inherit" });
if (result.error) {
  console.error(`Could not run ${command}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);

function defaultCompose() {
  try {
    execFileSync("sh", ["-c", "command -v podman"], { stdio: "ignore" });
    return "podman compose";
  } catch {
    return "docker compose";
  }
}
