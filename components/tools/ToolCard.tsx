import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { Availability } from "@/convex/tools";
import { categoryLabels, conditionLabels, type ToolCategory, type ToolCondition } from "@/lib/tools";
import { AvailabilityBadge } from "./AvailabilityBadge";

export function ToolCard({
  name,
  category,
  condition,
  description,
  availability,
  meta,
  actions,
}: {
  name: string;
  category: ToolCategory;
  condition: ToolCondition;
  description: string;
  availability: Availability;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <p className="text-muted-foreground">
          {categoryLabels[category]} · {conditionLabels[condition]} condition
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {description && <p>{description}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <AvailabilityBadge availability={availability} />
          {meta}
        </div>
      </CardContent>
      {actions && <CardFooter className="gap-2">{actions}</CardFooter>}
    </Card>
  );
}

export function TrustedLenderBadge() {
  return <Badge>Trusted Lender</Badge>;
}
