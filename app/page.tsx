"use client";

import { SignInButton } from "@clerk/nextjs";
import { Unauthenticated } from "convex/react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <p className="text-lg text-muted-foreground">
        Borrow what you need. Lend what you don&apos;t.
      </p>
      <Unauthenticated>
        <SignInButton>
          <Button className="w-fit">Sign in to lend or borrow</Button>
        </SignInButton>
      </Unauthenticated>
    </main>
  );
}
