import type { Metadata } from "next";
import { SignedInOnly } from "@/components/auth/SignedInOnly";
import { IncomingRequestsView } from "./IncomingRequestsView";

export const metadata: Metadata = { title: "Incoming requests · LendLoop" };

export default function IncomingRequestsPage() {
  return (
    <SignedInOnly>
      <IncomingRequestsView />
    </SignedInOnly>
  );
}
