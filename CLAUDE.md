@AGENTS.md

# LendLoop

LendLoop is a neighborhood tool-lending board. Neighbors list tools they can lend, request to borrow tools for a date range, and get automated notifications and overdue reminders through n8n.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- Clerk for authentication
- Convex for data and backend logic
- n8n (self-hosted in Podman or Docker) for workflow automation
- pnpm as the package manager

## Requirements summary

- Public page: company name, tagline, a read-only list of available tools (name and category only, no owner details), and a "Sign in to lend or borrow" button.
- Signed-in users: list tools (name, category, condition, description), request a loan for a date range, approve or decline requests on their own tools, mark a loan as returned.
- Views: all tools with availability status and a category filter, "My listings", "My requests", "Incoming requests".
- Roles:
  - `admin`: remove any listing, view all loans, mark a lender as "Trusted Lender".
  - `user`: create, edit, and delete only their own listings. Act only on requests that involve their own tools or their own borrowing.
- n8n workflows:
  - Request notification: Convex calls an n8n webhook when a borrow request is created or changes status.
  - Overdue reminders: a daily workflow gets overdue loans from a Convex HTTP endpoint, sends reminders, and writes the reminder status back to Convex.
  - An error workflow, so failed runs are visible.
- Loan activity: show recent automation activity on each loan (for example "Reminder sent 2 days ago").

## Rules

- Enforce all access control in Convex functions. UI checks are for UX only.
- Never trust a role or user ID from the client. Get the identity from `ctx.auth`.
- Return only the fields each caller needs. The public query returns only tool name and category.
- Sign all requests between Convex and n8n with HMAC-SHA256, in both directions.
- Make write-backs from n8n idempotent.
- Keep secrets in environment variables and n8n credentials. Never put secrets in code or in exported workflow JSON.
- Record assumptions and design decisions in the docs, not only in code.
- Use Conventional Commits for commit messages (for example `feat: add borrow request mutation`).
