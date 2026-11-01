import type { ReactNode } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Availability } from "@/convex/tools";
import {
  categoryLabels,
  conditionLabels,
  formatDate,
  type ToolCategory,
  type ToolCondition,
} from "@/lib/tools";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { CategoryIcon } from "./CategoryIcon";

export function ToolCard({
  name,
  category,
  condition,
  description,
  availability,
  lender,
  actions,
}: {
  name: string;
  category: ToolCategory;
  condition: ToolCondition;
  description: string;
  availability: Availability;
  // Left side of the footer, for example the lender's name.
  lender?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CategoryIcon category={category} className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <CardTitle className="truncate">{name}</CardTitle>
            <p className="truncate text-xs text-muted-foreground">
              {categoryLabels[category]} · {conditionLabels[condition]}
            </p>
          </div>
        </div>
        <CardAction>
          <AvailabilityBadge availability={availability} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <p className="line-clamp-2 min-h-10 text-muted-foreground">
          {description || "No description."}
        </p>
        {availability.state === "available" && availability.nextBookedFrom && (
          <p className="text-xs text-muted-foreground">
            Booked from {formatDate(availability.nextBookedFrom)}
          </p>
        )}
      </CardContent>
      {(lender || actions) && (
        <CardFooter className="justify-between gap-3">
          <div className="min-w-0">{lender}</div>
          <div className="flex shrink-0 gap-2">{actions}</div>
        </CardFooter>
      )}
    </Card>
  );
}
