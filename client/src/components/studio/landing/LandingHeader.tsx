"use client";

import Link from "next/link";
import { MAIN_APP_URL } from "@/lib/mainAppUrl";

const NAV = [
  { label: "Platform", href: "#platform" },
  { label: "Campaigns & quests", href: "#campaigns" },
  { label: "Learning", href: "#learning" },
  { label: "Operations", href: "#operations" },
  { label: "Analytics", href: "#analytics" },
  { label: "How it works", href: "#how-it-works" },
];

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-[60px] w-full items-center justify-between gap-4 border-b-[0.833px] border-[rgba(28,37,51,0.19)] bg-[rgba(255,255,255,0.29)] px-4 backdrop-blur-[8px] sm:px-[36px]">
      <Link href="/studio" aria-label="Nexura Studio" className="block h-[28px] w-[110px] shrink-0">
        <img src="/studio-auth/logo.png" alt="Nexura" className="h-full w-full object-cover" />
      </Link>
      <nav className="hidden items-start gap-[24px] pl-[12px] xl:flex">
        {NAV.map(n => (
          <a key={n.href} href={n.href} className="whitespace-nowrap text-[14px] font-medium leading-[21.7px] text-[#232a43] hover:text-[#8a3ffc]">{n.label}</a>
        ))}
      </nav>
      <div className="flex items-center gap-[10px]">
        <Link href="/studio/sign-in" className="hidden h-[37.988px] items-center rounded-[999px] px-[16px] text-[13.5px] font-semibold text-[#232a43] sm:flex">Sign in</Link>
        <Link href="/studio/sign-up" className="flex h-[37.988px] items-center rounded-[999px] border-[1.25px] border-[#8a3ffc] bg-[#8a3ffc] px-[16px] text-[13.5px] font-semibold text-white drop-shadow-[0px_10px_13px_rgba(138,63,252,0.35)]">Get started</Link>
        <a href={MAIN_APP_URL} className="hidden h-[38px] items-center justify-center gap-[10px] rounded-[999px] border border-[rgba(167,139,250,0.28)] bg-[#1c2533] px-[17px] py-[10px] md:flex">
          <img src="/studio-landing/link-square.svg" alt="" className="size-[16px]" />
          <span className="whitespace-nowrap text-[12.8px] font-semibold text-[#f7f5ff]">Back to Main App</span>
        </a>
      </div>
    </header>
  );
}
