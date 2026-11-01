import { format, parseISO } from "date-fns";
import type { Doc } from "@/convex/_generated/dataModel";

export type LoanStatus = Doc<"loans">["status"];

// Calendar dates in Convex are "YYYY-MM-DD". The date picker works with local Date objects.
export function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function fromDateString(date: string): Date {
  return parseISO(date);
}

export function formatRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (startDate === endDate) return format(start, "EEE, MMM d");
  return `${format(start, "MMM d")} to ${format(end, "MMM d")}`;
}

// Overdue is calculated, not stored: approved and the end date is before today.
export function isOverdue(loan: { status: LoanStatus; endDate: string }, today: string): boolean {
  return loan.status === "approved" && loan.endDate < today;
}
