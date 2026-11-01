import { formatDistanceToNow } from "date-fns";
import { BellRing, Mail } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";

export type LoanActivityData = {
  reminderCount: number;
  lastReminderAt: number | null;
  notification: {
    event: Doc<"loanEvents">["type"];
    status: Doc<"notifications">["status"];
    at: number;
  } | null;
};

const emailLabels: Partial<Record<Doc<"loanEvents">["type"], string>> = {
  requested: "Request email",
  approved: "Approval email",
  declined: "Decline email",
  cancelled: "Cancellation email",
  returned: "Return email",
  withdrawn: "Cancellation email",
};

// Recent automation activity from n8n, for example "Reminder sent 2 days ago".
export function LoanActivity({ activity }: { activity: LoanActivityData }) {
  const { reminderCount, lastReminderAt, notification } = activity;
  if (!lastReminderAt && !notification) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {lastReminderAt && (
        <span className="flex items-center gap-1.5">
          <BellRing aria-hidden className="size-3.5 text-primary" />
          Reminder sent {ago(lastReminderAt)}
          {reminderCount > 1 && ` (${reminderCount} reminders)`}
        </span>
      )}
      {notification && (
        <span
          className={`flex items-center gap-1.5 ${notification.status === "failed" ? "text-destructive" : ""}`}
        >
          <Mail aria-hidden className="size-3.5" />
          {emailLabels[notification.event] ?? "Email"}{" "}
          {notification.status === "sent" && `sent ${ago(notification.at)}`}
          {notification.status === "pending" && "is being sent"}
          {notification.status === "failed" && "could not be sent"}
        </span>
      )}
    </div>
  );
}

function ago(at: number) {
  return formatDistanceToNow(at, { addSuffix: true });
}
