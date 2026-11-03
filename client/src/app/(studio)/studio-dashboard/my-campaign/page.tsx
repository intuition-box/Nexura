"use client";

import StudioLayout from "@/components/studio/StudioLayout";
import MyCampaign from "@/components/admin/MyCampaign";

export default function Page() {
  return (
    <StudioLayout title="My Campaign">
      <MyCampaign />
    </StudioLayout>
  );
}
