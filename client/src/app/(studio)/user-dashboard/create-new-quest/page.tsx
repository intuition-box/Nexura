"use client";

import UserLayout from "@/components/studio/UserLayout";
import QuestCreate from "../../_components/QuestCreate";

export default function Page() {
  return (
    <UserLayout title="Create Quest">
      <QuestCreate />
    </UserLayout>
  );
}
