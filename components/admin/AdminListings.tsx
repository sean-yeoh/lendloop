"use client";

import { useQuery } from "convex/react";
import { AvailabilityBadge } from "@/components/tools/AvailabilityBadge";
import { RemoveToolDialog } from "@/components/tools/RemoveToolDialog";
import { TrustedLenderMark } from "@/components/tools/LenderLabel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { categoryLabels } from "@/lib/tools";

export function AdminListings({ today }: { today: string }) {
  const tools = useQuery(api.tools.list, { today });

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Tool</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Availability</TableHead>
            <TableHead className="pr-4 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tools?.map((tool) => (
            <TableRow key={tool._id}>
              <TableCell className="pl-4 font-medium">{tool.name}</TableCell>
              <TableCell>{categoryLabels[tool.category]}</TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  {tool.owner.name}
                  {tool.owner.trustedLender && <TrustedLenderMark />}
                </span>
              </TableCell>
              <TableCell>
                <AvailabilityBadge availability={tool.availability} />
              </TableCell>
              <TableCell className="pr-4 text-right">
                <RemoveToolDialog toolId={tool._id} name={tool.name} />
              </TableCell>
            </TableRow>
          ))}
          {tools?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                No active listings.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
