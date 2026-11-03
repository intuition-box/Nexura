"use client";

import UserLayout from "@/components/studio/UserLayout";
import Lessons from "../../_components/Lessons";

export default function Page() {
  return (
    <UserLayout title="Lessons">
      <Lessons />
    </UserLayout>
  );
}
