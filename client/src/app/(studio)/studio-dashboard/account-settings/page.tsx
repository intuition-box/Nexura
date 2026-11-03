"use client";

import { Suspense } from "react";
import AccountSettingsPage from "@/components/studio/profile/AccountSettingsPage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AccountSettingsPage />
    </Suspense>
  );
}
