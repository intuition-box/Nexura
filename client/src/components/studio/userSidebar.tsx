"use client";

import { cn } from "@/lib/utils";
import { Zap, Users, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { getStoredUserSession } from "@/lib/userSession";

type TabType = "questsTab" | "questSubmissions" | "lessonsTab";

interface UserSidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function UserSidebar({ activeTab, setActiveTab }: UserSidebarProps) {
  const router = useRouter();
  const [userAvatar, setUserAvatar] = useState("/default-avatar.png");
  const [username, setUsername] = useState("@user");

  const syncUser = useCallback(() => {
    try {
      const session = getStoredUserSession();
      if (session) {
        setUsername(session.username || session.name || "@user");
        setUserAvatar(session.avatar || "");
      }
    } catch {}
  }, []);

  useEffect(() => {
    syncUser();
    const handler = () => syncUser();
    window.addEventListener("user-session-update", handler);
    return () => window.removeEventListener("user-session-update", handler);
  }, []);

  const sidebarItems: { title: string; icon: string; id: TabType }[] = [
    { title: "Quests", icon: "/sidebar-icons/quests.png", id: "questsTab" },
    { title: "Lessons", icon: "/sidebar-icons/learn.png", id: "lessonsTab" },
    { title: "Dashboard", icon: "/sidebar-icons/analytics.png", id: "questSubmissions" },
  ];

  const routeByTab: Record<TabType, string> = {
    questsTab: "/user-dashboard/quests-tab",
    lessonsTab: "/user-dashboard/lessons-tab",
    questSubmissions: "/user-dashboard",
  };

  const navigate = (id: TabType) => {
    console.log(`[ACTION] UserSidebar.navigate → ${id} (${routeByTab[id]})`);
    setActiveTab(id);
    router.push(routeByTab[id]);
  };

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <div className="w-[16rem] border-r border-white/10 hidden md:flex flex-col z-20">
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <img src="/nexura-logo.png" alt="Nexura" className="w-32 h-auto" />
        </div>

        {/* User profile pill */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3 border-2 border-purple-500 rounded-2xl px-3 py-2">
            <div className="w-10 h-10 rounded-2xl overflow-hidden flex-shrink-0">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt="User"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.parentElement!.classList.add("bg-purple-500/30", "flex", "items-center", "justify-center");
                    target.parentElement!.innerHTML += `<span class="text-purple-300 text-sm font-bold">${username.charAt(0).toUpperCase()}</span>`;
                  }}
                />
              ) : (
                <div className="w-full h-full bg-purple-500/30 flex items-center justify-center text-purple-300 text-sm font-bold">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-white/60 text-xs">User</span>
              <span className="text-white font-semibold text-sm truncate">{username}</span>
            </div>
          </div>
        </div>

        {/* Navigation tabs */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group",
                activeTab === item.id
                  ? "text-[#8B3EFE] bg-white/5"
                  : "text-white hover:bg-purple-600/20 hover:text-purple-300"
              )}
            >
              <img
                src={item.icon}
                alt={item.title}
                className={cn(
                  "w-5 h-5 transition-all",
                  activeTab === item.id ? "brightness-125 scale-110" : "opacity-70 group-hover:opacity-100"
                )}
              />
              {item.title}
            </button>
          ))}
        </nav>

      </div>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <img src="/nexura-logo.png" alt="Nexura" className="h-6 w-auto" />

        <div className="flex items-center gap-2 border border-purple-500 rounded-xl px-2 py-1 max-w-[55%] min-w-0">
          <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt="User"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  target.parentElement!.classList.add("bg-purple-500/30", "flex", "items-center", "justify-center");
                  target.parentElement!.innerHTML += `<span class="text-purple-300 text-[10px] font-bold">${username.charAt(0).toUpperCase()}</span>`;
                }}
              />
            ) : (
              <div className="w-full h-full bg-purple-500/30 flex items-center justify-center text-purple-300 text-[10px] font-bold">
                {username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className="text-white text-xs font-semibold truncate">{username}</span>
        </div>
      </div>

      {/* ── Mobile bottom nav bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex bg-black/90 backdrop-blur-xl border-t border-white/10">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium transition-colors",
              activeTab === item.id ? "text-[#8B3EFE]" : "text-white hover:text-purple-300"
            )}
          >
            <img src={item.icon} alt={item.title} className="w-5 h-5" />
            <span>{item.title}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
