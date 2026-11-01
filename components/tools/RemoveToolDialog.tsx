"use client";

import { useMutation, useQuery } from "convex/react";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLocalToday } from "@/hooks/useLocalToday";
import { errorMessage } from "@/lib/errors";
import { formatRange } from "@/lib/loans";

// The owner cannot remove a tool while an approved loan is open. An admin can, for example for an
// abusive listing: future bookings are cancelled and loans in progress stay (convex/tools.ts).
export function RemoveToolDialog({ toolId, name }: { toolId: Id<"tools">; name: string }) {
  const remove = useMutation(api.tools.remove);
  const today = useLocalToday();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const status = useQuery(api.tools.removalStatus, open && today ? { toolId, today } : "skip");

  const blocked = status?.isOwner === true && status.approvedLoans.length > 0;
  const future = status?.approvedLoans.filter((loan) => !loan.started) ?? [];
  const started = status?.approvedLoans.filter((loan) => loan.started) ?? [];

  async function onRemove() {
    if (!today) return;
    setRemoving(true);
    try {
      await remove({ toolId, today });
      toast.success("Tool removed");
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>Remove</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{blocked ? `You can't remove ${name} yet` : `Remove ${name}?`}</DialogTitle>
          <DialogDescription>
            {blocked
              ? "Approved loans must be returned first."
              : "The tool no longer shows in lists."}
          </DialogDescription>
        </DialogHeader>

        {status === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : status === null ? null : blocked ? (
          <ul className="flex flex-col gap-2 text-sm">
            {status.approvedLoans.map((loan) => (
              <li key={loan._id} className="flex gap-2 rounded-md bg-muted p-3">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p>
                    {loan.started ? "Lent to" : "Booked by"} {loan.borrowerName}
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatRange(loan.startDate, loan.endDate)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {loan.started ? (
                      <>
                        When it is back, select <strong>Mark returned</strong> in{" "}
                        <Link
                          href="/incoming"
                          onClick={() => setOpen(false)}
                          className="font-medium text-foreground underline underline-offset-4"
                        >
                          Incoming requests
                        </Link>
                        .
                      </>
                    ) : (
                      "You can remove the tool after this loan is returned."
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
            <li>
              {status.pendingCount === 0
                ? "No pending requests."
                : `${status.pendingCount} pending ${status.pendingCount === 1 ? "request is" : "requests are"} declined.`}
            </li>
            {future.length > 0 && (
              <li>
                {future.length} future {future.length === 1 ? "booking is" : "bookings are"}{" "}
                cancelled.
              </li>
            )}
            {started.length > 0 && (
              <li>
                {started.length} {started.length === 1 ? "loan" : "loans"} in progress{" "}
                {started.length === 1 ? "stays" : "stay"} until the tool is returned.
              </li>
            )}
            {(status.pendingCount > 0 || future.length > 0) && (
              <li>Each borrower gets an email.</li>
            )}
          </ul>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {blocked ? "Close" : "Cancel"}
          </DialogClose>
          {!blocked && (
            <Button variant="destructive" onClick={onRemove} disabled={removing || !status}>
              Remove
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
