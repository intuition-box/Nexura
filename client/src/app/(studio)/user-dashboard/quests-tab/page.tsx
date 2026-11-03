"use client";

import UserLayout from "@/components/studio/UserLayout";
import QuestsTab from "@/components/admin/QuestsTab";

export default function Page() {
  return (
    <UserLayout title="Quests">
      <QuestsTab />
    </UserLayout>
  );
}
