import type { Metadata } from "next";
import { SignedInOnly } from "@/components/auth/SignedInOnly";
import { MyRequestsView } from "./MyRequestsView";

export const metadata: Metadata = { title: "My requests · LendLoop" };

export default function MyRequestsPage() {
  return (
    <SignedInOnly>
      <MyRequestsView />
    </SignedInOnly>
  );
}
