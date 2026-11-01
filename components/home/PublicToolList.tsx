"use client";

import { useQuery } from "convex/react";
import { CategoryIcon } from "@/components/tools/CategoryIcon";
import { api } from "@/convex/_generated/api";
import { categoryLabels } from "@/lib/tools";

export function PublicToolList() {
  const tools = useQuery(api.tools.listPublic);

  if (tools === undefined) {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </ul>
    );
  }

  if (tools.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        No tools are listed yet. Sign in and be the first to lend one.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {/* The public query returns no IDs, so the index is the key. The list is read-only. */}
      {tools.map((tool, index) => (
        <li
          key={index}
          className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CategoryIcon category={tool.category} className="size-5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{tool.name}</span>
            <span className="text-sm text-muted-foreground">{categoryLabels[tool.category]}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
