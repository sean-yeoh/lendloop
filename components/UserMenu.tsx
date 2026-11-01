"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut, Package, UserCog } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Replaces Clerk's UserButton, so the menu matches the app. Account settings stay in Clerk's dialog.
export function UserMenu() {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  if (!user) return null;

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const name = user.fullName ?? email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open account menu"
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar name={name} imageUrl={user.hasImage ? user.imageUrl : undefined} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-3 px-1.5 py-2">
          <UserAvatar name={name} imageUrl={user.hasImage ? user.imageUrl : undefined} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{name}</span>
            {email !== name && <span className="truncate text-xs text-muted-foreground">{email}</span>}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/my-listings" />}>
          <Package />
          My listings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openUserProfile()}>
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
