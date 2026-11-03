"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import AnimatedBackground from "@/components/AnimatedBackground";

export default function StudioGroupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

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

    document.body.classList.toggle("studio-theme", isStudioRoute);
    return () => {
      document.body.classList.remove("studio-theme");
    };
  }, [pathname]);

  return (
    <div className="flex h-screen w-full text-white selection:bg-blue-500/30 relative">
      <AnimatedBackground />
      <div className="flex-1 flex flex-col relative z-10">
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
