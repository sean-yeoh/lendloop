import { ConvexError } from "convex/values";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { verifyRequest } from "./lib/signature";

// Endpoints for n8n. Every request must be signed with N8N_API_SECRET (see lib/signature.ts).
const http = httpRouter();

http.route({
  path: "/n8n/overdue",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const denied = await verify(request, "");
    if (denied) return denied;
    const date = new URL(request.url).searchParams.get("date");
    if (!date) return json({ error: "The date query parameter is required" }, 400);
    return await run(() => ctx.runQuery(internal.automation.overdueForReminders, { date }));
  }),
});

http.route({
  path: "/n8n/reminders",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const denied = await verify(request, body);
    if (denied) return denied;

    let input: { loanId?: unknown; date?: unknown };
    try {
      input = JSON.parse(body);
    } catch {
      return json({ error: "The body must be JSON" }, 400);
    }
    if (typeof input.loanId !== "string" || typeof input.date !== "string") {
      return json({ error: "loanId and date are required strings" }, 400);
    }
    const { loanId, date } = input;
    return await run(async () => {
      const result = await ctx.runMutation(internal.automation.recordReminder, { loanId, date });
      const { status, ...rest } = result;
      return { status, body: rest };
    });
  }),
});

async function verify(request: Request, body: string): Promise<Response | null> {
  const secret = process.env.N8N_API_SECRET;
  if (!secret) return json({ error: "N8N_API_SECRET is not set on the Convex deployment" }, 500);
  const url = new URL(request.url);
  const result = await verifyRequest(
    secret,
    { method: request.method, pathAndQuery: url.pathname + url.search, body, headers: request.headers },
    Date.now(),
  );
  return result.ok ? null : json({ error: result.reason }, 401);
}

// Runs the handler and turns validation errors (ConvexError) into 400 responses.
async function run(handler: () => Promise<unknown>): Promise<Response> {
  try {
    const result = await handler();
    if (result && typeof result === "object" && "status" in result && "body" in result) {
      const { status, body } = result as { status: number; body: unknown };
      return json(body, status);
    }
    return json(result, 200);
  } catch (error) {
    if (error instanceof ConvexError) return json({ error: String(error.data) }, 400);
    throw error;
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default http;
