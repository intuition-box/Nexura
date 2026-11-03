import { Pill, SectionIntro } from "./LandingParts";

const STAGES = [
  { when: "At join", reward: "$4" },
  { when: "3 days after previous stage", reward: "$5" },
  { when: "4 days after previous stage", reward: null },
  { when: "7 days after previous stage", reward: "$6" },
  { when: "16 days after previous stage", reward: "$5" },
];

const QUESTS = [
  { label: "Follow on X", xp: "+50 XP", done: true },
  { label: "Join the Discord", xp: "+50 XP", done: true },
  { label: "Swap on the DEX", xp: "+120 XP", done: false },
  { label: "Share your take", xp: "+80 XP", done: false },
];

function Badge({ children, tone }: { children: React.ReactNode; tone: "amber" | "green" | "grey" }) {
  const cls = { amber: "bg-[#fff3dc] text-[#b7791f]", green: "bg-[rgba(0,225,162,0.16)] text-[#05936b]", grey: "bg-[#eef0f6] text-[#5b6478]" }[tone];
  return <span className={`shrink-0 whitespace-nowrap rounded-[999px] px-[8px] py-[2px] text-[10.5px] font-semibold leading-[16.275px] ${cls}`}>{children}</span>;
}

function TypeCard({ eyebrow, eyebrowColor, title, text, tags, tagTone, children, className = "" }: {
  eyebrow: string; eyebrowColor: string; title: string; text: string; tags: string[]; tagTone: "purple" | "blue"; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex flex-col gap-[18px] rounded-[40px] border-[1.25px] border-[#e8e4f6] bg-white p-[24px] sm:p-[34px] ${className}`}>
      <div>
        <p className="text-[12px] font-semibold uppercase leading-[18.6px] tracking-[1.2px]" style={{ color: eyebrowColor }}>{eyebrow}</p>
        <h3 className="text-[26px] font-semibold leading-[29.9px] tracking-[-0.91px] text-[#1c2533]">{title}</h3>
      </div>
      <p className="max-w-[490px] text-[14px] leading-[21.7px] text-[#5b6478]">{text}</p>
      {children}
      <div className="flex flex-wrap gap-[8px]">{tags.map(t => <Pill key={t} tone={tagTone}>{t}</Pill>)}</div>
    </div>
  );
}

export default function CampaignsSection() {
  return (
    <section id="campaigns" className="pt-[110px]">
      <SectionIntro
        eyebrow="Create meaningful engagement"
        title="Campaigns organize. Quests activate."
        text="Shape a whole experience with a campaign, ask for one clear action with a quest, or use both together."
      />
      <div className="grid grid-cols-1 items-start gap-[16px] pt-[44px] lg:grid-cols-2">
        <TypeCard
          eyebrow="Campaign" eyebrowColor="#8a3ffc" title="A broader engagement experience"
          text="Organize multiple stages and activities with deadlines, return periods and reward allocations that keep people coming back."
          tags={["Multi-stage", "Return periods", "Stage rewards"]} tagTone="purple"
        >
          <div className="overflow-hidden rounded-[24px] border-[1.25px] border-[#e8e4f6] bg-[#f7f5ff] px-[20px] py-[18px]">
            <div className="flex items-center gap-[6px]">
              <span className="flex-1 text-[13.5px] font-bold leading-[20.925px] text-[#1c2533]">Participant journey</span>
              <span className="rounded-[999px] border-[1.25px] border-[#e3def3] bg-white px-[11px] py-[4px] text-[11px] font-semibold leading-[17.05px] text-[#1c2533]">5 stages</span>
            </div>
            <div className="relative mt-[10px] flex flex-col gap-[10.7px]">
              <span className="absolute left-[12.98px] top-[16px] h-[calc(100%-32px)] w-[1.992px] bg-gradient-to-b from-[#8a3ffc] to-[#d9d2ee]" />
              <div className="relative flex items-center gap-[12px]">
                <span className="size-[27.988px] shrink-0 rounded-[13.994px] border-[1.25px] border-[#8a3ffc] bg-[#8a3ffc] shadow-[0px_0px_0px_4px_rgba(138,63,252,0.16)]" />
                <span className="flex flex-col">
                  <span className="text-[12.5px] font-bold leading-[19.375px] text-[#1c2533]">Campaign start</span>
                  <span className="text-[12px] leading-[18.6px] text-[#6b7690]">Participants join</span>
                </span>
              </div>
              {STAGES.map((s, i) => (
                <div key={i} className="relative flex items-center gap-[12px]">
                  <span className="flex size-[27.988px] shrink-0 items-center justify-center rounded-[13.994px] border-[1.25px] border-[#8a3ffc] bg-white text-[11px] font-bold text-[#8a3ffc]">{i + 1}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-[7px] rounded-[16px] border-[1.25px] border-[#ece8f8] bg-white px-[12px] py-[9px]">
                    <span className="flex-1 truncate text-[12.5px] font-bold leading-[19.375px] text-[#1c2533]">Stage {i + 1}</span>
                    <Badge tone="amber">{s.when}</Badge>
                    {s.reward ? <Badge tone="green">{s.reward}</Badge> : <Badge tone="grey">Unrewarded</Badge>}
                  </span>
                </div>
              ))}
              <div className="relative flex items-center gap-[12px]">
                <span className="flex size-[27.988px] shrink-0 items-center justify-center rounded-[13.994px] border-[1.25px] border-[#00e1a2] bg-[#00e1a2] text-[14px] text-[#04382a]">✓</span>
                <span className="flex flex-col">
                  <span className="text-[12.5px] font-bold leading-[19.375px] text-[#1c2533]">Campaign complete</span>
                  <span className="text-[12px] leading-[18.6px] text-[#6b7690]">Journey finished</span>
                </span>
              </div>
            </div>
          </div>
        </TypeCard>

        <TypeCard
          eyebrow="Quest" eyebrowColor="#3b82f6" title="One task, one clear objective"
          text="Ask for a specific action, such as a follow, a swap or a post. Verify it automatically or by review, and award XP."
          tags={["Single task", "XP", "Auto or manual verification"]} tagTone="blue"
        >
          <div className="rounded-[20px] border-[1.25px] border-[#e8e4f6] bg-white p-[16px]">
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-semibold leading-[20.925px] text-[#1c2533]">Quests</span>
              <Pill>4 live</Pill>
            </div>
            <div className="pt-[12px]">
              {QUESTS.map(q => (
                <div key={q.label} className="flex items-center gap-[10px] border-t-[1.25px] border-[#f0edf8] py-[9px]">
                  {q.done
                    ? <span className="flex size-[20px] items-center justify-center rounded-[10px] border-[1.25px] border-[#00e1a2] bg-[#00e1a2] text-[11px] text-[#04382a]">✓</span>
                    : <span className="size-[20px] rounded-[10px] border-[1.25px] border-[#d5d0e8]" />}
                  <span className="flex-1 text-[13px] leading-[20.15px] text-[#1c2533]">{q.label}</span>
                  <span className="text-[11.5px] font-semibold leading-[17.825px] text-[#8a3ffc]">{q.xp}</span>
                </div>
              ))}
            </div>
          </div>
        </TypeCard>
      </div>
    </section>
  );
}
