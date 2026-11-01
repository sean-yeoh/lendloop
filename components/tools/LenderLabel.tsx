import { BadgeCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// The lender's initials and name. A Trusted Lender gets a check mark with a text label for
// screen readers and a tooltip.
export function LenderLabel({ name, trustedLender }: { name: string; trustedLender: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <Avatar size="sm">
        <AvatarFallback className="bg-secondary text-[10px] font-medium text-secondary-foreground">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
      {trustedLender && <TrustedLenderMark />}
    </span>
  );
}

export function TrustedLenderMark() {
  return (
    <span title="Trusted Lender" className="inline-flex shrink-0 text-primary">
      <BadgeCheck aria-hidden className="size-4" />
      <span className="sr-only">Trusted Lender</span>
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}
