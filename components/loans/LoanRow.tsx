import { differenceInCalendarDays, format } from "date-fns";
import type { ReactNode } from "react";
import { CategoryIcon } from "@/components/tools/CategoryIcon";
import { formatRange, fromDateString, type LoanStatus } from "@/lib/loans";
import type { ToolCategory } from "@/lib/tools";
import { LoanActivity, type LoanActivityData } from "./LoanActivity";
import { LoanStatusBadge } from "./LoanStatusBadge";

type LoanRowData = {
  startDate: string;
  endDate: string;
  status: LoanStatus;
  returnedAt?: number;
  tool: { name: string; category: ToolCategory };
  activity: LoanActivityData;
};

export function LoanRow({
  loan,
  today,
  person,
  actions,
}: {
  loan: LoanRowData;
  today: string;
  person: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <CategoryIcon category={loan.tool.category} className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{loan.tool.name}</span>
          <LoanStatusBadge loan={loan} today={today} />
        </div>
        <p className="text-sm text-muted-foreground">
          {formatRange(loan.startDate, loan.endDate)} · {person}
          {loan.returnedAt !== undefined && <> · {returnedText(loan.returnedAt, loan.endDate)}</>}
        </p>
        <LoanActivity activity={loan.activity} />
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </li>
  );
}

function returnedText(returnedAt: number, endDate: string): string {
  const late = differenceInCalendarDays(returnedAt, fromDateString(endDate));
  const when = `Returned ${format(returnedAt, "MMM d")}`;
  if (late <= 0) return when;
  return `${when}, ${late} ${late === 1 ? "day" : "days"} late`;
}

export function LoanList({ children }: { children: ReactNode }) {
  return <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">{children}</ul>;
}
