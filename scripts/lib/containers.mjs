// Which container tools the scripts use. COMPOSE chooses the Compose command, for example
// COMPOSE="podman compose" in .env.local. Without it: Docker if it is installed, otherwise Podman.
import { execFileSync } from "node:child_process";

/** The Compose command as an argument list, for example ["docker", "compose"]. */
export function composeCommand(env = process.env) {
  const configured = env.COMPOSE?.trim();
  if (configured) return configured.split(/\s+/);
  if (commandExists("docker")) return ["docker", "compose"];
  if (commandExists("podman")) return ["podman", "compose"];
  return null;
}

/** The engine CLI for exec, cp, and restart: "docker" or "podman". Matches composeCommand. */
export function containerEngine(env = process.env) {
  const compose = composeCommand(env);
  if (!compose) return null;
  // "podman compose" and "podman-compose" use Podman. Everything else uses Docker.
  return compose[0].startsWith("podman") ? "podman" : "docker";
}

export function commandExists(command) {
  try {
    execFileSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
