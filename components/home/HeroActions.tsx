"use client";

import { SignInButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated } from "convex/react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export function HeroActions() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Unauthenticated>
        <SignInButton>
          <Button size="lg" className="px-4">
            Sign in to lend or borrow
            <ArrowRight data-icon="inline-end" />
          </Button>
        </SignInButton>
      </Unauthenticated>
      <Authenticated>
        <Link href="/tools" className={buttonVariants({ size: "lg", className: "px-4" })}>
          Browse tools
          <ArrowRight data-icon="inline-end" />
        </Link>
      </Authenticated>
      <a href="#tools" className={buttonVariants({ size: "lg", variant: "ghost", className: "px-4" })}>
        See what is available
      </a>
    </div>
  );
}

// For the call-to-action band on the primary colour.
export function CtaAction() {
  const className = buttonVariants({
    size: "lg",
    variant: "secondary",
    className: "px-4",
  });
  return (
    <>
      <Unauthenticated>
        <SignInButton>
          <Button size="lg" variant="secondary" className="px-4">
            Get started
          </Button>
        </SignInButton>
      </Unauthenticated>
      <Authenticated>
        <Link href="/my-listings" className={className}>
          List a tool
        </Link>
      </Authenticated>
    </>
  );
}
