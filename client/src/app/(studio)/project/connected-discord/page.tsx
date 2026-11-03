"use client";

import { Suspense } from "react";
import StudioLayout from "@/components/studio/StudioLayout";
import ConnectedDiscord from "../../_components/ConnectedDiscord";

export default function Page() {
  return (
    <StudioLayout title="Connect Discord">
      <Suspense fallback={null}>
        <ConnectedDiscord />
      </Suspense>
    </StudioLayout>
  );
}
