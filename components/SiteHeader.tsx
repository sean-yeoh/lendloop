"use client";

import { UserButton } from "@clerk/nextjs";
import { Authenticated, AuthLoading, useQuery } from "convex/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        LendLoop
      </Link>
      <nav className="flex h-8 items-center gap-4">
        <AuthLoading>
          <div className="size-7 animate-pulse rounded-full bg-muted" />
        </AuthLoading>
        <Authenticated>
          <NavLink href="/tools">Tools</NavLink>
          <NavLink href="/my-listings">My listings</NavLink>
          <AdminLink />
          <UserButton />
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
