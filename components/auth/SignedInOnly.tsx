import { auth } from "@clerk/nextjs/server";
import { Suspense, type ReactNode } from "react";

// Sends signed-out visitors to sign-in. Each signed-in page renders its content inside this
// component, as Clerk recommends instead of route matching in proxy.ts. Data access is checked
// in every Convex function, so this check is for UX only.
export function SignedInOnly({ children }: { children: ReactNode }) {
  // auth() reads request data, so it must run inside Suspense with Cache Components.
  return (
    <Suspense>
      <RequireSignIn>{children}</RequireSignIn>
    </Suspense>
  );
}

async function RequireSignIn({ children }: { children: ReactNode }) {
  await auth.protect();
  return children;
}
