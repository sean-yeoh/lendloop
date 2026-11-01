"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { Inbox, LogOut, Package, Search, Send, UserCog } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AccountDialog } from "@/components/account/AccountDialog";
import { CountBadge } from "@/components/CountBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Replaces Clerk's UserButton, so the menu matches the app. Account settings stay in Clerk's
// UserProfile, with a LendLoop Delete account page (AccountDialog).
export function UserMenu({ counts }: { counts: { incomingPending: number; myOverdue: number } }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [accountOpen, setAccountOpen] = useState(false);
  if (!user) return null;

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const name = user.fullName ?? email;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open account menu"
          className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="relative block">
            <UserAvatar name={name} imageUrl={user.hasImage ? user.imageUrl : undefined} />
            {/* On small screens the nav links are in this menu, so show a dot when something needs action. */}
            {counts.incomingPending + counts.myOverdue > 0 && (
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-background md:hidden" />
            )}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <div className="flex items-center gap-3 px-1.5 py-2">
            <UserAvatar name={name} imageUrl={user.hasImage ? user.imageUrl : undefined} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{name}</span>
              {email !== name && (
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/tools" />}>
            <Search />
            Tools
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/my-listings" />}>
            <Package />
            My listings
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/requests" />}>
            <Send />
            My requests
            <CountBadge
              count={counts.myOverdue}
              label="overdue"
              tone="destructive"
              className="ml-auto"
            />
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/incoming" />}>
            <Inbox />
            Incoming requests
            <CountBadge
              count={counts.incomingPending}
              label="waiting for your answer"
              className="ml-auto"
            />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAccountOpen(true)}>
            <UserCog />
            Manage account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ redirectUrl: "/" })}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </>
  );
}

function UserAvatar({ name, imageUrl }: { name: string; imageUrl?: string }) {
  return (
    <Avatar>
      {imageUrl && <AvatarImage src={imageUrl} alt="" />}
      <AvatarFallback className="bg-primary font-medium text-primary-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function initials(name: string): string {
  const words = name.split(/[\s@._-]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}
