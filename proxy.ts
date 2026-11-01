import { clerkMiddleware } from "@clerk/nextjs/server";

// Makes the Clerk session available to auth() in pages. It checks no routes: each signed-in page
// checks sign-in itself (components/auth/SignedInOnly.tsx), and Convex checks every data access.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
