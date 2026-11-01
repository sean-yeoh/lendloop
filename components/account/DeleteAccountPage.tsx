"use client";

import { useClerk } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/errors";
import { formatRange } from "@/lib/loans";

const CONFIRM_WORD = "DELETE";

// A custom page in Clerk's account dialog. Clerk's own Delete account is turned off per user,
// because deletion must check for active loans first (convex/account.ts).
export function DeleteAccountPage({ onNavigate }: { onNavigate: () => void }) {
  const status = useQuery(api.account.deletionStatus);
  const deleteMyAccount = useMutation(api.account.deleteMyAccount);
  const { signOut } = useClerk();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    setDeleting(true);
    try {
      await deleteMyAccount();
      toast.success("Your account was deleted");
      await signOut({ redirectUrl: "/" });
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div>
        <h1 className="text-lg font-semibold">Delete account</h1>
        <p className="text-muted-foreground">
          Permanently delete your LendLoop account and sign-in.
        </p>
      </div>

      {status === undefined ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : status === null ? null : status.blockingLoans.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <CircleAlert className="size-4 text-destructive" />
              You can&apos;t delete your account yet
            </p>
            <p className="text-muted-foreground">
              Every tool you lent or borrowed must be back with its owner first.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {status.blockingLoans.map((loan) => (
              <li key={loan._id} className="rounded-md bg-background p-3">
                <p>
                  <strong>{loan.toolName}</strong>
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatRange(loan.startDate, loan.endDate)}
                  </span>
                </p>
                {/* Only the lender can mark a loan returned, so the next step depends on the role. */}
                {loan.role === "lender" ? (
                  <p className="text-muted-foreground">
                    Lent to {loan.otherName}. When it is back, select <strong>Mark returned</strong>{" "}
                    in{" "}
                    <Link
                      href="/incoming"
                      onClick={onNavigate}
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      Incoming requests
                    </Link>
                    .
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Borrowed from {loan.otherName}. Give it back, and they mark it returned.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>
              Your {plural(status.listingCount, "listing")}{" "}
              {status.listingCount === 1 ? "is" : "are"} removed.
            </li>
            <li>
              Your {plural(status.pendingRequestCount, "pending request")}{" "}
              {status.pendingRequestCount === 1 ? "is" : "are"} closed, and the other person is
              notified.
            </li>
            <li>
              Past loans stay in other people&apos;s history, with your name shown as &quot;Deleted
              user&quot;.
            </li>
            <li>Your sign-in account is deleted. This cannot be undone.</li>
          </ul>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-confirmation">Type {CONFIRM_WORD} to confirm</Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              className="max-w-60"
            />
          </div>
          <div>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={confirmation !== CONFIRM_WORD || deleting}
            >
              {deleting ? "Deleting…" : "Delete account"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
