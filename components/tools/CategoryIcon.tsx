import {
  Construction,
  CookingPot,
  Drill,
  Hammer,
  Package,
  SprayCan,
  Sprout,
  Tent,
  type LucideIcon,
} from "lucide-react";
import type { ToolCategory } from "@/lib/tools";

const icons: Record<ToolCategory, LucideIcon> = {
  power_tools: Drill,
  hand_tools: Hammer,
  garden: Sprout,
  kitchen: CookingPot,
  camping: Tent,
  cleaning: SprayCan,
  ladders: Construction,
  other: Package,
};

export function CategoryIcon({ category, className }: { category: ToolCategory; className?: string }) {
  const Icon = icons[category];
  return <Icon aria-hidden className={className} />;
}
