"use client";

import { Suspense } from "react";
import ProfilePage from "@/components/studio/profile/ProfilePage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProfilePage />
    </Suspense>
  );
}
