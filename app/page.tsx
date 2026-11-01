"use client";

import { SignInButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { categoryLabels } from "@/lib/tools";

export default function Home() {
  const tools = useQuery(api.tools.listPublic);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <section className="flex flex-col gap-4">
        <p className="text-lg text-muted-foreground">
          Borrow what you need. Lend what you don&apos;t.
        </p>
        <Unauthenticated>
          <SignInButton>
            <Button className="w-fit">Sign in to lend or borrow</Button>
          </SignInButton>
        </Unauthenticated>
        <Authenticated>
          <Link href="/tools" className={buttonVariants({ className: "w-fit" })}>
            Browse tools
          </Link>
        </Authenticated>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Tools in the neighborhood</h2>
        {tools?.length === 0 && <p className="text-muted-foreground">No tools listed yet.</p>}
        <ul className="divide-y rounded-xl ring-1 ring-foreground/10">
          {/* The public query returns no IDs, so the index is the key. The list is read-only. */}
          {tools?.map((tool, index) => (
            <li key={index} className="flex items-center justify-between px-4 py-3">
              <span>{tool.name}</span>
              <Badge variant="secondary">{categoryLabels[tool.category]}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
