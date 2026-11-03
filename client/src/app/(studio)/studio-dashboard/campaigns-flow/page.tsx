"use client";

import StudioLayout from "@/components/studio/StudioLayout";
import CampaignStudio from "@/components/studio/campaign-flow/CampaignStudio";

export default function CampaignsFlowPage() {
  return (
    <StudioLayout title="New Campaigns" bleed>
      <CampaignStudio />
    </StudioLayout>
  );
}
