import { ConvexError } from "convex/values";

// Calendar dates are "YYYY-MM-DD" strings. In this format, string comparison is date comparison.
export function assertDate(value: string, field: string): void {
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
  if (!valid) throw new ConvexError(`${field} must be a date in YYYY-MM-DD format`);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The client sends its local date, because the server does not know the user's time zone.
// Time zones differ from UTC by less than one day, so a larger difference is rejected.
export function assertClientToday(today: string, now: number): void {
  assertDate(today, "today");
  const serverDay = Date.parse(new Date(now).toISOString().slice(0, 10));
  if (Math.abs(Date.parse(today) - serverDay) > DAY_MS) {
    throw new ConvexError("today does not match the current date");
  }
}

// Loans cover full days, so ranges that share a day overlap.
export function rangesOverlap(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}
