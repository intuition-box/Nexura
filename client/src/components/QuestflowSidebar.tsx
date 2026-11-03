"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "./ui/sidebar";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AnimatedBackground from "./AnimatedBackground";

const mainNavItems = [
  { title: "Learn", subtitle: "", icon: "/sidebar-icons/learn.png", href: "/learn", activeClass: "nav-learn-active" },
  { title: "Explore", icon: "/sidebar-icons/explore.png", href: "/discover", activeClass: "nav-explore-active" },
  { title: "Referrals", icon: "/sidebar-icons/referrals.png", href: "/referrals", activeClass: "nav-referrals-active" },
  { title: "Quests", icon: "/sidebar-icons/quests.png", href: "/quests", activeClass: "nav-quests-active" },
  { title: "Campaigns", icon: "/sidebar-icons/campaigns.png", href: "/campaigns", activeClass: "nav-campaigns-active" },
  { title: "Ecosystem Dapps", icon: "/sidebar-icons/ecosystem-dapps.png", href: "/ecosystem-dapps", activeClass: "nav-ecosystem-dapps-active" },
  { title: "Leaderboard", icon: "/sidebar-icons/leaderboard.png", href: "/leaderboard", activeClass: "nav-leaderboard-active" },
  { title: "Portal Claims", icon: "/sidebar-icons/portal-claims.png", href: "/portal-claims", activeClass: "nav-portal-claims-active" },
  { title: "Analytics", icon: "/sidebar-icons/analytics.png", href: "/analytics", activeClass: "nav-analytics-active" },
  { title: "Nexura Studio", icon: "/sidebar-icons/nexura-studio.png", href: "/nexura-studio", activeClass: "nav-studio-active" },
];

export default function NexuraSidebar() {
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="flex flex-col h-full font-geist"
    >
      <AnimatedBackground />
      <SidebarContent className="bg-black/55 backdrop-blur-sm relative z-10 flex flex-col h-full justify-between font-geist">
        {/* Logo */}
        <div className="h-16 border-b border-border/40 flex items-center overflow-hidden px-3 group-data-[collapsible=icon]:justify-center">
          {/* Collapsed: nex.png icon */}
          <img
            src="/nex.png"
            alt="Nexura"
            className="h-8 w-auto object-contain flex-shrink-0 transition-opacity duration-300 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:block opacity-0 hidden"
          />
          {/* Expanded: full logo */}
          <img
            src="/nexura-logo.png"
            alt="Nexura"
            className="w-28 h-auto transition-opacity duration-300 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:hidden"
          />
        </div>

        {/* Main Navigation */}
        <SidebarGroup className="flex-1 overflow-auto">
          <SidebarGroupContent>
            <SidebarMenu
              className={`transform transition-all duration-500 ${
                mounted ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"
              }`}
            >
              {mainNavItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href === "/" && (pathname === "/" || pathname === "/discover"));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={isActive ? item.activeClass : ""}
                    >
                      <Link
                        href={item.href}
                        onClick={handleNavClick}
                        className="w-full flex items-center gap-1 group-data-[collapsible=icon]:justify-center"
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <img
                          src={item.icon}
                          alt={item.title}
                          className="w-5 h-5 flex-shrink-0 object-contain"
                        />
                        <span className="text-sm font-medium truncate transition-[opacity,max-width,margin-left] duration-300 ease-in-out overflow-hidden max-w-[180px] ml-2 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:ml-0">
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="w-full flex flex-col gap-1 px-2 py-1 border-t border-border/40">
  {/* Discord */}
  <a
    href="https://discord.gg/PK7wbXVCsE"
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1 min-h-[28px] group-data-[collapsible=icon]:justify-center hover:bg-gray-700 rounded px-1 transition-colors"
  >
    <img
      src="/discord-logo.png"
      alt="Discord"
      className="w-4 h-4 flex-shrink-0 object-contain"
    />
    <span className="text-xs font-semibold text-white transition-all duration-300 overflow-hidden max-w-[110px] group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
      Discord
    </span>
  </a>

  {/* X */}
  <a
    href="https://x.com/NexuraXYZ"
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1 min-h-[28px] group-data-[collapsible=icon]:justify-center hover:bg-gray-700 rounded px-1 transition-colors"
  >
    <img
      src="/x-logo.png"
      alt="X"
      className="w-4 h-4 flex-shrink-0 object-contain"
    />
    <span className="text-xs font-semibold text-white transition-all duration-300 overflow-hidden max-w-[110px] group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
      Twitter (X)
    </span>
  </a>

  {/* Docs */}
  <a
    href="/docs"
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1 min-h-[28px] group-data-[collapsible=icon]:justify-center hover:bg-gray-700 rounded px-1 transition-colors"
  >
    <img
      src="/notebook.png"
      alt="Docs"
      className="w-4 h-4 flex-shrink-0 object-contain"
    />
    <span className="text-xs font-semibold text-white transition-all duration-300 overflow-hidden max-w-[110px] group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
      Docs
    </span>
  </a>
</div>
      </SidebarContent>
    </Sidebar>
  );
}