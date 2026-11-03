"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import NexuraSidebar from "@/components/QuestflowSidebar";
import ProfileBar from "@/components/ProfileBar";
import ProjectLogoutButton from "@/components/ProjectLogoutButton";
import AnimatedBackground from "@/components/AnimatedBackground";
import AnalyticsBackground from "@/components/AnalyticsBackground";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const location = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location]);

  useEffect(() => {
    const isStudioRoute =
      location === "/studio" ||
      location.startsWith("/studio-dashboard") ||
      location.startsWith("/projects/create") ||
      location.startsWith("/connect-discord") ||
      location.startsWith("/project/connected-discord") ||
      location.startsWith("/studio/register") ||
      location.startsWith("/studio/reset-password");

    document.body.classList.toggle("studio-theme", isStudioRoute);
    document.body.classList.toggle("nexura-studio-light", location === "/nexura-studio");

    return () => {
      document.body.classList.remove("studio-theme", "nexura-studio-light");
    };
  }, [location]);

  const isHome = location === "/" || location === "/home";
  const isUser = location.startsWith("/user-dashboard");
  const isStudio =
    location === "/studio" ||
    location.startsWith("/studio-dashboard") ||
    location.startsWith("/connect-discord") ||
    location.startsWith("/project/connected-discord") ||
    location.startsWith("/studio/register") ||
    location.startsWith("/studio/reset-password") ||
    location.startsWith("/studio/") ||
    location.startsWith("/projects/");
  const isProject = location.startsWith("/project/");
  const isProjectCreate = location.startsWith("/projects/create");
  const isDocs = location.startsWith("/docs");

  return (
    <div className="flex h-screen w-full text-white selection:bg-blue-500/30 relative">

      {/* BACKGROUND FOR ALL PAGES */}
      {isDocs ? <AnalyticsBackground /> : <AnimatedBackground />}

      {/* Sidebar */}
      {!isHome && !isStudio && !isUser && !isDocs && !isProjectCreate && <NexuraSidebar />}

      {/* Main content */}
      <div className="flex-1 flex flex-col relative z-10">

        {!isHome && !isStudio && !isUser && !isProjectCreate && (
          <header className="flex items-center p-4 app-header">

            {/* LEFT: Logo (only for docs) */}
            {isDocs && (
              <div className="hidden lg:flex items-center">
                <img
                  src="/nexura-logo.png"
                  alt="Nexura"
                  className="h-8 w-auto"
                />
              </div>
            )}

            <SidebarTrigger
              data-testid="button-sidebar-toggle"
              className="md:hidden"
            />

            {/* RIGHT: Controls */}
            <div className="ml-auto flex items-center gap-4">
              <ProfileBar />
            </div>

          </header>
        )}

        <main ref={mainRef} className="flex-1 overflow-y-auto">
          {children}
        </main>

      </div>

      {/* {!isHome && !isStudio && !isProject && <OrgSignInButton />} */}
      {isProject && <ProjectLogoutButton />}
    </div>
  );
}
