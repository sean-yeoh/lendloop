import { useSyncExternalStore } from "react";
import { localToday } from "@/lib/tools";

const subscribe = () => () => {};

// The user's local date. It is null during prerendering, because the server does not know the
// user's time zone, and Next.js does not allow new Date() in a prerendered Client Component.
export function useLocalToday(): string | null {
  return useSyncExternalStore(subscribe, localToday, () => null);
}
