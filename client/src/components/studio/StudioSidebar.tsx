"use client";

import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { getStoredProjectInfo, projectApiRequest, getStoredProjectToken, storeProjectSession } from "@/lib/projectApi";

type TabType = "hubProfile" | "accountSettings" | "campaignSubmissions" | "adminManagement" | "campaignsTab" | "campaignsFlow";

type NavItem = {
  title: string;
  short?: string;
  icon: string;
  /** Rendered glyph size inside the icon box, when the artwork is smaller than the box. */
  iconSize?: number;
  id: TabType;
  badge?: string;
};

/** Tints a single-colour SVG with the current text colour so active/hover states can recolour it. */
function NavIcon({ src, box, size }: { src: string; box: number; size?: number }) {
  const mask = `url(${src}) center / ${size ? `${size}px ${size}px` : "contain"} no-repeat`;
  return (
    <span
      aria-hidden
      className="shrink-0 bg-current"
      style={{ width: box, height: box, mask, WebkitMask: mask }}
    />
  );
}

interface StudioSidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function StudioSidebar({
  activeTab,
  setActiveTab,
}: StudioSidebarProps) {
  const router = useRouter();

  // State to hold project info
  const [projectLogo, setProjectLogo] = useState("");
  const [projectHandle, setProjectHandle] = useState("@project");
  const [adminRole, setAdminRole] = useState<string>("");
  const [adminName, setAdminName] = useState("");

  const [campaignCount, setCampaignCount] = useState<number | null>(null);

  const sidebarItems: NavItem[] = [
    adminRole === "admin"
      ? { title: "My Profile", short: "Profile", icon: "/studio-sidebar/profile.svg", iconSize: 14.76, id: "accountSettings" as TabType }
      : { title: "Profile", short: "Profile", icon: "/studio-sidebar/profile.svg", iconSize: 14.76, id: "hubProfile" as TabType },
    ...(adminRole === "superadmin" || adminRole === "owner" ? [
      { title: "Admin Management", short: "Admins", icon: "/studio-sidebar/admin.svg", id: "adminManagement" as TabType },
    ] : []),
    { title: "Campaigns", short: "Campaigns", icon: "/studio-sidebar/campaigns.svg", id: "campaignsTab", badge: campaignCount ? String(campaignCount) : undefined },
    { title: "Submissions", short: "Submissions", icon: "/studio-sidebar/submissions.svg", id: "campaignSubmissions" },
  ];

  const loadCampaignCount = () =>
    projectApiRequest<{ hubCampaigns?: unknown[] }>({ method: "GET", endpoint: "/hub/get-campaigns" })
      .then((res) => setCampaignCount(res.hubCampaigns?.length ?? 0))
      .catch(() => { /* badge simply stays hidden */ });

  useEffect(() => { loadCampaignCount(); }, []);

  const loadHub = () => {
    const info = getStoredProjectInfo();
    if (info) {
      const name = (info.name ?? info.email ?? "Project") as string;
      setProjectHandle(name);
      if (info.logo) { setProjectLogo(info.logo as string); }
      if (info.role) setAdminRole(info.role as string);
    }

    // Always fetch /hub/me to get latest admin role + hub info
    return projectApiRequest<{ hub: Record<string, any>; admin?: Record<string, any> }>({ method: "GET", endpoint: "/hub/me" })
      .then(({ hub, admin }) => {
          if (hub) {
            const hubName = (hub.name ?? info?.name ?? info?.email ?? "Project") as string;
            const hubLogo = (hub.logo ?? "") as string;
            setProjectHandle(hubName);
            if (hubLogo) { setProjectLogo(hubLogo); }
            if (admin?.name) setAdminName(admin.name as string);

            // Store admin role from server
            if (admin?.role) {
              // The Owner is the hub's superAdmin, whatever their stored role says
              const owner = !!hub.superAdmin && !!admin._id && String(hub.superAdmin) === String(admin._id);
              setAdminRole(owner ? "owner" : admin.role as string);
            }

            // Persist so future mounts don't need the extra fetch
            const token = getStoredProjectToken();
            if (token) {
              storeProjectSession(token, { ...(info ?? {}), name: hubName, logo: hubLogo, role: admin?.role ?? info?.role ?? "admin", adminId: admin?._id ?? info?.adminId ?? "" });
            }
          }
        })
        .catch(() => { /* ignore -- offline or no hub yet */ });
  };

  useEffect(() => { loadHub(); }, []);

  // Badge count, role (e.g. a promotion to Super Admin) and project name/logo stay current
  useLiveRefresh(() => Promise.all([loadCampaignCount(), loadHub()]));

  const routeByTab: Record<TabType, string> = {
    hubProfile: "/studio-dashboard/hub-profile",
    accountSettings: "/studio-dashboard/account-settings",
    campaignSubmissions: "/studio-dashboard/dashboard",
    campaignsTab: "/studio-dashboard/campaigns-tab",
    campaignsFlow: "/studio-dashboard/campaigns-flow",
    adminManagement: "/studio-dashboard/admin-management",
  };

  const navigate = (id: TabType) => {
    setActiveTab(id);
    router.push(routeByTab[id]);
  };

  return (
    <>
      {/* -- Desktop sidebar -- */}
      <aside
        className="hidden md:flex w-[250px] shrink-0 flex-col border-r border-black/20 bg-[#f5f4fd] z-20"
        style={{ fontFamily: "'Geist', 'Inter', sans-serif" }}
      >
        {/* Logo + Studio tag */}
        <div className="flex items-center gap-3 pl-6 pt-[30px]">
          <img src="/studio-sidebar/nexura-logo-dark.png" alt="Nexura" className="h-7 w-[110px] object-cover" />
          <span className="flex h-[16.7px] w-[55px] items-center justify-center rounded-[12.36px] bg-[#8b3efe] text-[8.8px] font-semibold leading-[11.25px] text-white">
            Studio
          </span>
        </div>

        {/* Navigation tabs */}
        <nav className="mt-5 ml-[17px] mr-[14px] flex flex-col">
          <p className="px-3 pt-[15.4px] pb-[6.8px] text-[10.5px] font-semibold uppercase leading-[16.27px] tracking-[1.365px] text-[#63607a]">
            Project
          </p>
          {sidebarItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={cn(
                  "relative flex h-[45px] w-full items-center gap-[11px] rounded-[40px] px-3 text-left text-[14px] font-medium transition-colors",
                  active
                    ? "bg-[#e7e8fc] text-[#8b3efe]"
                    : "text-[#232a43] hover:bg-[#e7e8fc]/60"
                )}
              >
                {active && (
                  <span aria-hidden className="absolute left-[-14px] top-[9.76px] h-[26px] w-[3px] rounded-r-[3px] bg-[#8b3efe]" />
                )}
                <span className={active ? "" : "opacity-90"}>
                  <NavIcon src={item.icon} box={item.iconSize ? 20 : 19} size={item.iconSize} />
                </span>
                <span className={cn("truncate", !active && "opacity-90")}>{item.title}</span>
                {item.badge && (
                  <span className="ml-auto rounded-[20px] bg-[rgba(139,62,254,0.2)] px-2 py-px text-[11px] font-semibold text-[#8b3efe]">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => navigate("accountSettings")}
          aria-label="Account settings"
          className={cn(
            "mt-auto mb-[14px] mx-auto flex w-[235px] items-center gap-[10px] rounded-[40px] border border-black/20 px-[10.8px] py-[9.8px] text-left transition-colors hover:bg-[#efedfb]",
            activeTab === "accountSettings" ? "bg-[#e7e8fc]" : "bg-[#f8f7fd]"
          )}
        >
          <span
            className="flex size-[26px] shrink-0 items-center justify-center rounded-[40px] text-[12px] font-bold leading-[18.6px] text-white"
            style={{ backgroundImage: "linear-gradient(120deg, #9b7cff 0%, #7c5cfc 45%, #5aa8ff 100%)" }}
          >
            {(adminName || projectHandle).slice(0, 1).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-semibold leading-[20.15px] text-[#232a43]">{adminName ? `@${adminName}` : projectHandle}</span>
            <span className="truncate text-[11px] leading-[17px] text-[#605d72]">
              {adminRole === "owner" ? "Owner" : adminRole === "superadmin" ? "Super Admin" : "Admin"}{adminName ? ` · ${projectHandle}` : ""}
            </span>
          </span>
          <span aria-hidden className="flex size-[32px] shrink-0 items-center justify-center rounded-[10px]">
            <img src="/studio-sidebar/settings.svg" alt="" className="size-[16.992px]" />
          </span>
        </button>
      </aside>

      {/* -- Mobile top bar -- */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <img src="/nexura-logo.png" alt="Nexura" className="h-7 w-auto" />
        <button
          onClick={() => {
            setActiveTab("hubProfile");
            router.push("/studio-dashboard/hub-profile");
          }}
          className="flex items-center gap-2 border border-purple-500 rounded-xl px-2 py-1 max-w-[55%] min-w-0 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0">
            <img src={projectLogo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-white text-xs font-semibold truncate">{projectHandle}</span>
        </button>
      </div>

      {/* GG Mobile bottom nav bar GG */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex bg-black/90 backdrop-blur-xl border-t border-white/10 safe-area-inset-bottom">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium transition-colors",
              activeTab === item.id ? "text-[#9a58ff]" : "text-white hover:text-purple-300"
            )}
          >
            <NavIcon src={item.icon} box={20} size={item.iconSize} />
            <span>{item.short ?? item.title}</span>
          </button>
        ))}
      </nav>
    </>
  );
}


