"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// UX only: admin data comes from Convex functions that check the role with requireAdmin.
export default function AdminPage() {
  const me = useQuery(api.users.me);

  if (me === undefined) return null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      {me?.role === "admin" ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Listings, loans, and Trusted Lender management will show here.
        </p>
      ) : (
        <p className="text-zinc-600 dark:text-zinc-400">You do not have access to this page.</p>
      )}
    </main>
  );
}
