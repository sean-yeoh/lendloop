"use client";

import { useConvexAuth, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { LoanActionButton } from "@/components/loans/LoanActionButton";
import { LoanList, LoanRow } from "@/components/loans/LoanRow";
import { api } from "@/convex/_generated/api";
import { useLocalToday } from "@/hooks/useLocalToday";

export function IncomingRequestsView() {
  const today = useLocalToday();
  // Skip while signed out. On sign-out, the query would otherwise re-run without a token.
  const { isAuthenticated } = useConvexAuth();
  const loans = useQuery(api.loans.incoming, isAuthenticated ? {} : "skip");

  const pending = loans?.filter((loan) => loan.status === "requested") ?? [];
  const out = loans?.filter((loan) => loan.status === "approved") ?? [];
  const history =
    loans?.filter((loan) => loan.status !== "requested" && loan.status !== "approved") ?? [];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Incoming requests</h1>
        <p className="text-muted-foreground">Requests and loans for the tools that you lend.</p>
      </div>

      {loans?.length === 0 && (
        <p className="rounded-xl border border-dashed p-8 text-muted-foreground">
          No one has requested your tools yet.
        </p>
      )}

      {today && (
        <>
          <Section title="Waiting for your answer" count={pending.length}>
            {pending.map((loan) => (
              <LoanRow
                key={loan._id}
                loan={loan}
                today={today}
                person={`Requested by ${loan.borrower.name}`}
                actions={
                  <>
                    <LoanActionButton
                      action={api.loans.decline}
                      loanId={loan._id}
                      success="Request declined"
                      variant="outline"
                    >
                      Decline
                    </LoanActionButton>
                    <LoanActionButton
                      action={api.loans.approve}
                      loanId={loan._id}
                      success="Request approved"
                    >
                      Approve
                    </LoanActionButton>
                  </>
                }
              />
            ))}
          </Section>

          <Section title="Lent out" count={out.length}>
            {out.map((loan) => (
              <LoanRow
                key={loan._id}
                loan={loan}
                today={today}
                person={`Borrowed by ${loan.borrower.name}`}
                actions={
                  <LoanActionButton
                    action={api.loans.markReturned}
                    loanId={loan._id}
                    success="Marked as returned"
                  >
                    Mark returned
                  </LoanActionButton>
                }
              />
            ))}
          </Section>

          <Section title="History" count={history.length}>
            {history.map((loan) => (
              <LoanRow key={loan._id} loan={loan} today={today} person={loan.borrower.name} />
            ))}
          </Section>
        </>
      )}
    </main>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">
        {title} <span className="text-muted-foreground">({count})</span>
      </h2>
      <LoanList>{children}</LoanList>
    </section>
  );
}
