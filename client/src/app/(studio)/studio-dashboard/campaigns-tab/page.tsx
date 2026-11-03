"use client";

import StudioLayout from "@/components/studio/StudioLayout";
import CampaignsTab from "@/components/admin/CampaignsTab";

export default function Page() {
  return (
    <StudioLayout title="Campaigns">
      <CampaignsTab />
    </StudioLayout>
  );
}
