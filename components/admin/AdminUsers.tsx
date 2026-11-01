"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";

export function AdminUsers() {
  const users = useQuery(api.users.listForAdmin);
  const setTrusted = useMutation(api.users.setTrustedLender);

  async function onToggle(userId: Id<"users">, name: string, trusted: boolean) {
    try {
      await setTrusted({ userId, trusted });
      toast.success(
        trusted ? `${name} is now a Trusted Lender` : `${name} is no longer a Trusted Lender`,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Trusted Lender is a badge that borrowers see next to the lender&apos;s name. It changes no
        loan rules.
      </p>
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Active listings</TableHead>
              <TableHead className="pr-4 text-right">Trusted Lender</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user._id}>
                <TableCell className="pl-4 font-medium">{user.name}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role === "admin" ? "Admin" : "User"}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">{user.toolCount}</TableCell>
                <TableCell className="pr-4 text-right">
                  <Switch
                    aria-label={`Trusted Lender: ${user.name}`}
                    checked={user.trustedLender}
                    onCheckedChange={(checked) => onToggle(user._id, user.name, checked)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
