"use client";

import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { LoanActionButton } from "@/components/loans/LoanActionButton";
import { LoanList, LoanRow } from "@/components/loans/LoanRow";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useLocalToday } from "@/hooks/useLocalToday";

export function MyRequestsView() {
  const today = useLocalToday();
  // Skip while signed out. On sign-out, the query would otherwise re-run without a token.
  const { isAuthenticated } = useConvexAuth();
  const loans = useQuery(api.loans.myRequests, isAuthenticated ? {} : "skip");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>
        <p className="text-muted-foreground">Tools that you asked to borrow.</p>
      </div>

      {loans?.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-8">
          <p className="text-muted-foreground">You have not requested any tools yet.</p>
          <Link href="/tools" className={buttonVariants()}>
            Browse tools
          </Link>
        </div>
      )}
      {today && loans && loans.length > 0 && (
        <LoanList>
          {loans.map((loan) => (
            <LoanRow
              key={loan._id}
              loan={loan}
              today={today}
              person={`Lent by ${loan.lender.name}`}
              actions={
                loan.status === "requested" && (
                  <LoanActionButton
                    action={api.loans.cancel}
                    loanId={loan._id}
                    success="Request cancelled"
                    variant="outline"
                  >
                    Cancel
                  </LoanActionButton>
                )
              }
            />
          ))}
        </LoanList>
      )}
    </main>
  );
}
