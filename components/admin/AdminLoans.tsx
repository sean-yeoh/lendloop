"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { LoanStatusBadge } from "@/components/loans/LoanStatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { formatRange, isOverdue } from "@/lib/loans";

const filters = {
  all: "All loans",
  pending: "Pending",
  active: "Lent out",
  overdue: "Overdue",
  closed: "Closed",
} as const;
type Filter = keyof typeof filters;

export function AdminLoans({ today }: { today: string }) {
  const loans = useQuery(api.loans.listAll);
  const [filter, setFilter] = useState<Filter>("all");

  const shown = (loans ?? []).filter((loan) => {
    switch (filter) {
      case "all":
        return true;
      case "pending":
        return loan.status === "requested";
      case "active":
        return loan.status === "approved";
      case "overdue":
        return isOverdue(loan, today);
      case "closed":
        return loan.status !== "requested" && loan.status !== "approved";
    }
  });

  return (
    <div className="flex flex-col gap-4">
      <Select items={filters} value={filter} onValueChange={(value) => value && setFilter(value as Filter)}>
        <SelectTrigger aria-label="Filter loans" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(filters).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Tool</TableHead>
              <TableHead>Borrower</TableHead>
              <TableHead>Lender</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="pr-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((loan) => (
              <TableRow key={loan._id}>
                <TableCell className="pl-4 font-medium">{loan.tool.name}</TableCell>
                <TableCell>{loan.borrower.name}</TableCell>
                <TableCell>{loan.lender.name}</TableCell>
                <TableCell>{formatRange(loan.startDate, loan.endDate)}</TableCell>
                <TableCell className="pr-4">
                  <LoanStatusBadge loan={loan} today={today} />
                </TableCell>
              </TableRow>
            ))}
            {loans && shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No loans match this filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
