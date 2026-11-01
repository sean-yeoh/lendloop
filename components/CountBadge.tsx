import { cn } from "cn";

// A small count pill for navigation. Hidden when the count is zero.
export function CountBadge({
  count,
  label,
  tone = "primary",
  className,
}: {
  count: number;
  label: string;
  tone?: "primary" | "destructive";
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[11px] leading-none font-semibold tabular-nums",
        tone === "primary" ? "bg-primary text-primary-foreground" : "bg-destructive text-white",
        className,
      )}
    >
      {count}
      <span className="sr-only"> {label}</span>
    </span>
  );
}
