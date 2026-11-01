import { describe, expect, test } from "vitest";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  hmacHex,
  signRequest,
  verifyRequest,
} from "./signature";

const SECRET = "test-secret";
const NOW = Date.parse("2026-11-10T12:00:00Z");
const request = { method: "POST", pathAndQuery: "/n8n/reminders", body: '{"loanId":"x"}' };

async function signed(overrides: Partial<typeof request> = {}, signedAt = NOW) {
  const headers = new Headers(await signRequest(SECRET, request, signedAt));
  return { ...request, ...overrides, headers };
}

describe("signature", () => {
  test("matches a known HMAC-SHA256 value", async () => {
    // RFC 4231 test case 2.
    expect(await hmacHex("Jefe", "what do ya want for nothing?")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });

  test("accepts a correctly signed request", async () => {
    expect(await verifyRequest(SECRET, await signed(), NOW)).toEqual({ ok: true });
  });

  test("rejects a changed body, method, or path", async () => {
    for (const change of [
      { body: '{"loanId":"y"}' },
      { method: "GET" },
      { pathAndQuery: "/n8n/overdue" },
    ]) {
      expect(await verifyRequest(SECRET, await signed(change), NOW)).toEqual({
        ok: false,
        reason: "Invalid signature",
      });
    }
  });

  test("rejects the wrong secret", async () => {
    expect(await verifyRequest("other-secret", await signed(), NOW)).toMatchObject({ ok: false });
  });

  test("rejects a timestamp older than five minutes, as a replay", async () => {
    const old = await signed({}, NOW - 6 * 60 * 1000);
    expect(await verifyRequest(SECRET, old, NOW)).toEqual({
      ok: false,
      reason: "Timestamp is too old or in the future",
    });
  });

  test("rejects missing headers", async () => {
    const headers = new Headers({ [TIMESTAMP_HEADER]: String(NOW / 1000) });
    expect(await verifyRequest(SECRET, { ...request, headers }, NOW)).toEqual({
      ok: false,
      reason: "Missing signature headers",
    });
    expect(SIGNATURE_HEADER).toBe("X-LendLoop-Signature");
  });
});
