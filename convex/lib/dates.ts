import { ConvexError } from "convex/values";

// Calendar dates are "YYYY-MM-DD" strings. In this format, string comparison is date comparison.
export function assertDate(value: string, field: string): void {
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
  if (!valid) throw new ConvexError(`${field} must be a date in YYYY-MM-DD format`);
}
