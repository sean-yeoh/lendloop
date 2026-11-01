@AGENTS.md

# LendLoop

LendLoop is a neighborhood tool-lending board. Neighbors list tools they can lend, request to borrow tools for a date range, and get automated notifications and overdue reminders through n8n.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- shadcn/ui components on Base UI primitives (`components/ui`)
- Clerk for authentication
- Convex for data and backend logic
- n8n (self-hosted in Podman or Docker) for workflow automation
- pnpm as the package manager

## Product scope

- The home page is public. It shows the LendLoop name and tagline, a read-only list of available tools (name and category only, no owner details), and a "Sign in to lend or borrow" button.
- Signed-in users list tools (name, category, condition, description), request a loan for a date range, approve or decline requests for their own tools, and mark a loan as returned.
- Pages: all tools with availability and a category filter, "My listings", "My requests", "Incoming requests", and an admin page.
- Roles:
  - `admin`: removes any listing, sees all loans, and marks a lender as "Trusted Lender".
  - `user`: creates, edits, and deletes only their own listings, and acts only on requests for their own tools or their own borrowing.
- n8n workflows:
  - Request notification: Convex calls an n8n webhook when a borrow request is created or changes status.
  - Overdue reminders: a daily workflow gets overdue loans from a Convex HTTP endpoint, sends reminders, and writes the reminder status back to Convex.
  - Error alerts: an error workflow makes failed runs visible.
- Each loan shows recent automation activity, for example "Reminder sent 2 days ago".
- Users can delete their account, unless a loan is still active.

## Rules

- Enforce all access control in Convex functions. UI checks are for UX only.
- Never trust a role or user ID from the client. Get the identity from `ctx.auth`.
- Return only the fields each caller needs. The public query returns only tool name and category.
- Sign all requests between Convex and n8n with HMAC-SHA256, in both directions.
- Make write-backs from n8n idempotent.
- Keep secrets in environment variables and n8n credentials. Never put secrets in code or in exported workflow JSON.
- Record assumptions and design decisions in the docs, not only in code.
- Use Conventional Commits for commit messages (for example `feat: add borrow request mutation`).
