import { Badge } from "@/components/ui/badge";
import type { Availability } from "@/convex/tools";
import { formatDate } from "@/lib/tools";

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  switch (availability.state) {
    case "available":
      return <Badge variant="secondary">Available</Badge>;
    case "on_loan":
      return <Badge variant="outline">On loan until {formatDate(availability.until)}</Badge>;
    case "overdue":
      return <Badge variant="destructive">Overdue since {formatDate(availability.since)}</Badge>;
  }
}
