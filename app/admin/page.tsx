"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { AdminListings } from "@/components/admin/AdminListings";
import { AdminLoans } from "@/components/admin/AdminLoans";
import { AdminNotifications } from "@/components/admin/AdminNotifications";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import { useLocalToday } from "@/hooks/useLocalToday";

// UX only: every admin query and mutation checks the role in Convex with requireAdmin.
export default function AdminPage() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const today = useLocalToday();

  if (me === undefined || !today) return null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        {me?.role === "admin" && (
          <p className="text-muted-foreground">
            View all loans, remove listings, manage Trusted Lenders, and check notification
            delivery.
          </p>
        )}
      </div>
      {me?.role === "admin" ? (
        <Tabs defaultValue="loans" className="gap-4">
          <TabsList>
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>
          <TabsContent value="loans">
            <AdminLoans today={today} />
          </TabsContent>
          <TabsContent value="listings">
            <AdminListings today={today} />
          </TabsContent>
          <TabsContent value="users">
            <AdminUsers />
          </TabsContent>
          <TabsContent value="notifications">
            <AdminNotifications />
          </TabsContent>
        </Tabs>
      ) : (
        <p className="text-muted-foreground">You do not have access to this page.</p>
      )}
    </main>
  );
}
