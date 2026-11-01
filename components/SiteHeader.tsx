"use client";

import { SignInButton } from "@clerk/nextjs";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { Repeat } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CountBadge } from "@/components/CountBadge";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useNavCounts } from "@/hooks/useNavCounts";

export function SiteHeader() {
  const counts = useNavCounts();
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Repeat aria-hidden className="size-4" />
        </span>
        LendLoop
      </Link>
      <nav className="flex h-8 items-center gap-4">
        <AuthLoading>
          <div className="size-8 animate-pulse rounded-full bg-muted" />
        </AuthLoading>
        <Unauthenticated>
          <SignInButton>
            <Button variant="ghost">Sign in</Button>
          </SignInButton>
        </Unauthenticated>
        <Authenticated>
          <div className="hidden items-center gap-1 md:flex">
            <NavLink href="/tools">Tools</NavLink>
            <NavLink href="/my-listings">My listings</NavLink>
            <NavLink
              href="/requests"
              badge={<CountBadge count={counts.myOverdue} label="overdue" tone="destructive" />}
            >
              My requests
            </NavLink>
            <NavLink
              href="/incoming"
              badge={<CountBadge count={counts.incomingPending} label="waiting for your answer" />}
            >
              Incoming
            </NavLink>
          </div>
          <AdminLink />
          <UserMenu counts={counts} />
        </Authenticated>
      </nav>
    </header>
  );
}

function AdminLink() {
  const me = useQuery(api.users.me);
  if (me?.role !== "admin") return null;
  return <NavLink href="/admin">Admin</NavLink>;
}

function NavLink({
  href,
  badge,
  children,
}: {
  href: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary"
    >
      {children}
      {badge}
    </Link>
  );
}
