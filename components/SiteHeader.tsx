"use client";

import { UserButton } from "@clerk/nextjs";
import { Authenticated, AuthLoading, useQuery } from "convex/react";
import Link from "next/link";
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
  return (
    <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground">
      Admin
    </Link>
  );
}
