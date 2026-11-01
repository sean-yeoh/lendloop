import type { Metadata } from "next";
import { AdminOnly } from "@/components/auth/AdminOnly";
import { AdminView } from "./AdminView";

export const metadata: Metadata = { title: "Admin · LendLoop" };

export default function AdminPage() {
  return (
    <AdminOnly>
      <AdminView />
    </AdminOnly>
  );
}
