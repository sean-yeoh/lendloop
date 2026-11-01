import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";

// Admin pages answer 404 to everyone else, so they do not reveal that they exist. The role is
// stored in Convex, so the check asks Convex with the visitor's Clerk token. Every admin query
// and mutation also checks the role in Convex, so this check is for UX only.
export function AdminOnly({ children }: { children: ReactNode }) {
  // auth() and the Convex call read request data, so they run inside Suspense with Cache Components.
  return (
    <Suspense>
      <RequireAdmin>{children}</RequireAdmin>
    </Suspense>
  );
}

async function RequireAdmin({ children }: { children: ReactNode }) {
  const { getToken, sessionClaims } = await auth.protect();
  // The same token the Convex client in the browser uses (convex/react-clerk): the session token
  // when its audience is "convex", otherwise the "convex" JWT template.
  const token = await getToken(sessionClaims?.aud === "convex" ? {} : { template: "convex" });
  const me = token ? await fetchQuery(api.users.me, {}, { token }) : null;
  if (me?.role !== "admin") notFound();
  return children;
}
