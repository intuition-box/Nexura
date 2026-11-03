import { MONO } from "./fonts";
import { Pill, SectionIntro } from "./LandingParts";

const SUBMISSIONS = ["Cylia", "Emmy"];
const TEAM = [
  { initial: "E", name: "Emmy", role: "Owner", access: "Full access" },
  { initial: "K", name: "Kemi", role: "Super Admin", access: "Submissions" },
  { initial: "D", name: "New invite", role: "Admin (pending)", access: "Awaiting approval" },
];

const PANEL_BG = { backgroundImage: "linear-gradient(166.68deg, #f4f1ff 8.49%, #f2f6ff 91.51%)" };

function Panel({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <div className="pb-[14px]">
      <div className="flex h-full flex-col gap-[12px] rounded-[40px] border-[1.25px] border-[#e8e4f6] p-[20px] sm:p-[28px]" style={PANEL_BG}>
        {children}
        <p className="px-[6px] py-[4px] text-[14.5px] leading-[22.475px] text-[#5b6478]">{caption}</p>
      </div>
    </div>
  );
}

export default function OperationsSection() {
  return (
    <section id="operations" className="pt-[110px]">
      <SectionIntro
        eyebrow="Manage the entire operation"
        title="Review, assign and oversee from one place."
        text="Admin management is how your team stays in control: who can review, who can approve, and what needs attention next."
      />
      <div className="grid grid-cols-1 gap-[16px] pt-[44px] lg:grid-cols-2">
        <Panel caption="Review manual submissions and verification results, with clear approve and reject decisions.">
          <div className="overflow-hidden rounded-[24px] border-[1.25px] border-[#e8e4f6] bg-[#f7f5ff] px-[20px] py-[18px]">
            <div className="flex items-center gap-[6px]">
              <span className="flex-1 text-[13.5px] font-bold leading-[20.925px] text-[#1c2533]">Submissions</span>
              <span className="rounded-[999px] border-[1.25px] border-[#8a3ffc] bg-[#8a3ffc] px-[11px] py-[4px] text-[11px] font-semibold leading-[17.05px] text-white">In review</span>
            </div>
            <div className="mt-[10px] flex flex-col rounded-[22px] border-[1.25px] border-[#ece8f8] bg-white px-[14px] py-[4px]">
              {SUBMISSIONS.map(who => (
                <div key={who} className="flex h-[46.5px] items-center gap-[10px]">
                  <span className="flex size-[23.984px] shrink-0 items-center justify-center rounded-[11.992px] bg-[#f1eefc] text-[11px] font-bold text-[#8a3ffc]">◉</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] leading-[16.875px] text-[#1c2533]">
                    <span className="mr-[4px] inline-block h-[16px] rounded-[40px] bg-[#f1eefc] px-[7px] text-[10.5px] leading-[16px]" style={{ fontFamily: MONO }}>{who}</span>
                    · Submitted a Stage 5 task for manual review
                  </span>
                  <span className="rounded-[999px] border-[1.25px] border-[#e3def3] bg-[#f7f5ff] px-[11px] py-[3px] text-[11px] font-semibold leading-[17.05px] text-[#1c2533]">Review</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel caption="Set roles and permissions, invite teammates and route changes through approval proposals.">
          <div className="rounded-[20px] border-[1.25px] border-[#e8e4f6] bg-white p-[16px]">
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-semibold leading-[20.925px] text-[#1c2533]">Team and permissions</span>
              <Pill>Admin</Pill>
            </div>
            <div className="pt-[12px]">
              {TEAM.map(t => (
                <div key={t.name} className="flex items-center gap-[10px] border-t-[1.25px] border-[#f0edf8] py-[9px]">
                  <span
                    className="flex size-[27.988px] shrink-0 items-center justify-center rounded-[13.994px] text-[11px] font-bold text-white"
                    style={{ backgroundImage: "linear-gradient(135deg, #b45fc7 0%, #3b82f6 100%)" }}
                  >
                    {t.initial}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-[13px] leading-[20.15px] text-[#1c2533]">{t.name}</span>
                    <span className="text-[11.5px] leading-[17.825px] text-[#5b6478]">{t.role}</span>
                  </span>
                  <Pill tone="grey">{t.access}</Pill>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
}
