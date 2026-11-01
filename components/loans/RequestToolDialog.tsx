"use client";

import { useMutation, useQuery } from "convex/react";
import { differenceInCalendarDays } from "date-fns";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { formatRange, fromDateString, toDateString } from "@/lib/loans";

export function RequestToolDialog({
  toolId,
  name,
  today,
}: {
  toolId: Id<"tools">;
  name: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Request</DialogTrigger>
      <DialogContent className="sm:max-w-fit">
        <DialogHeader>
          <DialogTitle>Borrow {name}</DialogTitle>
          <DialogDescription>Select the first and last day that you need it.</DialogDescription>
        </DialogHeader>
        {/* Mount only while open, so each open starts with no selection. */}
        {open && <RequestForm toolId={toolId} today={today} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RequestForm({ toolId, today, onDone }: { toolId: Id<"tools">; today: string; onDone: () => void }) {
  const booked = useQuery(api.loans.bookedRanges, { toolId });
  const request = useMutation(api.loans.request);
  const [range, setRange] = useState<DateRange | undefined>();
  const [sending, setSending] = useState(false);

  const startDate = range?.from ? toDateString(range.from) : undefined;
  const endDate = range?.to ? toDateString(range.to) : startDate;

  async function onSubmit() {
    if (!startDate || !endDate) return;
    setSending(true);
    try {
      await request({ toolId, startDate, endDate, today });
      toast.success("Request sent. The owner will approve or decline it.");
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Calendar
        mode="range"
        selected={range}
        onSelect={setRange}
        excludeDisabled
        numberOfMonths={2}
        startMonth={fromDateString(today)}
        disabled={[
          { before: fromDateString(today) },
          ...(booked ?? []).map((loan) => ({
            from: fromDateString(loan.startDate),
            to: fromDateString(loan.endDate),
          })),
        ]}
        className="mx-auto rounded-lg"
      />
      <div className="flex flex-col gap-1 text-sm">
        <p>
          {startDate && endDate ? (
            <>
              <span className="text-muted-foreground">Selected:</span> {formatRange(startDate, endDate)}{" "}
              <span className="text-muted-foreground">
                ({dayCount(startDate, endDate)} {dayCount(startDate, endDate) === 1 ? "day" : "days"})
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Select a start date, then an end date.</span>
          )}
        </p>
        {booked && booked.length > 0 && (
          <p className="text-muted-foreground">Greyed-out days are already lent to someone else.</p>
        )}
      </div>
      <DialogFooter>
        <Button onClick={onSubmit} disabled={!startDate || sending}>
          Send request
        </Button>
      </DialogFooter>
    </>
  );
}

function dayCount(startDate: string, endDate: string): number {
  return differenceInCalendarDays(fromDateString(endDate), fromDateString(startDate)) + 1;
}
