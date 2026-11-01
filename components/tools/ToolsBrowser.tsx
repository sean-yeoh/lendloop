"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { RequestToolDialog } from "@/components/loans/RequestToolDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { useLocalToday } from "@/hooks/useLocalToday";
import { categoryLabels, isToolCategory, type ToolCategory } from "@/lib/tools";
import { RemoveToolDialog } from "./RemoveToolDialog";
import { LenderLabel } from "./LenderLabel";
import { ToolCard } from "./ToolCard";
import { ToolFormDialog, type EditableTool } from "./ToolFormDialog";

const ALL = "all";
const filterItems = { [ALL]: "All categories", ...categoryLabels };

export function ToolsBrowser({ category }: { category?: ToolCategory }) {
  const router = useRouter();
  const pathname = usePathname();
  const today = useLocalToday();
  const [editing, setEditing] = useState<EditableTool | null>(null);
  // Skip while signed out. On sign-out, the query would otherwise re-run without a token.
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me);
  const tools = useQuery(
    api.tools.list,
    isAuthenticated && today ? { today, category } : "skip",
  );

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools?.map((tool) => (
          <ToolCard
            key={tool._id}
            {...tool}
            lender={
              tool.isMine ? (
                <span className="text-sm font-medium text-primary">Your listing</span>
              ) : (
                <LenderLabel name={tool.owner.name} trustedLender={tool.owner.trustedLender} />
              )
            }
            actions={
              tool.isMine ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditing(tool)}>
                    Edit
                  </Button>
                  <RemoveToolDialog toolId={tool._id} name={tool.name} />
                </>
              ) : (
                <>
                  {today && <RequestToolDialog toolId={tool._id} name={tool.name} today={today} />}
                  {/* UX only: Convex also checks that the caller is an admin. */}
                  {me?.role === "admin" && <RemoveToolDialog toolId={tool._id} name={tool.name} />}
                </>
              )
            }
          />
        ))}
      </div>

      <ToolFormDialog
        tool={editing ?? undefined}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  );
}
