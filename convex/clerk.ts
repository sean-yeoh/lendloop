import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { RETRY_DELAYS_MS } from "./notifications";

// Calls to the Clerk Backend API (https://clerk.com/docs/reference/backend-api), with
// CLERK_SECRET_KEY from the Convex environment. Failed calls are retried with the same delays as
// notifications.
const CLERK_API_URL = "https://api.clerk.com/v1";
const REQUEST_TIMEOUT_MS = 10_000;

// Hides Clerk's own "Delete account" button and makes Clerk refuse self-deletion, so users delete
// their account in LendLoop, where active loans are checked first.
export const disableSelfDelete = internalAction({
  args: { clerkUserId: v.string(), attempt: v.optional(v.number()) },
  handler: async (ctx, { clerkUserId, attempt = 1 }) => {
    const result = await clerkRequest("PATCH", clerkUserId, { delete_self_enabled: false });
    if (result.ok || result.status === 404) return;
    if (result.permanent || attempt > RETRY_DELAYS_MS.length) {
      console.error(`Could not turn off self-deletion for a Clerk user: ${result.error}`);
      return;
    }
    await ctx.scheduler.runAfter(RETRY_DELAYS_MS[attempt - 1]!, internal.clerk.disableSelfDelete, {
      clerkUserId,
      attempt: attempt + 1,
    });
  },
});

// Runs after convex/account.ts has anonymized the user. A user that Clerk no longer has counts as
// deleted, so a repeated call is safe.
export const deleteUser = internalAction({
  args: { clerkUserId: v.string(), attempt: v.optional(v.number()) },
  handler: async (ctx, { clerkUserId, attempt = 1 }) => {
    const result = await clerkRequest("DELETE", clerkUserId);
    if (result.ok || result.status === 404) return;
    if (result.permanent || attempt > RETRY_DELAYS_MS.length) {
      console.error(`Could not delete a Clerk user: ${result.error}`);
      return;
    }
    await ctx.scheduler.runAfter(RETRY_DELAYS_MS[attempt - 1]!, internal.clerk.deleteUser, {
      clerkUserId,
      attempt: attempt + 1,
    });
  },
});

type ClerkResult =
  | { ok: true }
  // permanent: retrying cannot help, for example when the secret key is missing.
  | { ok: false; status?: number; error: string; permanent: boolean };

async function clerkRequest(
  method: "PATCH" | "DELETE",
  clerkUserId: string,
  body?: object,
): Promise<ClerkResult> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return {
      ok: false,
      error: "CLERK_SECRET_KEY is not set on the Convex deployment",
      permanent: true,
    };
  }
  try {
    const response = await fetch(`${CLERK_API_URL}/users/${encodeURIComponent(clerkUserId)}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.ok) return { ok: true };
    // 4xx other than 404 and 429 means the request itself is wrong, so it is not retried.
    const permanent =
      response.status >= 400 && response.status < 500 && ![404, 429].includes(response.status);
    return {
      ok: false,
      status: response.status,
      error: `Clerk responded with HTTP ${response.status}`,
      permanent,
    };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
      permanent: false,
    };
  }
}
