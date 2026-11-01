import { format, parseISO } from "date-fns";
import type { Doc } from "@/convex/_generated/dataModel";

export { DESCRIPTION_MAX, NAME_MAX } from "@/convex/lib/limits";

export type ToolCategory = Doc<"tools">["category"];
export type ToolCondition = Doc<"tools">["condition"];

// Record types make TypeScript fail when the schema gets a value without a label.
export const categoryLabels: Record<ToolCategory, string> = {
  power_tools: "Power tools",
  hand_tools: "Hand tools",
  garden: "Garden",
  kitchen: "Kitchen",
  camping: "Camping",
  cleaning: "Cleaning",
  ladders: "Ladders",
  other: "Other",
};

export const conditionLabels: Record<ToolCondition, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  worn: "Worn",
};

export function isToolCategory(value: unknown): value is ToolCategory {
  return typeof value === "string" && Object.hasOwn(categoryLabels, value);
}

// The user's local calendar date, in the format that Convex queries expect.
export function localToday(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatDate(date: string): string {
  return format(parseISO(date), "MMM d");
}
