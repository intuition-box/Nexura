"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import StudioBackground from "@/components/StudioBackground";
import UserSidebar from "./userSidebar";
import StudioHeader from "./StudioHeader";
import { getStoredUserSession, storeUserSession } from "@/lib/userSession";
import { projectApiRequest } from "@/lib/projectApi";
import { userApiRequest } from "@/lib/userApi";

type TabType = "questSubmissions" | "questsTab" | "lessonsTab";

interface UserLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function UserLayout({
  children,
  title = "User Dashboard",
}: UserLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const user = getStoredUserSession();
  const apiPrefix = user?.type === "user" ? "/user-hub" : "/hub";
  const apiRequest = user?.type === "user" ? userApiRequest : projectApiRequest;

  const deriveTab = (): TabType => {
    if (pathname.includes("quests-tab") || pathname.includes("create-new-quest")) return "questsTab";
    if (pathname.includes("lessons-tab") || pathname.includes("create-lesson")) return "lessonsTab";
    if (pathname.includes("dashboard")) return "questSubmissions";
    return "questsTab";
  };

  const [activeTab, setActiveTab] = useState<TabType>(deriveTab);

  useEffect(() => {
    setActiveTab(deriveTab());
  }, [pathname]);

  useEffect(() => {
    if (!user?.type || user.type !== "user") {
      router.push("/discover");
    }
  }, [user]);

  useEffect(() => {
    if (user?.token) {
      (async () => {
        try {
          const res = await apiRequest<{ hub?: any; admin?: any }>({
            method: "GET",
            endpoint: `${apiPrefix}/me`,
          });
          if (res.admin && res.hub) {
            const current = getStoredUserSession();
            if (
              current &&
              (!current.hub ||
                current.username !== res.admin.name ||
                (res.hub.logo && current.avatar !== res.hub.logo))
            ) {
              const updated = {
                ...current,
                hub: res.hub._id,
                username: res.admin.name,
                name: res.admin.name,
                avatar: res.hub.logo,
              };
              storeUserSession(updated);
              window.dispatchEvent(new Event("user-session-update"));
            }
          }
        } catch (err) {
          console.error("Failed to sync hub info in layout", err);
        }
      })();
    }
  }, [user?.token]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <StudioBackground />

      <div className="relative z-10 flex h-screen flex-col md:flex-row">
        <UserSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Desktop header */}
          <div className="hidden md:block">
            <StudioHeader title={title} />
          </div>

          {/* CONTENT AREA — padded for mobile top bar + bottom nav */}
          <main className="flex-1 overflow-y-auto pt-14 pb-20 px-4 md:pt-8 md:pb-8 md:px-9 relative bg-[#f7f5ff] text-[#1c2533]" style={{ fontFamily: "'Geist', 'Inter', sans-serif" }}>
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
