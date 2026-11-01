"use client";

import { UserProfile } from "@clerk/nextjs";
import { Trash2 } from "lucide-react";
import { DeleteAccountPage } from "@/components/account/DeleteAccountPage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// Clerk's account settings with a LendLoop page added. Rendered here instead of with
// openUserProfile(), because a custom page's content is React only in the <UserProfile> component,
// and the Delete account page needs Convex queries.
export function AccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-[calc(100%-2rem)] bg-transparent p-0 ring-0 sm:max-w-fit">
        <DialogTitle className="sr-only">Manage account</DialogTitle>
        <UserProfile routing="hash">
          <UserProfile.Page
            label="Delete account"
            url="delete-account"
            labelIcon={<Trash2 className="size-4" />}
          >
            <DeleteAccountPage onNavigate={() => onOpenChange(false)} />
          </UserProfile.Page>
        </UserProfile>
      </DialogContent>
    </Dialog>
  );
}
