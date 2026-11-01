import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Sign in · LendLoop" };

// One page for sign-in and sign-up. Suspense is required by Clerk with Cache Components.
export default function SignInPage() {
  return (
    <main className="flex flex-1 items-start justify-center px-6 py-12 sm:items-center">
      <Suspense>
        <SignIn />
      </Suspense>
    </main>
  );
}
