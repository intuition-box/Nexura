"use client";

import type { ReactNode } from "react";
import StudioUpgradeNotice from "./StudioUpgradeNotice";
import { isStudioLive } from "@/lib/studioAvailability";

/** Shows its children where Nexura Studio is open, and the upgrade notice everywhere else. */
export default function StudioLiveGate({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return isStudioLive() ? <>{children}</> : <StudioUpgradeNotice compact={compact} />;
}
