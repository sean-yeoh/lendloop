import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      // Clerk Frontend API URL, set on the Convex deployment (not in .env.local).
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
