"use client";

import { useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";

type LoanMutation = FunctionReference<"mutation", "public", { loanId: Id<"loans"> }>;

// Runs one loan action and reports the result in a toast. Convex checks who may run it.
export function LoanActionButton({
  action,
  loanId,
  success,
  children,
  ...buttonProps
}: {
  action: LoanMutation;
  loanId: Id<"loans">;
  success: string;
} & Omit<ComponentProps<typeof Button>, "onClick">) {
  const run = useMutation(action);
  const [running, setRunning] = useState(false);

  async function onClick() {
    setRunning(true);
    try {
      await run({ loanId });
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button size="sm" {...buttonProps} onClick={onClick} disabled={running}>
      {children}
    </Button>
  );
}
