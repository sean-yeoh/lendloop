import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLocalToday } from "@/hooks/useLocalToday";

const NONE = { incomingPending: 0, myOverdue: 0 };

// Live counts for the header badges. Convex pushes new counts when loans change.
export function useNavCounts() {
  const today = useLocalToday();
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.loans.navCounts, isAuthenticated && today ? { today } : "skip") ?? NONE;
}
