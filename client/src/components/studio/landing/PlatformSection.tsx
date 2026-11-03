import { GRADIENT_BAR, ModuleCard, Pill, SectionIntro, StatCard } from "./LandingParts";

const BUILDER_STEPS = [
  { n: "✓", label: "Template", state: "done" },
  { n: "✓", label: "Details", state: "done" },
  { n: "3", label: "Journey", state: "active" },
  { n: "4", label: "Rewards", state: "todo" },
  { n: "5", label: "Funding", state: "todo" },
  { n: "6", label: "Review", state: "todo" },
] as const;

const QUESTS = [
  { label: "Follow on X", xp: "+50 XP", done: true },
  { label: "Join the Discord community", xp: "+50 XP", done: true },
  { label: "Join TG channel", xp: "+120 XP", done: false },
  { label: "Relic Checker", xp: "+80 XP", done: false },
];

const ANSWERS = [
  { label: "Berachain", picked: false },
  { label: "Blockchain Technology", picked: true },
  { label: "Intuition Network", picked: false },
];

const STATS = [
  { label: "Participation", value: "1,016", note: "500 reward slots" },
  { label: "Reward utilisation", value: "52%", note: "$7,333 of $14,000 claimed" },
  { label: "Active this week", value: "420", note: "41% of participants" },
  { label: "Finished the journey", value: "150", note: "18% of participants" },
];

const STAGES = [100, 72, 55, 41, 33];

function CampaignBuilderPreview() {
  return (
    <div className="overflow-hidden rounded-[24px] border-[1.25px] border-[#e8e4f6] bg-[#f7f5ff] px-[20px] py-[18px]">
      <div className="flex h-[56.23px] items-center gap-[2px] overflow-hidden rounded-[999px] border-[1.25px] border-[#ece8f8] bg-white p-[6px]">
        {BUILDER_STEPS.map(s => (
          <span key={s.label} className={`flex min-w-0 flex-1 items-center gap-[7px] rounded-[999px] px-[8px] py-[5px] ${s.state === "active" ? "bg-[#efe8ff]" : ""}`}>
            <span
              className={`flex size-[20px] shrink-0 items-center justify-center rounded-[10px] text-[10px] font-bold ${s.state === "todo" ? "bg-[#eeeafb] text-[#6b7690]" : "text-white"} ${s.state === "active" ? "bg-[#8a3ffc]" : ""}`}
              style={s.state === "done" ? { backgroundImage: "linear-gradient(135deg, #8a3ffc 0%, #6d7bff 100%)" } : undefined}
            >
              {s.n}
            </span>
            <span className="hidden whitespace-nowrap text-[11px] font-bold leading-[17.05px] text-[#1c2533] sm:inline">{s.label}</span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-[10px] pt-[16px]">
        <span className="size-[11.992px] rounded-[5.996px] bg-[#8a3ffc] shadow-[0px_0px_0px_4px_rgba(138,63,252,0.16)]" />
        <span className="flex flex-col">
          <span className="text-[12px] font-bold leading-[18.6px] text-[#1c2533]">Campaign start</span>
          <span className="text-[10.5px] leading-[16.275px] text-[#6b7690]">Participants join and the journey begins</span>
        </span>
      </div>
      <div className="mt-[10px] flex flex-col rounded-[26px] border-[1.25px] border-[#d9d2ee] bg-white px-[20px] py-[18px]">
        <span className="text-[10px] font-bold leading-[15.5px] tracking-[1px] text-[#8a3ffc]">STAGE 1</span>
        <span className="pb-[8px] pt-[2px] text-[17px] font-semibold leading-[19.55px] tracking-[-0.595px] text-[#1c2533]">First Return</span>
        <span className="flex items-center gap-[4px]">
          <span className="rounded-[999px] bg-[rgba(138,63,252,0.12)] px-[9px] py-[2px] text-[11px] font-semibold leading-[17.05px] text-[#8a3ffc]">Retention: 1 Month</span>
          <span className="text-[11.5px] leading-[17.825px] text-[#6b7690]">· 6 activities</span>
        </span>
        <ul className="flex flex-col gap-[5px] pb-[14px] pt-[10px]">
          {["Follow the project on X", "Comment on our latest post", "Join the Discord"].map(t => (
            <li key={t} className="flex items-center gap-[9px] text-[12.5px] leading-[19.375px] text-[#3a4358]">
              <span className="size-[5px] rounded-[2.5px] bg-[#8a3ffc]" />{t}
            </li>
          ))}
        </ul>
        <span className="flex gap-[3px]">
          <span className="rounded-[999px] border-[1.25px] border-[#8a3ffc] bg-[#8a3ffc] px-[12px] py-[5px] text-[11.5px] font-semibold leading-[17.825px] text-white shadow-[0px_8px_18px_-8px_rgba(138,63,252,0.8)]">+ Add Activity</span>
          <span className="rounded-[999px] border-[1.25px] border-[#e3def3] bg-white px-[12px] py-[5px] text-[11.5px] font-semibold leading-[17.825px] text-[#1c2533]">Edit Stage</span>
        </span>
      </div>
    </div>
  );
}

function QuestsPreview() {
  return (
    <div className="rounded-[20px] border-[1.25px] border-[#e8e4f6] bg-white p-[16px]">
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-semibold leading-[20.925px] text-[#1c2533]">Quests</span>
        <Pill>4 live</Pill>
      </div>
      <div className="pt-[12px]">
        {QUESTS.map(q => (
          <div key={q.label} className="flex items-center gap-[10px] border-t-[1.25px] border-[#f0edf8] py-[9px]">
            {q.done
              ? <span className="flex size-[20px] items-center justify-center rounded-[10px] border-[1.25px] border-[#00e1a2] bg-[#00e1a2] text-[11px] leading-[17.05px] text-[#04382a]">✓</span>
              : <span className="size-[20px] rounded-[10px] border-[1.25px] border-[#d5d0e8]" />}
            <span className="flex-1 text-[13px] leading-[20.15px] text-[#1c2533]">{q.label}</span>
            <span className="text-[11.5px] font-semibold leading-[17.825px] text-[#8a3ffc]">{q.xp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LessonPreview() {
  return (
    <div className="rounded-[20px] border-[1.25px] border-[#e8e4f6] bg-white p-[16px]">
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-semibold leading-[20.925px] text-[#1c2533]">Lesson 2 of 5</span>
        <Pill tone="blue">Learning</Pill>
      </div>
      <p className="pt-[12px] text-[15px] font-semibold leading-[17.25px] tracking-[-0.525px] text-[#1c2533]">What key technology powers Web3?</p>
      <div className="flex flex-col gap-[7px] pt-[10px]">
        {ANSWERS.map(a => (
          <span key={a.label} className={`flex h-[40.625px] items-center gap-[9px] rounded-[12px] border-[1.25px] px-[12px] py-[9px] text-[13px] leading-[20.15px] text-[#1c2533] ${a.picked ? "border-[#8a3ffc] bg-[rgba(138,63,252,0.06)] font-semibold" : "border-[#e8e4f6]"}`}>
            <span className={`size-[13.984px] rounded-[6.992px] ${a.picked ? "border-[3.75px] border-[#8a3ffc]" : "border-[1.25px] border-[#cfc9e6]"}`} />
            {a.label}
          </span>
        ))}
      </div>
      <div className="pt-[14px]">
        <div className="h-[5.996px] overflow-hidden rounded-[3px] bg-[#edeaf7]">
          <div className={`h-full w-[40%] rounded-[3px] ${GRADIENT_BAR}`} />
        </div>
      </div>
    </div>
  );
}

export function AnalyticsPreview() {
  return (
    <div className="overflow-hidden rounded-[24px] border-[1.25px] border-[#e8e4f6] bg-[#f7f5ff] px-[20px] py-[18px]">
      <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-4">
        {STATS.map(s => <StatCard key={s.label} {...s} />)}
      </div>
      <div className="mt-[16px] rounded-[20px] border-[1.25px] border-[#e8e4f6] bg-white p-[16px]">
        <div className="flex items-center justify-between">
          <span className="text-[13.5px] font-semibold leading-[20.925px] text-[#1c2533]">Completion by stage</span>
          <Pill tone="grey">Sample data</Pill>
        </div>
        <div className="flex flex-col gap-[9px] pt-[12px]">
          {STAGES.map((pct, i) => (
            <div key={i} className="grid grid-cols-[54px_1fr_38px] items-center gap-[10px]">
              <span className="text-[12px] leading-[18.6px] text-[#5b6478]">Stage {i + 1}</span>
              <span className="h-[8.984px] overflow-hidden rounded-[3px] bg-[#edeaf7]">
                <span className={`block h-full rounded-[3px] ${GRADIENT_BAR}`} style={{ width: `${pct}%` }} />
              </span>
              <span className="text-right text-[12px] font-semibold leading-[18.6px] text-[#1c2533]">{pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PlatformSection() {
  return (
    <section id="platform" className="pt-[110px]">
      <SectionIntro
        eyebrow="The platform at a glance"
        title="Several connected modules. One engagement hub."
        text="Use the parts you need. Each solves a different problem, and they work together."
      />
      <div className="grid grid-cols-1 gap-[16px] pt-[44px] lg:grid-cols-[656fr_464fr]">
        <ModuleCard
          icon="mod-campaigns.svg" title="Campaigns"
          text="Run structured, multi-stage engagement with deadlines, return periods and stage rewards, so participation lasts beyond day one."
          style={{ backgroundImage: "linear-gradient(162deg, #ffffff 8.49%, #f4f1ff 91.51%)" }}
        >
          <CampaignBuilderPreview />
        </ModuleCard>
        <ModuleCard icon="mod-quests.svg" title="Quests" text="Define individual tasks people complete to show participation, earn XP and qualify for rewards.">
          <QuestsPreview />
        </ModuleCard>
      </div>
      <div className="grid grid-cols-1 gap-[16px] pt-[16px] lg:grid-cols-[464fr_656fr]">
        <ModuleCard
          icon="mod-learning.svg" title="Learning and lessons"
          text="Teach your community how your project works with learning activities that build real understanding."
          style={{ backgroundImage: "linear-gradient(156.42deg, #ffffff 8.49%, #f2f6ff 91.51%)" }}
        >
          <LessonPreview />
        </ModuleCard>
        <ModuleCard icon="mod-analytics.svg" title="Dashboard and analytics" text="See participation, completion, retention and reward distribution in one place.">
          <AnalyticsPreview />
        </ModuleCard>
      </div>
      <div className="grid grid-cols-1 gap-[16px] pt-[16px] md:grid-cols-3">
        <ModuleCard icon="mod-submissions.svg" title="Submissions" text="Review manual proof and verification results without chasing screenshots." />
        <ModuleCard icon="mod-admin.svg" title="Admin management" text="Control who can do what with roles, permissions and approval proposals." />
        <ModuleCard icon="mod-rewards.svg" title="Rewards and reputation" text="XP, reward eligibility and claims that follow how contributors progress." />
      </div>
    </section>
  );
}
