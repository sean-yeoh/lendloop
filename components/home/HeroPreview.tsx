import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/tools/CategoryIcon";
import type { ToolCategory } from "@/lib/tools";

// Decorative example cards. They are not real listings, so screen readers skip them.
const examples: { name: string; category: ToolCategory; status: string; tone: "secondary" | "outline" }[] = [
  { name: "Cordless drill", category: "power_tools", status: "Available", tone: "secondary" },
  { name: "Extension ladder", category: "ladders", status: "On loan until Sat", tone: "outline" },
  { name: "Two-person tent", category: "camping", status: "Available", tone: "secondary" },
];

export function HeroPreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-sm select-none">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-2xl" />
      <div className="flex flex-col gap-3">
        {examples.map((tool, index) => (
          <div
            key={tool.name}
            className={[
              "flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10",
              index === 1 ? "translate-x-6" : "",
            ].join(" ")}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CategoryIcon category={tool.category} className="size-5" />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="font-medium">{tool.name}</span>
              <span className="text-xs text-muted-foreground">Lent by a neighbor</span>
            </span>
            <Badge variant={tool.tone}>{tool.status}</Badge>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs shadow-sm ring-1 ring-foreground/10">
          <span className="size-2 rounded-full bg-primary" />
          Request approved for Fri to Sun
        </div>
      </div>
    </div>
  );
}
