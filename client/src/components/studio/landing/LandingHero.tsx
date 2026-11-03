import Link from "next/link";
import { MONO } from "./fonts";

const HERO_BG =
  "radial-gradient(76.25% 43.81% at 50% 50%, rgba(138,63,252,0.14) 0%, rgba(138,63,252,0) 100%), radial-gradient(50.83% 31.29% at 85% 0%, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0) 100%)";

const NAV = [
  { label: "Profile", icon: "nav-profile.svg", size: 20 },
  { label: "Dashboard", icon: "nav-dashboard.svg", size: 19 },
  { label: "Campaigns", icon: "nav-campaigns.svg", size: 19, active: true, count: 4 },
  { label: "Admin management", icon: "nav-admin.svg", size: 19 },
  { label: "Submissions", icon: "nav-submissions.svg", size: 18.984 },
];

const STATS = [
  { label: "Participation", value: "1,016", note: "500 reward slots" },
  { label: "Reward utilisation", value: "52%", note: "$7,333 of $14,000 claimed" },
  { label: "Active this week", value: "420", note: "41% of participants" },
  { label: "Finished the journey", value: "150", note: "18% of participants" },
];

const ACTIVITY: { icon: string; who: string; text: string; amount?: string; time?: string; review?: boolean }[] = [
  { icon: "✓", who: "0xenilo", text: " · Completed Stage 2 · On-chain Tasks", time: "2h ago" },
  { icon: "$", who: "0xehdge", text: " · Claimed the Stage 4 reward · ", amount: "$7", time: "2h ago" },
  { icon: "✓", who: "0xboilo", text: " · Stage 5 task approved by an admin", time: "2h ago" },
  { icon: "◉", who: "ethnigg", text: " · Submitted a Stage 5 task for manual review", review: true },
];

const TABS = ["Overview", "Journey", "Participants", "Outcomes", "Rewards", "History"];

function SampleWorkspace() {
  return (
    <div className="w-full max-w-[1080px] rounded-t-[40px] border-x-[1.25px] border-t-[1.25px] border-[#e8e4f6] bg-white px-[14px] pt-[14px] drop-shadow-[0px_50px_50px_rgba(138,63,252,0.45)]">
      <div className="flex items-center gap-[6px] px-[10px] pb-[12px] pt-[4px]">
        {[0, 1, 2].map(i => <span key={i} className="size-[10px] rounded-[5px] bg-[#e4e0f2]" />)}
        <span className="pl-[10px] text-[12px] leading-[18.6px] text-[#5b6478]">Nexura Studio · Sample workspace</span>
      </div>
      <div className="grid h-[573px] grid-cols-1 overflow-hidden rounded-t-[28px] border-x-[1.25px] border-t-[1.25px] border-[rgba(28,37,51,0.4)] bg-[#f7f5ff] md:grid-cols-[200px_1fr]">
        <aside className="relative hidden border-r border-[rgba(0,0,0,0.2)] bg-[#f5f4fd] md:block">
          <div className="absolute left-[11px] top-[30px] flex items-center gap-[12px]">
            <img src="/studio-landing/logo-small.png" alt="Nexura" className="h-[28px] w-[110px] object-cover" />
            <span className="flex h-[16.685px] w-[55px] items-center justify-center rounded-[12.36px] bg-[#8b3efe] text-[8.8px] font-semibold leading-[11.247px] text-white">Studio</span>
          </div>
          <nav className="absolute left-[14.5px] top-[77.8px] flex w-[183px] flex-col">
            <span className="px-[12px] pb-[6.825px] pt-[15.415px] text-[10.5px] font-semibold uppercase leading-[16.27px] tracking-[1.365px] text-[#63607a]">Project</span>
            {NAV.map(n => (
              <span
                key={n.label}
                className={`relative flex h-[45px] items-center gap-[11px] whitespace-nowrap px-[12px] py-[9px] text-[14px] font-medium ${n.active ? "rounded-[40px] bg-[#e7e8fc] pl-[8px] text-[#8b3efe]" : "rounded-[10px] text-[#232a43]"}`}
              >
                {n.active && <span className="absolute left-[-14px] top-[9.76px] h-[26px] w-[3px] rounded-r-[3px] bg-[#8b3efe]" />}
                <img src={`/studio-landing/${n.icon}`} alt="" style={{ width: n.size, height: n.size }} className={n.active ? "" : "opacity-90"} />
                <span className={n.active ? "" : "opacity-90"}>{n.label}</span>
                {n.count != null && (
                  <span className="ml-auto rounded-[20px] bg-[rgba(139,62,254,0.2)] px-[8px] py-px text-[11px] font-semibold text-[#8b3efe]">{n.count}</span>
                )}
              </span>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col">
          <div className="flex items-center justify-between border-b-[1.25px] border-[#e8e4f6] bg-white px-[20px] py-[12px]">
            <span className="text-[15px] font-bold leading-[23.25px] text-[#1c2533]">Campaigns</span>
            <div className="hidden items-center gap-[8px] sm:flex">
              <span className="relative h-[23.984px] w-[45.996px] rounded-[999px] bg-[#f1eefc]">
                <span className="absolute left-[2.99px] top-[2.99px] size-[17.988px] rounded-[8.994px] bg-[#8a3ffc]" />
              </span>
              <span className="size-[25.996px] rounded-[12.998px] border-[1.25px] border-[#e8e4f6] bg-white" />
              <span className="rounded-[999px] bg-[#8a3ffc] px-[13px] py-[6px] text-[11.5px] font-bold leading-[17.825px] text-white" style={{ fontFamily: MONO }}>● 0x8F3a…C42e</span>
              <span className="rounded-[999px] bg-black px-[13px] py-[6px] text-[11.5px] font-semibold leading-[17.825px] text-white">Back to Main App</span>
            </div>
          </div>

          <div className="flex flex-col px-[20px] py-[18px]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col">
                <div className="flex gap-[6px]">
                  <span className="rounded-[999px] bg-[rgba(0,225,162,0.16)] px-[9px] py-[3px] text-[11px] font-semibold leading-[17.05px] text-[#05936b]">Active</span>
                  <span className="rounded-[999px] bg-[rgba(138,63,252,0.12)] px-[9px] py-[3px] text-[11px] font-semibold leading-[17.05px] text-[#8a3ffc]">Retention</span>
                </div>
                <span className="pb-[2px] pt-[6px] text-[20px] font-semibold leading-[23px] tracking-[-0.4px] text-[#1c2533]">Momentum: Q3 Retention Sprint</span>
                <span className="pt-[1.74px] text-[10.417px] leading-[16.146px] text-[#6b7690]">Intuition Labs · Jul 1, 2026 → Aug 15, 2026</span>
              </div>
              <div className="hidden gap-[6px] lg:flex">
                <span className="rounded-[999px] border-[1.25px] border-[#e3def3] bg-white px-[12px] py-[6px] text-[11.5px] font-semibold leading-[17.825px] text-[#1c2533]">View public page</span>
                <span className="h-[33px] w-[110px] rounded-[999px] border-[1.25px] border-[#8a3ffc] bg-[#8a3ffc] px-[12px] py-[6px] text-[11.5px] font-semibold leading-[17.825px] text-white shadow-[0px_8px_18px_-8px_rgba(138,63,252,0.8)]">+ Increase pool</span>
                <span className="rounded-[999px] border-[1.25px] border-[#e3def3] bg-white px-[12px] py-[6px] text-[11.5px] font-semibold leading-[17.825px] text-[#1c2533]">Edit campaign</span>
              </div>
            </div>

            <div className="mt-[14px] flex h-[36.855px] gap-[22px] overflow-hidden border-b-[1.25px] border-[#e8e4f6]">
              {TABS.map(t => (
                <span
                  key={t}
                  className={`h-[36.602px] border-b-[1.25px] py-[8px] text-[12.5px] leading-[19.375px] ${t === "Participants" ? "border-[#8a3ffc] font-semibold text-[#1c2533]" : "border-transparent font-medium text-[#6b7690]"}`}
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-[14px] grid grid-cols-2 gap-[10px] lg:grid-cols-4">
              {STATS.map(s => (
                <div key={s.label} className="flex flex-col rounded-[20px] border-[1.25px] border-[#ece8f8] bg-white px-[14px] py-[13px]">
                  <span className="text-[11px] leading-[17.05px] text-[#6b7690]">{s.label}</span>
                  <span className="pb-px pt-[3px] text-[22px] font-semibold tracking-[-0.44px] text-[#1c2533]">{s.value}</span>
                  <span className="pt-[1.75px] text-[10.5px] leading-[16.275px] text-[#6b7690]">{s.note}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-[6px] pt-[16px]">
              <span className="flex-1 text-[13.5px] font-bold leading-[20.925px] text-[#1c2533]">Participant activity</span>
              <span className="rounded-[999px] border-[1.25px] border-[#8a3ffc] bg-[#8a3ffc] px-[11px] py-[4px] text-[11px] font-semibold leading-[17.05px] text-white">All activity</span>
              {["Completed", "In review", "Claimed"].map(f => (
                <span key={f} className="hidden rounded-[999px] border-[1.25px] border-[#e3def3] bg-white px-[11px] py-[4px] text-[11px] font-semibold leading-[17.05px] text-[#1c2533] sm:inline">{f}</span>
              ))}
            </div>

            <div className="mt-[10px] flex flex-col rounded-[22px] border-[1.25px] border-[#ece8f8] bg-white px-[14px] py-[4px]">
              {ACTIVITY.map((a, i) => (
                <div key={a.who} className={`flex items-center gap-[10px] py-[10px] ${i ? "border-t-[1.25px] border-[#f0edf8]" : ""}`}>
                  <span className="flex size-[23.984px] shrink-0 items-center justify-center rounded-[11.992px] bg-[#f1eefc] text-[11px] font-bold leading-[17.05px] text-[#8a3ffc]">{a.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] leading-[16.875px] text-[#1c2533]">
                    <span className="mr-[2px] inline-block h-[17px] rounded-[40px] bg-[#f1eefc] px-[7px] text-[10.5px] leading-[17px]" style={{ fontFamily: MONO }}>{a.who}</span>
                    {a.text}{a.amount && <b className="font-bold text-[#05936b]">{a.amount}</b>}
                  </span>
                  {a.review
                    ? <span className="rounded-[999px] border-[1.25px] border-[#e3def3] bg-[#f7f5ff] px-[11px] py-[3px] text-[11px] font-semibold leading-[17.05px] text-[#1c2533]">Review</span>
                    : <span className="text-[10.5px] leading-[16.275px] text-[#8a93a8]">{a.time}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroIntro() {
  return (
    <>
      <span className="flex h-[34.648px] items-center gap-[8px] rounded-[999px] border-[1.25px] border-[#e8e4f6] bg-white px-[14px] py-[6px]">
        <span className="size-[6.992px] rounded-[3.496px] bg-[#00e1a2]" />
        <span className="text-[13px] font-semibold leading-[20.15px] text-[#8a3ffc]">Nexura Studio</span>
      </span>
      <h1 className="max-w-[880px] pt-[20px] text-center text-[40px] font-semibold leading-[1.02] tracking-[-2.38px] text-[#1c2533] sm:text-[68px] sm:leading-[69.36px]">
        Build experiences that turn communities into{" "}
        <span className="bg-gradient-to-r from-[#8a3ffc] to-[#3b82f6] bg-clip-text text-transparent">contributors.</span>
      </h1>
      <p className="max-w-[640px] pt-[20px] text-center text-[17px] leading-[29.45px] text-[#5b6478] sm:text-[19px]">
        One workspace to create campaigns and quests, teach with lessons, review contributions, manage your team and measure what happens next.
      </p>
      <div className="flex justify-center gap-[12px] pt-[30px]">
        <Link href="/studio/sign-up" className="flex h-[43.984px] items-center gap-[8px] rounded-[999px] border-[1.25px] border-[#8a3ffc] bg-[#8b3efe] px-[22px] text-[14.5px] font-semibold text-white drop-shadow-[0px_10px_13px_rgba(138,63,252,0.3)]">
          Get started
          <img src="/studio-landing/arrow-right.svg" alt="" className="size-[15.996px]" />
        </Link>
        <Link href="/studio/sign-in" className="flex h-[43.984px] items-center rounded-[999px] border-[1.25px] border-[#e8e4f6] bg-white px-[22px] text-[14.5px] font-semibold text-[#1c2533]">Sign in</Link>
      </div>
      <p className="pt-[18px] text-center text-[13px] leading-[20.15px] text-[#5b6478]">Made for founders, project teams and ecosystem builders.</p>
    </>
  );
}

export const HERO_BACKGROUND = HERO_BG;

export default function LandingHero() {
  return (
    <section className="flex w-full flex-col items-center pt-[76px]" style={{ backgroundImage: HERO_BG }}>
      <div className="flex w-full max-w-[1200px] flex-col items-center px-4 sm:px-[32px]">
        <HeroIntro />
        <div className="flex w-full justify-center pt-[52px]">
          <SampleWorkspace />
        </div>
      </div>
    </section>
  );
}
