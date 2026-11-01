# Development

Daily commands, code style, and tests. For the first setup, see [Development setup](setup.md).

## Daily development

```sh
pnpm dev
```

Press `Ctrl+C` to stop Next.js and Convex. The containers keep running until `pnpm containers:down`.

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| n8n | http://localhost:5678 |
| Mailpit (local email inbox) | http://localhost:8025 |

Commands (run `pnpm run` for the full list):

| Command | What it does |
|---|---|
| `pnpm bootstrap` | Set up a new machine, or repair one ([setup step 2](setup.md#2-run-the-setup-script)) |
| `pnpm dev` | Start the containers, then Next.js and Convex. `pnpm dev:web` starts Next.js only. |
| `pnpm containers:up` / `pnpm containers:down` | Start or stop n8n and Mailpit. `down` keeps the data volumes. Uses `podman compose` if Podman is installed, otherwise `docker compose`. Set `COMPOSE="docker compose"` to choose. |
| `pnpm containers:logs` | Follow the container logs |
| `pnpm db:seed` | Create the test users, tools, and loans ([setup step 4](setup.md#4-seed-test-data)) |
| `pnpm db:reset` | Delete all data in the local Convex deployment. Asks first. Environment variables and secrets are kept. It refuses to run on a deployment that is not local. |
| `pnpm setup:convex`, `pnpm setup:clerk`, `pnpm setup:n8n` | Run one setup step ([setup step 2](setup.md#2-run-the-setup-script)) |
| `pnpm admin:grant <email>` / `pnpm admin:revoke <email>` | Change admin rights ([setup step 6](setup.md#6-make-yourself-an-admin-optional)) |
| `pnpm format` | Format the code with oxfmt |
| `pnpm test` / `pnpm test:once` | Run the tests in watch mode, or once |
| `pnpm check` | Check formatting, type-check, lint, and test |

**If a port is in use** (for example, another project's Mailpit on 8025), choose another host port in `.env.local`:

```
MAILPIT_HOST_PORT=8026
```

The container scripts and `pnpm setup:n8n` read it from there. Use the new port in the Mailpit or n8n URL.

To open the local Convex dashboard in the browser, run `pnpm exec convex dashboard`.

## Formatting and linting

- **[oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)** formats the code (`.oxfmtrc.json`): Prettier-compatible output, 100-character lines, and Tailwind classes sorted, also inside `cn()` and `cva()`. Run `pnpm format` before you commit. `pnpm check` fails on unformatted files.
- **Not formatted:** Markdown, because aligned tables would rewrite every row of a table when one cell changes. Also `components/ui` (shadcn CLI output, kept as generated), `convex/_generated`, and the exported n8n workflows.
- **[oxlint](https://oxc.rs/docs/guide/usage/linter.html)** runs first (`.oxlintrc.json`), then ESLint with `eslint-config-next` for the Next.js and React Hooks rules. `eslint-plugin-oxlint` turns off the ESLint rules that oxlint already checks. `pnpm lint` runs both.

## UI components

The files in `components/ui` come from the shadcn/ui CLI (style `base-nova`, Base UI primitives). To add a component, run:

```sh
pnpm exec shadcn add <component>
```

Then review the diff before you commit. The theme follows the OS light or dark setting (`next-themes`).

## Tests

The Convex function tests use [`convex-test`](https://docs.convex.dev/testing/convex-test) with Vitest. They run against an in-memory mock backend, so `convex dev` does not need to run.

```sh
pnpm test:once   # run all tests once
pnpm test        # watch mode
pnpm check       # formatting, types, lint, and tests
```

CI (`.github/workflows/ci.yml`) runs `pnpm check` and `pnpm build` on every push to `main` and on every pull request. The build uses placeholder Convex and Clerk values, so CI needs no secrets.
