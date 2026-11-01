"use client";

import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";

// Deliveries to n8n that are retrying or failed. Sent notifications are not listed.
export function AdminNotifications() {
  const problems = useQuery(api.notifications.listProblems);
  const retry = useMutation(api.notifications.retry);

  async function onRetry(notificationId: Id<"notifications">) {
    try {
      await retry({ notificationId });
      toast.success("Notification queued again");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Request notifications that n8n did not accept. Convex retries each one 4 times over about 40
        minutes, then marks it failed.
      </p>
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Event</TableHead>
              <TableHead>Tool</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last error</TableHead>
              <TableHead className="pr-4 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {problems?.map((row) => (
              <TableRow key={row._id}>
                <TableCell className="pl-4">
                  <span className="font-medium capitalize">{row.event}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDistanceToNow(row.at, { addSuffix: true })}
                  </span>
                </TableCell>
                <TableCell>{row.tool}</TableCell>
                <TableCell>
                  {row.status === "failed" ? (
                    <Badge variant="destructive">Failed after {row.attempts}</Badge>
                  ) : (
                    <Badge variant="outline">Retrying ({row.attempts})</Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground" title={row.lastError ?? ""}>
                  {row.lastError ?? "None"}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {row.status === "failed" && (
                    <Button size="sm" variant="outline" onClick={() => onRetry(row._id)}>
                      Retry
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {problems?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  All notifications were delivered.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
