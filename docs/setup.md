# Development setup


Each developer runs their own local Convex backend and uses their own Clerk development app. No secrets are shared between developers, and no secrets are committed to the repository.

These steps were last checked on 2026-11-01 with Node.js 26.11.1, pnpm 12.11.2, Convex CLI 1.48.0, `@clerk/nextjs` 7.9.22, Hivemind 1.1.0, and Podman 6.1.4 with podman-compose 1.6.0. Dashboards change over time. If a screen does not match, check the current [Convex + Clerk docs](https://docs.convex.dev/auth/clerk).

## Prerequisites

- Node.js 22.12 or later (required by Vitest)
- pnpm 12.11 or later (`packageManager` in `package.json`)
- [Hivemind](https://github.com/DarthSim/hivemind), for `pnpm dev` (`brew install hivemind`)
- A container engine with Compose, for n8n and Mailpit. One of:
  - Docker with the Docker Compose plugin (`docker compose`)
  - Podman with a Compose provider (`podman compose`). On macOS, start the Podman machine first (`podman machine start`).
- A Clerk account (free) at [dashboard.clerk.com](https://dashboard.clerk.com)
- Optional: [ngrok](https://ngrok.com), only to test the Clerk webhook (step 7)

A Convex account is not required for local development.

## 1. Create a Clerk development app

1. In the Clerk dashboard, create an application:
   - Application type: **Consumer**
   - Name: `LendLoop`
   - Sign-in options: **Email** and **Google** on. All other options off, including **Phone number**.
2. Skip the "Add authentication to your app" page. Do not use its agent prompt or the Clerk CLI. The code is already in this repository.
3. Open [dashboard.clerk.com/apps/setup/convex](https://dashboard.clerk.com/apps/setup/convex). Select your workspace, the `LendLoop` application, and the **Development** instance. Select **Activate Convex integration**.
4. **Required: add the `email` and `name` claims to the session token.** Clerk session tokens do not include them by default, and the Convex integration adds only `aud`. Without this step, sign-in works but your user is not created, and the browser console shows `Clerk token has no email claim`.
   1. In the Clerk dashboard, select **Configure** in the top menu.
   2. Select **Sessions** in the left menu.
   3. In the **Claims** editor, replace the content with:

      ```json
      {
        "aud": "convex",
        "email": "{{user.primary_email_address}}",
        "name": "{{user.full_name}}"
      }
      ```

   4. Select **Save** in the "Unsaved changes" bar at the bottom of the page.
   5. Check the **Preview**. It must show your email. `"name": null` is OK. The app then uses the part of the email before `@` (and before any `+`) as the name. Other users never see the full email address.
5. Select **Configure**, then **API keys** in the left menu (under **Instance**).
6. Clone the repository, and create `.env.local` from `.env.example`. The command never changes an existing `.env.local`:

   ```sh
   git clone https://github.com/sean-yeoh/lendloop
   cd lendloop
   pnpm setup:env
   ```

   In `.env.local`, set the publishable key from the **Publishable key** section:

   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```

7. Add a secret key. The `default` secret key is locked and cannot be copied. In the **Secret keys** section, select **Add new key**. Clerk shows the full key only once. Copy it before you close the dialog, and add it to `.env.local`:

   ```
   CLERK_SECRET_KEY=sk_test_...
   ```

   If you lose the key, create a new one and delete the old one.

## 2. Run the setup script

```sh
pnpm bootstrap
```

The script (`scripts/bootstrap.mjs`):

1. Checks the prerequisites and runs `pnpm install`.
2. Runs `pnpm setup:env`, in case `.env.local` does not exist yet.
3. Checks the Clerk keys. If a key is missing, it stops and points to step 1. It also adds the sign-in page settings (`NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and the two redirect settings) if they are missing. They make Clerk use the in-app `/sign-in` page.
4. On the first run, configures the local Convex deployment. The Convex CLI asks how to run: select **Start without an account (run Convex locally)**. Do not use `--configure new`, which forces a Convex account login. The CLI writes `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, and `NEXT_PUBLIC_CONVEX_SITE_URL` to `.env.local`. Do not edit these values.
5. Starts the local Convex backend in the background, if it is not running.
6. Runs the setup steps below in order, and starts the containers (`pnpm containers:up`).
7. On the first run, asks you to create the n8n owner account. Open [http://localhost:5678](http://localhost:5678). This account exists only in your local n8n (in the `n8n_data` volume). It is not an n8n.io account.
   1. Enter any email, your name, and a password (8 or more characters, with 1 number and 1 capital letter).
   2. Leave "I want to receive security and product updates" unchecked. Select **Next**.
   3. Skip the survey (**Get started**), the license key offer, and the AI Assistant (**Set up later in Settings**).
   4. Go back to the terminal and press Enter.
8. Stops the Convex backend again, if it started it.

The script never prints a secret. Secrets go to Convex through stdin, and to n8n through a temporary file inside the container that is deleted after the import. You can run it again at any time: each step skips work that is already done. If a step fails, fix the error that it shows, then run `pnpm bootstrap` again.

Each setup step is also a script. Run one alone when its input changes, for example after you change a workflow file or rotate a Clerk key. They need the Convex backend, so run `pnpm dev` first.

| Command | What it does |
|---|---|
| `pnpm setup:convex` | Sets `CLERK_JWT_ISSUER_DOMAIN` on Convex. The value is the Clerk Frontend API URL, which the publishable key encodes. If another value is already set, it stops. Add `--force` after you switch Clerk apps. |
| `pnpm setup:clerk` | Copies `CLERK_SECRET_KEY` (and `CLERK_WEBHOOK_SIGNING_SECRET`, if set) to Convex. Turns off Clerk's own **Delete account** for existing users. |
| `pnpm setup:n8n` | Creates the two n8n signing secrets on Convex, if they do not exist yet. Sets `N8N_NOTIFY_URL` on Convex. Imports the n8n credentials (the signing secrets and the Mailpit SMTP settings) and the three workflows in `n8n/workflows`, publishes them, and restarts n8n. |

## 3. Start the app

```sh
pnpm dev
```

This command starts n8n and Mailpit in containers, then runs Next.js and `convex dev` together with Hivemind (`Procfile.dev`).

1. Open [http://localhost:3000](http://localhost:3000).
2. Select **Sign in to lend or borrow**, and sign up.
3. Check that your user menu shows at the top right.
4. Check that Convex created your user:

   ```sh
   pnpm exec convex data users
   ```

   The table must show one row with your email. If it is empty, see [Troubleshooting](#troubleshooting).

## 4. Seed test data

```sh
pnpm db:seed
```

The script:

1. Creates four Clerk test users in your development instance, or reuses them if they exist: `alice+clerk_test@example.com`, `bob+clerk_test@example.com`, `carol+clerk_test@example.com`, and `admin+clerk_test@example.com`.
2. Creates their Convex user rows and 12 tools for Alice, Bob, and Carol. They do not need to sign in first. **Admin User** gets the `admin` role and no tools. If someone revoked it, the next run gives it back. The seed never changes any other user's role.
3. Creates 10 loans between them, with dates relative to today: two overlapping pending requests, a loan in progress, a future booking, two overdue loans (one with reminder activity), an on-time return, a late return, a declined request, and a cancelled request.

You can run it more than once. It does not create duplicate users or tools. **Each run replaces the loans between the test users**, so the dates stay relative to the current day. Loans that involve any other user are never changed. It runs only with a development secret key (`sk_test_`), and `convex dev` must be running.

To sign in as a test user, enter the email, then the code `424242`. Clerk never sends email to `+clerk_test` addresses. To give new test users a password, set `SEED_USER_PASSWORD` in `.env.local` before you run the seed.

To start again with an empty database, run `pnpm db:reset`, then `pnpm db:seed`. See [Daily development](development.md#daily-development).

## 5. Check the automation

1. Sign in as Bob (`bob+clerk_test@example.com`) and request one of Alice's tools.
2. Open Mailpit at [http://localhost:8025](http://localhost:8025). Alice has an email: "Bob Jones wants to borrow your …".
3. In n8n, open **LendLoop: Overdue reminders** and select **Execute workflow**. Each overdue borrower gets a reminder in Mailpit. Run it again: no new reminders are sent.

If you change the Mailpit or n8n host port (see [Daily development](development.md#daily-development)), use that port in the URLs above.

## 6. Make yourself an admin (optional)

New users have the `user` role. Admin rights can only be granted with internal Convex functions. The browser cannot call them. To try the admin page without your own account, sign in as `admin+clerk_test@example.com` from the seed (step 4).

To make your own account an admin, sign in once first, then run:

```sh
pnpm admin:grant you@example.com
```

The result is `"granted"`, or `"already admin"` if you run it again. To check, run `pnpm exec convex data users --format jsonLines` and look at the `role` field.

To remove admin rights:

```sh
pnpm admin:revoke you@example.com
```

The result is `"revoked"`, or `"not admin"`.

These scripts call the internal Convex functions `users:grantAdmin` and `users:revokeAdmin`. `convex dev` must be running.

## 7. Test the Clerk webhook (optional)

The `user.deleted` webhook handles users deleted in the Clerk Dashboard. Clerk must reach the local Convex HTTP port (3211), so it needs a tunnel. Account deletion in the app works without this step.

1. Start a tunnel: `ngrok http 3211`. Copy the `https://…` forwarding URL.
2. In the Clerk dashboard, open **Webhooks** and select **Add Endpoint**:
   - Endpoint URL: `<forwarding URL>/clerk/webhook`
   - Subscribe to events: `user.deleted`
3. Open the new endpoint, copy the **Signing Secret** (`whsec_…`), and add it to `.env.local`:

   ```
   CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
   ```

4. Run `pnpm setup:clerk`.
5. On the endpoint page, open the **Testing** tab, select `user.deleted`, and select **Send Example**. The attempt must show **Succeeded**, with the response `{"result":"unknown user"}`, because the example user does not exist in Convex.

A free ngrok URL changes each time ngrok starts. Then update the endpoint URL in Clerk.

## Environment variables

| Variable | Where it is set | Source |
|---|---|---|
| `CONVEX_DEPLOYMENT` | `.env.local` | Written by `convex dev` |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | Written by `convex dev` |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | `.env.local` | Written by `convex dev` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` | Clerk dashboard, **API keys** (step 1) |
| `CLERK_SECRET_KEY` | `.env.local` | Clerk dashboard, **API keys** (step 1). Secret. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `.env.local` | `/sign-in`, added by `pnpm bootstrap` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `.env.local` | `/`, added by `pnpm bootstrap` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `.env.local` | `/`, added by `pnpm bootstrap` |
| `SEED_USER_PASSWORD` | `.env.local` | Optional. Password for new seed users (step 4). |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `.env.local` | Optional. Clerk dashboard, **Webhooks**, the endpoint's Signing Secret (step 7). Secret. |
| `N8N_HOST_PORT`, `MAILPIT_HOST_PORT` | `.env.local` | Optional. Host ports for the containers. See [Daily development](development.md#daily-development). |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex deployment | `pnpm setup:convex`, from the publishable key |
| `CLERK_SECRET_KEY` | Convex deployment | `pnpm setup:clerk`, from `.env.local`. Secret. |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Convex deployment | `pnpm setup:clerk`, from `.env.local`, if set. Secret. |
| `N8N_NOTIFY_URL` | Convex deployment | `pnpm setup:n8n` (the local n8n webhook URL) |
| `N8N_NOTIFY_SECRET` | Convex deployment, and the n8n credential "LendLoop signing: Convex to n8n" | `pnpm setup:n8n` (random). Secret. |
| `N8N_API_SECRET` | Convex deployment, and the n8n credential "LendLoop signing: n8n to Convex" | `pnpm setup:n8n` (random). Secret. |

To see the variables and values on your Convex deployment, run `pnpm exec convex env list --include-values`. To see the names only, run `pnpm exec convex env list --names-only`.

## Troubleshooting

**`convex dev` asks you to log in.** You used `--configure new`. Press `Ctrl+C` and run `pnpm exec convex dev` with no options.

**`convex dev` shows `Environment variable CLERK_JWT_ISSUER_DOMAIN is used in auth config file but its value was not set`.** The deployment is new, and setup has not set the Clerk issuer yet. Run `pnpm bootstrap`, or `pnpm setup:convex` while `convex dev` runs. `convex dev` pushes again by itself when the variable is set. `pnpm bootstrap` expects this message on its first run and continues.

**`pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS` for esbuild.** `pnpm-workspace.yaml` must contain `esbuild: true` under `allowBuilds`. The Convex CLI needs esbuild.

**The browser console shows `Clerk token has no email claim. Claims present: ...`.** The session token claims are missing. Do step 1.4, select **Save**, then reload the page. The setting applies to all users of the Clerk app, including existing users.

**The `users` table is empty after sign-in.** Read the recent Convex logs:

```sh
pnpm exec convex logs --history 10 --success
```
