import { Badge } from "@/components/ui/badge";
import { isOverdue, type LoanStatus } from "@/lib/loans";

const labels: Record<LoanStatus, string> = {
  requested: "Pending",
  approved: "Approved",
  declined: "Declined",
  cancelled: "Cancelled",
  returned: "Returned",
};

const variants: Record<LoanStatus, "default" | "secondary" | "outline"> = {
  requested: "outline",
  approved: "default",
  declined: "secondary",
  cancelled: "secondary",
  returned: "secondary",
};

export function LoanStatusBadge({
  loan,
  today,
}: {
  loan: { status: LoanStatus; endDate: string };
  today: string;
}) {
  if (isOverdue(loan, today)) return <Badge variant="destructive">Overdue</Badge>;
  return <Badge variant={variants[loan.status]}>{labels[loan.status]}</Badge>;
}
