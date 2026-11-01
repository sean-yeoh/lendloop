# Architecture

The data model, the main design decisions, and the pages.

## Data model

The schema is in `convex/schema.ts`.

| Table | Purpose |
|---|---|
| `users` | One row for each Clerk user. Has the `admin` or `user` role, the `trustedLender` flag, and `deletedAt` for deleted accounts. |
| `tools` | Tool listings: name, category, condition, description, owner, and status (`active` or `removed`). |
| `loans` | Borrow requests and loans for a date range. |
| `loanEvents` | Loan activity, from users and from n8n (for example `reminder_sent`). |
| `notifications` | Outbox for n8n request notifications: `pending`, `sent`, or `failed`, with the attempt count and the last error. |

Loan status changes:

```
requested -> approved -> returned
requested -> declined
requested -> cancelled
approved  -> cancelled   (a future booking, when the listing is removed or the account is closed)
```

### Decisions

- **Categories and conditions are fixed lists in code.** The filter cannot get duplicates such as "Garden" and "gardening". To add a value, change the schema and deploy. If the list must change often, move it to a table that admins manage.
- **Deleting a tool is a soft delete.** The status changes to `removed`, and the tool does not show in lists. Loans keep a valid reference to the tool.
- **Availability is calculated, not stored.** A tool is "on loan" when it has an approved loan that includes today, or an approved loan that is overdue. If availability were also stored on the tool, the two values could disagree. An available tool with a future approved loan also shows "Booked from <date>".
- **The client sends "today" to queries that show availability.** Convex does not re-run a query when `Date.now()` changes ([Convex best practices](https://docs.convex.dev/understanding/best-practices/#date-in-queries)). The client sends its local date. The date changes once a day, so query caching stays effective. "Today" is the user's local date, which is correct for a neighborhood app.
- **The public list shows all active tools,** with name and category only. It does not show availability, owners, or IDs.
- **Signed-in users see the owner's name and Trusted Lender badge,** but never the owner's email.
- **Only the owner can edit a tool.** Admins can remove any tool, but cannot edit it.
- **The owner cannot remove a tool while an approved loan is open** (in progress, overdue, or booked for later), because the tool must come back first. The remove dialog lists the blocking loans. The same rule blocks account deletion.
- **An admin can remove any listing**, for example an abusive one. Convex declines its pending requests, cancels its future bookings (event `withdrawn`), and emails each borrower. Loans in progress stay, because the borrower must still return the tool. Removal is a soft delete in both cases (`convex/lib/listings.ts`).
- **Signed-in list queries return no data to signed-out callers, and do not throw.** On sign-out, the Convex client re-runs open queries without a token before the page can stop them. An error there only adds noise to the logs. Mutations, and admin queries for non-admins, still throw.
- **The header shows count badges** for requests that wait for your answer and for your overdue loans. These are the two cases where the user must act. Status changes reach users through the n8n notifications, so the app does not track "seen" state.
- **Lists show at most 200 tools.** Pagination is a later step.
- **Dates are calendar dates (`YYYY-MM-DD`).** A loan covers full days, and there are no timezone conversions. Strings in this format compare correctly.
- **Overlapping requests:** pending requests can overlap. A request cannot overlap an approved loan. Convex checks this when the request is created, and again when the lender approves it. When the lender approves a request, Convex declines the other pending requests that overlap it, and notifies those borrowers.
- **Only the lender marks a loan returned,** because the lender receives the tool. `returnedAt` records the time. A return after `endDate` is a late return. Until the lender marks it returned, the loan is overdue and n8n sends reminders.
- **The borrower can cancel a request** while its status is `requested`.
- **A borrower cannot send two overlapping requests for the same tool.** Different borrowers can.
- **Mutations check the client's "today".** The borrower's local date decides if a start date is in the past. Convex accepts a client date only within one day of the server date, so a client cannot move "today" far back.
- **Overdue is not a status.** A loan is overdue when its status is `approved` and its `endDate` is before today.
- **Loan activity shows automation results.** Each loan in My requests, Incoming, and the admin loan list shows the last n8n reminder ("Reminder sent 2 days ago", with the count) and the delivery status of the latest notification email. It shows times and statuses only, no message content.
- **Trusted Lender is a badge.** Admins give it to reliable lenders. Signed-in users see it next to the lender's name. It changes no loan rules.
- **The admin user list shows names, not emails.** The Trusted Lender decision needs no contact data.
- **Account deletion is in LendLoop, and is blocked while a loan is active.** **Manage account** has a **Delete account** page (`components/account/DeleteAccountPage.tsx`). An approved loan that is not returned blocks deletion, on either side, because the tool must still come back. When deletion is allowed, Convex removes the user's listings, declines incoming pending requests, cancels the user's own pending requests (the other person is notified), anonymizes the user row, and then deletes the Clerk user with the Backend API, with retries. Clerk's own **Delete account** is turned off for each user (`delete_self_enabled: false`), when Convex creates the user and in `pnpm setup:clerk`, so it cannot skip the loan check.
- **A deleted user row is anonymized, not deleted.** Other users' loan history refers to it. The name becomes "Deleted user", the email is cleared, and admin and Trusted Lender are removed. The Clerk user ID stays, so a repeated webhook and an old session are recognized. It identifies no one once the Clerk user is deleted. A deleted account counts as signed out in every Convex function, and gets no notifications or reminders.
- **A deletion in the Clerk Dashboard cannot be blocked.** The Clerk `user.deleted` webhook (`POST /clerk/webhook` on Convex) closes the account in the same way, without the loan check. Future bookings on both sides are cancelled, and the other person is notified. Loans in progress stay, so the lender can still mark the tool returned.
- **Owners cannot block dates.** This is out of scope for now. The owner controls each loan with approve and decline. A possible next step is a `toolBlocks` table, checked with the same overlap rule as loans.

## Pages

| Path | Who | What |
|---|---|---|
| `/` | Anyone | Marketing page: tagline, how it works, the public tool list (name and category only), and sign-in. |
| `/sign-in` | Anyone | Clerk sign-in and sign-up in one flow, styled with the app theme. |
| `/tools` | Signed-in users | All tools with availability, filtered by category (`?category=garden`). Request a tool for a date range. Edit or remove your own tools. Admins can remove any tool here. |
| `/my-listings` | Signed-in users | Your tools. Add, edit, and remove. |
| `/requests` | Signed-in users | "My requests": tools that you asked to borrow. Cancel a pending request. |
| `/incoming` | Signed-in users | "Incoming requests": requests for your tools. Approve, decline, and mark returned. |
| `/admin` | Admins | All loans with a status filter and activity, all listings with remove, users with the Trusted Lender switch, and notifications that failed or are retrying, with **Retry**. |

Each signed-in page checks sign-in on the server with `auth.protect()` (`components/auth/SignedInOnly.tsx`), and sends signed-out visitors to `/sign-in`. Clerk recommends this per-page check instead of route matching in `proxy.ts` (`createRouteMatcher` is deprecated). `/admin` also asks Convex for the visitor's role with their Clerk token, and answers 404 to anyone who is not an admin, so the page does not reveal that it exists (`components/auth/AdminOnly.tsx`). `proxy.ts` only runs `clerkMiddleware()`, which makes the session available. This check is for UX only. The Convex functions check access on each call.

The browser sends its local date to the availability queries. The date is read only in the browser, because the server does not know the user's time zone, and Next.js prerenders pages with Cache Components.
