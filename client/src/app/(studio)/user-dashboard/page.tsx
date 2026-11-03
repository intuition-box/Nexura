"use client";

import UserLayout from "@/components/studio/UserLayout";
import UserDashboard from "../_components/UserDashboard";

export default function Page() {
  return (
    <UserLayout title="Dashboard">
      <UserDashboard />
    </UserLayout>
  );
}
