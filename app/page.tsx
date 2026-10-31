"use client";

import { SignInButton } from "@clerk/nextjs";
import { Unauthenticated } from "convex/react";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Borrow what you need. Lend what you don&apos;t.
      </p>
      <Unauthenticated>
        <SignInButton>
          <button className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
            Sign in to lend or borrow
          </button>
        </SignInButton>
      </Unauthenticated>
    </main>
  );
}
