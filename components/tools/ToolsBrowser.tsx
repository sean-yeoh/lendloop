"use client";

import { useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { useLocalToday } from "@/hooks/useLocalToday";
import { categoryLabels, isToolCategory, type ToolCategory } from "@/lib/tools";
import { RemoveToolDialog } from "./RemoveToolDialog";
import { ToolCard, TrustedLenderBadge } from "./ToolCard";

const ALL = "all";
const filterItems = { [ALL]: "All categories", ...categoryLabels };

export function ToolsBrowser({ category }: { category?: ToolCategory }) {
  const router = useRouter();
  const pathname = usePathname();
  const today = useLocalToday();
  const me = useQuery(api.users.me);
  const tools = useQuery(api.tools.list, today ? { today, category } : "skip");

  function onCategoryChange(value: string | null) {
    router.replace(isToolCategory(value) ? `${pathname}?category=${value}` : pathname);
  }

  return (
    <div className="flex flex-col gap-6">
      <Select items={filterItems} value={category ?? ALL} onValueChange={onCategoryChange}>
        <SelectTrigger aria-label="Filter by category" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(filterItems).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {tools?.length === 0 && (
        <p className="text-muted-foreground">No tools in this category yet.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {tools?.map((tool) => (
          <ToolCard
            key={tool._id}
            {...tool}
            meta={
              <>
                <span className="text-muted-foreground">
                  {tool.isMine ? "Your listing" : `Lent by ${tool.owner.name}`}
                </span>
                {tool.owner.trustedLender && <TrustedLenderBadge />}
              </>
            }
            // UX only: Convex also checks that the caller is an admin.
            actions={
              me?.role === "admin" && !tool.isMine ? (
                <>
                  <Badge variant="outline">Admin</Badge>
                  <RemoveToolDialog toolId={tool._id} name={tool.name} />
                </>
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
