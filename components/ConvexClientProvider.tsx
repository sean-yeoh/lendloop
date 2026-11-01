"use client";

import { useAuth } from "@clerk/nextjs";
import { Authenticated, ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";
import { EnsureUser } from "./EnsureUser";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL. Run `pnpm exec convex dev`.");
}

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    // The provider calls the hook itself, as the Convex docs show.
    // oxlint-disable-next-line react/hooks
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <Authenticated>
        <EnsureUser />
      </Authenticated>
      {children}
    </ConvexProviderWithClerk>
  );
}
