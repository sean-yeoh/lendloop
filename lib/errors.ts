import { ConvexError } from "convex/values";

// Convex functions throw ConvexError with a message for the user. Other errors are unexpected.
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return "Something went wrong. Try again.";
}
