"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useState } from "react";
import { RemoveToolDialog } from "@/components/tools/RemoveToolDialog";
import { ToolCard } from "@/components/tools/ToolCard";
import { ToolFormDialog, type EditableTool } from "@/components/tools/ToolFormDialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useLocalToday } from "@/hooks/useLocalToday";

export function MyListingsView() {
  const today = useLocalToday();
  // Skip while signed out. On sign-out, the query would otherwise re-run without a token.
  const { isAuthenticated } = useConvexAuth();
  const tools = useQuery(api.tools.mine, isAuthenticated && today ? { today } : "skip");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EditableTool | null>(null);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">My listings</h1>
        <Button onClick={() => setAdding(true)}>Add a tool</Button>
      </div>

      {tools?.length === 0 && (
        <p className="text-muted-foreground">You have no listings. Add a tool that you can lend.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools?.map((tool) => (
          <ToolCard
            key={tool._id}
            {...tool}
            actions={
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(tool)}>
                  Edit
                </Button>
                <RemoveToolDialog toolId={tool._id} name={tool.name} />
              </>
            }
          />
        ))}
      </div>

      <ToolFormDialog open={adding} onOpenChange={setAdding} />
      <ToolFormDialog
        tool={editing ?? undefined}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </main>
  );
}
