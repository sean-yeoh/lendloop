# Production note

This note lists what must change, or be added, before LendLoop runs in production. The current setup is for local development: a local Convex backend, a Clerk development instance, and n8n and Mailpit in containers.

## Deployment

| Part | Local | Production |
|---|---|---|
| Web app | `next dev` | Vercel or another Next.js host, with HTTPS. Preview deployments per pull request. |
| Convex | Local backend (`convex dev`) | A Convex cloud production deployment. Deploy with `convex deploy` from CI, with a deploy key stored as a CI secret. |
| Clerk | Development instance, `+clerk_test` users | A production instance on the app's domain. Set the same session token claims (`email`, `name`, `aud: convex`). |
| n8n | Container, SQLite, `127.0.0.1` | n8n Cloud, or self-hosted with HTTPS, PostgreSQL, and backups. Queue mode with workers if the volume grows. |
| Email | Mailpit | A transactional email service (for example Postmark or Amazon SES) with SPF, DKIM, and DMARC on the sending domain. |

Configuration changes:

- **Secrets per environment.** Create new `N8N_NOTIFY_SECRET` and `N8N_API_SECRET` values for each environment. Never reuse development secrets. `scripts/n8n-setup.mjs` is for local use only. In production, set the Convex variables with `convex env set --prod` and create the n8n credentials in the n8n UI or with the n8n API.
- **URLs in the workflows.** The Convex URL and the app URL are plain values in the workflow files. Replace them with the production URLs (`https://<deployment>.convex.site` and the app domain), or keep one workflow copy per environment. Keep n8n's default block on environment variable access.
- **Webhook URL.** Set `N8N_NOTIFY_URL` on Convex to the public HTTPS webhook URL of the production n8n.
- **Admin rights.** Run `users:grantAdmin` against the production deployment (`convex run --prod`) with a deploy key. Keep the list of admins small, and record each change.

## Security

- **Rate limiting.** Add limits to the mutations that users can repeat (tool creation, loan requests), for example with the Convex rate limiter component, and to the n8n endpoints.
- **Secret rotation.** Support two active secrets for a short period, so a secret can change without failed requests.
- **Clerk route protection.** Clerk deprecated `createRouteMatcher`, which `proxy.ts` uses for redirects. Move the sign-in check into each protected page or layout, as the Clerk migration guide describes. Data access is not affected, because Convex checks every call.
- **Security headers.** Add a Content Security Policy and the usual headers (HSTS, `X-Content-Type-Options`, `Referrer-Policy`) in the Next.js config.
- **Audit log.** Record admin actions (listing removals, Trusted Lender changes, role changes) with who and when.
- **Dependency updates.** Turn on automated dependency updates and a vulnerability check in CI. The container images are pinned and must be updated on purpose.

## Reliability and monitoring

- **Failed notifications.** The outbox already retries and marks failures. Add an alert when the number of failed notifications is above zero, in addition to the admin tab.
- **Error workflow target.** Send n8n error alerts to the team's chat or paging tool, not to an email inbox only.
- **Reminder schedule health.** Alert if the daily reminder run did not finish, for example with a heartbeat check.
- **Logs and traces.** Stream Convex logs to a log service. Keep n8n execution data for a limited time.
- **Backups.** Schedule Convex exports and n8n database backups, and test a restore.
- **Time zones.** The browser sends its local date, and the reminder runs in the n8n time zone. For users in many time zones, store each user's time zone and send reminders in the user's morning.

## Scale

- **Pagination.** Lists show at most 200 rows. Use Convex pagination for tools, loans, and the admin tables.
- **Availability.** Availability is calculated per tool from approved loans on every list request. With many tools, keep a summary field per tool, updated by the loan mutations, or paginate the list.
- **Search.** Add a Convex search index for tool names and descriptions.

## Data and privacy

- **Account deletion.** Create a `user.deleted` webhook endpoint in the Clerk production instance, pointing to `https://<deployment>.convex.site/clerk/webhook`. Set `CLERK_WEBHOOK_SIGNING_SECRET` and `CLERK_SECRET_KEY` (the production key) with `convex env set --prod`. Turn off self-deletion for existing production users once, with the Backend API (`scripts/clerk-setup.mjs` runs on development keys only).
- **Dashboard deletions with loans in progress.** A user deleted in the Clerk Dashboard keeps their loans in progress. If that user was the lender, nobody can mark the tool returned. The same happens when an admin removes a listing that is out on loan and the owner's account is later deleted. Add an admin action to close such a loan.
- **Data export.** Add an export of a user's own data on request.
- **Retention.** Delete old `notifications` rows (for example after 90 days) and decide how long to keep loan history.
- **Email preferences.** Reminders and notifications are service emails. Add an option to stop non-essential emails, and include it in every email.
- **Personal data in third parties.** n8n receives recipient names and email addresses. Include n8n and the email service in the list of data processors, and set n8n execution data retention.

## Product gaps

These are outside the current requirements, and recorded as possible next steps:

- **Pickup arrangement.** The app shows names only, so borrowers and lenders cannot contact each other in the app. Options: in-app messages, or sharing contact details after approval with consent.
- **Owner-blocked dates**, with a `toolBlocks` table checked by the same overlap rule as loans.
- **Borrower cancellation of an approved loan** before the start date.
- **Borrower "I returned it"** that the lender confirms.

## Testing and CI

- **CI pipeline.** On every pull request: type check, lint, the Convex tests, and `next build`.
- **End-to-end tests.** Add browser tests (for example Playwright) for sign-in, listing a tool, requesting, approving, and returning.
- **Workflow tests.** The n8n workflows are tested by hand today. Add a test that imports them into a disposable n8n container and calls the webhook with signed requests.
