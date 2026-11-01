"use client";

import { SignInButton } from "@clerk/nextjs";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { Repeat } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

export function SiteHeader() {
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
          <NavLink href="/tools">Tools</NavLink>
          <NavLink href="/my-listings">My listings</NavLink>
          <AdminLink />
          <UserMenu />
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

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-muted-foreground hover:text-foreground">
      {children}
    </Link>
  );
}
