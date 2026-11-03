import { SectionIntro } from "./LandingParts";

const STEPS = [
  { title: "Create", text: "Design a campaign, quest or lesson." },
  { title: "Publish", text: "Set requirements, return stages and rewards, then go live." },
  { title: "Engage", text: "Participants complete tasks and learn." },
  { title: "Verify", text: "Auto-check or review contributions." },
  { title: "Measure", text: "Track outcomes and improve." },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="pt-[110px]">
      <SectionIntro
        eyebrow="How it works"
        title="From first idea to measurable outcome."
        text="Use every step or only the ones you need. An activity does not have to live inside a campaign."
      />
      <div className="grid grid-cols-1 gap-[14px] pt-[44px] sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s, i) => (
          <div key={s.title} className={`flex flex-col border-[1.25px] border-[#e8e4f6] bg-white p-[22px] ${i === 0 ? "rounded-[50px]" : "rounded-[40px]"}`}>
            <span className="flex size-[33.984px] items-center justify-center rounded-[16.992px] bg-[#8a3ffc] text-[14px] font-semibold leading-[21.7px] text-white">{i + 1}</span>
            <h4 className="pt-[14px] text-[16px] font-semibold leading-[18.4px] tracking-[-0.56px] text-[#1c2533]">{s.title}</h4>
            <p className="pt-[6px] text-[13.5px] leading-[20.25px] text-[#5b6478]">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
