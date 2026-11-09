"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AnimatedBackground from "@/components/AnimatedBackground";
import StudioUpgradeNotice from "@/components/studio/StudioUpgradeNotice";
import { isStudioLive, isStudioPath } from "@/lib/studioAvailability";
import SupportWidget from "@/components/support/SupportWidget";
import { getStoredProjectToken } from "@/lib/projectApi";

export default function StudioGroupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Signed-in Studio pages get the support button
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { setSignedIn(!!getStoredProjectToken()); }, [pathname]);
  const showSupport = signedIn && pathname.startsWith("/studio-dashboard") && isStudioLive();

  useEffect(() => {
    const isStudioRoute =
      pathname === "/studio" ||
      pathname.startsWith("/studio-dashboard") ||
      pathname.startsWith("/projects/create") ||
      pathname.startsWith("/connect-discord") ||
      pathname.startsWith("/project/connected-discord") ||
      pathname.startsWith("/studio/register") ||
      pathname.startsWith("/studio/sign-in") ||
      pathname.startsWith("/studio/sign-up") ||
      pathname.startsWith("/studio/reset-password");

    document.body.classList.toggle("studio-theme", isStudioRoute && isStudioLive());
    return () => {
      document.body.classList.remove("studio-theme");
    };
  }, [pathname]);


  return (
    <div className="flex h-screen w-full text-white selection:bg-blue-500/30 relative">
      <AnimatedBackground />
      <div className="flex-1 flex flex-col relative z-10">
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          {isStudioPath(pathname) && !isStudioLive() ? <StudioUpgradeNotice /> : children}
        </main>
      </div>
      {showSupport && <SupportWidget mode="studio" />}
    </div>
  );
}
