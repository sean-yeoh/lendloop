# Security

Access control, request signing, and data minimization.

## Access control

All access control is in the Convex functions. Anyone can call a public Convex function directly, so the UI checks are only for display.

Rules:

- **Identity comes from the verified Clerk token** (`ctx.auth`). No function accepts a user ID or a role from the client.
- **The role is stored in the `users` table.** New users get `user`. Only the internal functions `users:grantAdmin` and `users:revokeAdmin` change it (`pnpm admin:grant`), and account deletion resets it to `user`. In development, the internal `seed:run` also makes the seed account `admin+clerk_test@example.com` an admin. `pnpm db:seed` runs only with a Clerk development key. The browser cannot call internal functions.
- **Shared checks:** `requireUser`, `requireAdmin` (`convex/lib/auth.ts`), and `getLoanFor(lender | borrower)` (`convex/loans.ts`).
- **Two kinds of rule:** the role (`user` or `admin`), and ownership (the tool owner, the lender, or the borrower of a loan).
- **An admin is a user with extra rights.** Admins can also lend and borrow, under the same ownership rules as everyone else.
- **Each query returns only the fields that its caller needs.** No list returns an email.

| Function | Anyone | User | Admin | Rule | Test (`convex/*.test.ts`) |
|---|---|---|---|---|---|
| `tools.listPublic` | ✓ | ✓ | ✓ | Name and category only | listPublic › returns only name and category of active tools, without sign-in |
| `tools.list`, `tools.mine` | Empty | ✓ | ✓ | `mine`: own tools only | list › returns no tools to a caller that is not signed in. mine › returns only the caller's active tools |
| `tools.create` | ✗ | ✓ | ✓ | The owner is the caller | create › sets the owner from the token and trims input. create › rejects a caller that is not signed in |
| `tools.update` | ✗ | Owner | Owner | Admins cannot edit other users' tools | update › rejects other users and admins |
| `tools.remove` | ✗ | Owner | Any tool | Owner: refused while an approved loan is open. Admin: cancels future bookings. | remove › lets the owner and admins remove a tool, but not other users. remove › is refused for the owner while an approved loan is in progress (overdue, booked for later) |
| `tools.removalStatus` | null | Owner | Any tool | Borrower names, no emails | removalStatus › lists approved loans for the owner and admins, and nothing for other users |
| `loans.request` | ✗ | ✓ | ✓ | Not your own tool | request › rejects the owner's own tool. request › rejects a caller that is not signed in |
| `loans.approve`, `loans.decline`, `loans.markReturned` | ✗ | Lender | Lender | | approve › rejects the borrower and other users. decline and cancel › the lender declines, and the borrower cannot. markReturned › rejects the borrower and a loan that is not approved |
| `loans.cancel` | ✗ | Borrower | Borrower | Only while `requested` | decline and cancel › the borrower cancels a request, and the lender cannot |
| `loans.myRequests`, `loans.incoming`, `loans.navCounts` | Empty | Own loans | Own loans | Names, no emails | lists › myRequests and incoming show only the caller's loans, with names and no emails. signed out › list queries return no data, and mutations still reject |
| `loans.bookedRanges` | Empty | ✓ | ✓ | Dates only | bookedRanges › returns only the dates of approved loans, and nothing when signed out |
| `loans.listAll` | ✗ | ✗ | ✓ | | lists › listAll is for admins only |
| `users.listForAdmin` | ✗ | ✗ | ✓ | Names, no emails | Trusted Lender › listForAdmin returns names and tool counts, never emails, to admins only |
| `users.setTrustedLender` | ✗ | ✗ | ✓ | | Trusted Lender › a normal user cannot mark anyone, including themselves |
| `users.ensureUser`, `users.me` | ✗ / null | Self | Self | Never changes the role | ensureUser › updates email and name but keeps the role. me › returns null when not signed in |
| `notifications.listProblems`, `notifications.retry` | ✗ | ✗ | ✓ | Event and tool names, no emails | admin view › lists failed notifications and retries them, for admins only |
| `account.deletionStatus` | null | Self | Self | Names, no emails | deletionStatus › lists approved loans on both sides as blocking, with names only |
| `account.deleteMyAccount` | ✗ | Self | Self | Refused while a loan is approved and not returned | deleteMyAccount › is refused while the user is the lender (or borrower) on an approved loan |
| `users.grantAdmin`, `users.revokeAdmin`, `seed.run` | Internal | Internal | Internal | CLI with deployment access only | grantAdmin and revokeAdmin › grant, grant again, revoke, revoke again |
| `POST /clerk/webhook` | Clerk only | | | Clerk signature (Standard Webhooks) | POST /clerk/webhook › rejects a wrong signature and an unsigned request |

✓ allowed. ✗ rejected with an error. "Empty" returns no data. Signed-out callers get no data from list queries, because the Convex client re-runs open queries without a token during sign-out.

## Security and data minimization

### Security

| Area | Measure |
|---|---|
| Authentication | Clerk. Convex verifies the Clerk session token (`convex/auth.config.ts`). Signed-in pages send signed-out visitors to sign-in with `auth.protect()` (`components/auth/SignedInOnly.tsx`), as Clerk recommends. `/admin` answers 404 to signed-in users who are not admins (`components/auth/AdminOnly.tsx`). |
| Authorization | In every Convex function, by role and by ownership. See [Access control](#access-control). The UI checks are for display only. |
| Admin rights | Granted only by internal Convex functions from the CLI (`pnpm admin:grant`). No browser request can change a role. |
| Convex and n8n | HMAC-SHA256 signatures in both directions, a separate secret for each direction, a 5-minute timestamp window, and constant-time comparison. See [Request signing](automation.md#request-signing). |
| Clerk webhook | Verified with Clerk's `verifyWebhook` (Standard Webhooks signature, 5-minute timestamp window) and `CLERK_WEBHOOK_SIGNING_SECRET`. A bad signature gets 400. The handler is safe to repeat, because Clerk can send an event more than once. |
| Input validation | Convex argument validators, plus checks for name and description length, date format, date ranges, the client date, and loan status changes. |
| Concurrency | Convex mutations are serializable transactions. An approval checks the overlap again inside its transaction. |
| Secrets | In `.env.local` (ignored by Git), Convex environment variables, and encrypted n8n credentials. No secret is in the code or in the exported workflow JSON. The setup scripts pass secrets to Convex through stdin, and to n8n through a temporary file inside the container that is deleted after the import. |
| Local services | n8n and Mailpit listen on `127.0.0.1` only. |

### Data minimization

The app stores only what it needs: Convex keeps each user's Clerk ID, email, display name, role, and Trusted Lender flag. Clerk keeps the sign-in data. No phone numbers, addresses, or payment data are collected.

Each caller gets only the fields that it needs:

| Who | Gets | Does not get |
|---|---|---|
| Visitors (public page) | Tool name and category | Owners, IDs, availability |
| Signed-in users (tool list) | Tool details, availability, the owner's display name and Trusted Lender flag | Any email address, owner IDs |
| Borrowers and lenders (loan lists) | The other person's display name, dates, status, activity times | Any email address |
| Booking calendar | Approved date ranges | Who borrowed the tool |
| Admins | Names, roles, tool counts, all loans with names | Email addresses |
| n8n request notification | The recipient's name and email, the other person's name, the tool name, the dates | Other email addresses, user IDs |
| n8n overdue list | The borrower's name and email, the lender's name, the tool name, the end date | The lender's email, user IDs |

- **Display names never fall back to the full email address.** If Clerk has no name, the app uses the part of the email before `@`.
- **The email address is used only for notifications and reminders**, and only n8n receives it.
- **Users can delete their account.** Convex clears the email and name, and Clerk deletes the sign-in data. See [Decisions](architecture.md#decisions).
- **Logs:** error messages contain no email addresses or secrets. The one exception is the admin CLI error "No user with email …", which only the operator sees.

Known gaps are listed in the [production note](deployment.md#data-and-privacy).
