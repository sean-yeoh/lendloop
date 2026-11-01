// HMAC-SHA256 request signing between Convex and n8n, in both directions.
//
// The signed message is `${timestamp}.${method}.${pathAndQuery}.${body}`, so a signature is valid
// for one request only. The timestamp (Unix seconds) limits replays to MAX_AGE_SECONDS.

export const TIMESTAMP_HEADER = "X-LendLoop-Timestamp";
export const SIGNATURE_HEADER = "X-LendLoop-Signature";
export const MAX_AGE_SECONDS = 300;

export async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function signedMessage(timestamp: string, method: string, pathAndQuery: string, body: string) {
  return `${timestamp}.${method.toUpperCase()}.${pathAndQuery}.${body}`;
}

export async function signRequest(
  secret: string,
  request: { method: string; pathAndQuery: string; body: string },
  nowMs: number,
): Promise<Record<string, string>> {
  const timestamp = String(Math.floor(nowMs / 1000));
  const signature = await hmacHex(
    secret,
    signedMessage(timestamp, request.method, request.pathAndQuery, request.body),
  );
  return { [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: signature };
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export async function verifyRequest(
  secret: string,
  request: { method: string; pathAndQuery: string; body: string; headers: Headers },
  nowMs: number,
): Promise<VerifyResult> {
  const timestamp = request.headers.get(TIMESTAMP_HEADER);
  const signature = request.headers.get(SIGNATURE_HEADER);
  if (!timestamp || !signature) return { ok: false, reason: "Missing signature headers" };
  if (!/^\d+$/.test(timestamp)) return { ok: false, reason: "Invalid timestamp" };
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > MAX_AGE_SECONDS) {
    return { ok: false, reason: "Timestamp is too old or in the future" };
  }

  const expected = await hmacHex(
    secret,
    signedMessage(timestamp, request.method, request.pathAndQuery, request.body),
  );
  if (!constantTimeEqual(expected, signature.toLowerCase())) {
    return { ok: false, reason: "Invalid signature" };
  }
  return { ok: true };
}

// Compares every character, so the time taken does not reveal how much of a signature matched.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
