import type { Metadata } from "next";
import { SignedInOnly } from "@/components/auth/SignedInOnly";
import { MyListingsView } from "./MyListingsView";

export const metadata: Metadata = { title: "My listings · LendLoop" };

export default function MyListingsPage() {
  return (
    <SignedInOnly>
      <MyListingsView />
    </SignedInOnly>
  );
}
