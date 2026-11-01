# LendLoop

Borrow what you need. Lend what you don't.

LendLoop is a neighborhood tool-lending board. Neighbors list tools they can lend, request to borrow tools for a date range, and get email notifications and overdue reminders.

Built with Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Clerk (sign-in), Convex (data and backend), and n8n (email automation).

## Quick start

You need Node.js 22.12+, pnpm 12, [Hivemind](https://github.com/DarthSim/hivemind), Docker (or Podman), and a free [Clerk](https://dashboard.clerk.com) account. No Convex account is needed. Details: [Prerequisites](docs/setup.md#prerequisites).

1. **Create a Clerk app**, and add the email and name claims to its session token. Follow [setup step 1](docs/setup.md#1-create-a-clerk-development-app) exactly. Without the claims, sign-in works but no user is created.

2. **Clone the repository and add your Clerk keys.**

   ```sh
   git clone https://github.com/sean-yeoh/lendloop
   cd lendloop
   pnpm setup:env
   ```

   This creates `.env.local`. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in it, from **Configure > API keys** in the Clerk dashboard.

3. **Run the setup script.**

   ```sh
   pnpm bootstrap
   ```

   It installs the dependencies, sets up the local Convex backend, connects Clerk, starts n8n and Mailpit, and imports the n8n workflows. It asks two questions on the first run. Answer them as [setup step 2](docs/setup.md#2-run-the-setup-script) describes. You can run it again at any time.

4. **Start the app.**

   ```sh
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and sign up.

5. **Add test data** (optional).

   ```sh
   pnpm db:seed
   ```

   Sign in as `alice+clerk_test@example.com`, `bob+clerk_test@example.com`, or `carol+clerk_test@example.com` with the code `424242`. To try the admin page, sign in as `admin+clerk_test@example.com`.

If something goes wrong, see [Troubleshooting](docs/setup.md#troubleshooting).

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start everything: n8n and Mailpit, Next.js, and Convex |
| `pnpm db:seed` / `pnpm db:reset` | Add test data, or delete all local data |
| `pnpm check` | Formatting, types, lint, and tests. Run it before you commit. |
| `pnpm admin:grant <email>` | Give a user admin rights |

All commands: [Development](docs/development.md).

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| n8n | http://localhost:5678 |
| Mailpit (local email inbox) | http://localhost:8025 |

## Documentation

| Guide | Read it to learn |
|---|---|
| [Development setup](docs/setup.md) | Every setup step in detail, the environment variables, and troubleshooting |
| [Development](docs/development.md) | Commands, ports, formatting and linting, tests, and UI components |
| [Architecture](docs/architecture.md) | The data model, the design decisions, and the pages |
| [Security](docs/security.md) | Who can do what, request signing, and what data is stored and shared |
| [Automation (n8n)](docs/automation.md) | The notification, reminder, and error workflows |

## Deployment

The local setup is for development only. [Deployment](docs/deployment.md) lists what to change and add before production.
