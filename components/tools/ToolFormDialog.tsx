"use client";

import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import {
  categoryLabels,
  conditionLabels,
  DESCRIPTION_MAX,
  NAME_MAX,
  type ToolCategory,
  type ToolCondition,
} from "@/lib/tools";

export type EditableTool = {
  _id: Id<"tools">;
  name: string;
  category: ToolCategory;
  condition: ToolCondition;
  description: string;
};

// Creates a tool when `tool` is not given. Otherwise edits it.
export function ToolFormDialog({
  tool,
  open,
  onOpenChange,
}: {
  tool?: EditableTool;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tool ? "Edit tool" : "Add a tool"}</DialogTitle>
        </DialogHeader>
        {/* Mount the form only while open, so each open starts from the current values. */}
        {open && <ToolForm tool={tool} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ToolForm({ tool, onDone }: { tool?: EditableTool; onDone: () => void }) {
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);
  const [name, setName] = useState(tool?.name ?? "");
  const [category, setCategory] = useState<ToolCategory>(tool?.category ?? "power_tools");
  const [condition, setCondition] = useState<ToolCondition>(tool?.condition ?? "good");
  const [description, setDescription] = useState(tool?.description ?? "");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const input = { name, category, condition, description };
      if (tool) await update({ toolId: tool._id, ...input });
      else await create(input);
      toast.success(tool ? "Tool updated" : "Tool listed");
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="tool-name">Name</Label>
        <Input
          id="tool-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={NAME_MAX}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Category</Label>
          <Select
            items={categoryLabels}
            value={category}
            onValueChange={(value) => value && setCategory(value as ToolCategory)}
          >
            <SelectTrigger className="w-full" aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Condition</Label>
          <Select
            items={conditionLabels}
            value={condition}
            onValueChange={(value) => value && setCondition(value as ToolCondition)}
          >
            <SelectTrigger className="w-full" aria-label="Condition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(conditionLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="tool-description">Short description</Label>
        <Textarea
          id="tool-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={3}
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={saving}>
          {tool ? "Save" : "List tool"}
        </Button>
      </DialogFooter>
    </form>
  );
}
