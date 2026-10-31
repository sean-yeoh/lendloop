"use client";

import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

/** Creates or updates the Convex user row. Render only inside <Authenticated>. */
export function EnsureUser() {
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    ensureUser().catch((error) => console.error("Failed to sync user", error));
  }, [ensureUser]);

  return null;
}
