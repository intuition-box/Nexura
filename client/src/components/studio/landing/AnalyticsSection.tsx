import { AnalyticsPreview } from "./PlatformSection";

const POINTS = [
  "Participation and completion, stage by stage",
  "Retention across the whole journey",
  "Reward distribution and contributor progression",
];

export default function AnalyticsSection() {
  return (
    <section id="analytics" className="pt-[110px]">
      <div className="grid grid-cols-1 items-center gap-[56px] lg:grid-cols-[566fr_514fr]">
        <div className="order-2 pb-[14px] lg:order-1">
          <div className="rounded-[40px] border-[1.25px] border-[#e8e4f6] p-[20px] sm:p-[28px]" style={{ backgroundImage: "linear-gradient(164deg, #f4f1ff 8.49%, #f2f6ff 91.51%)" }}>
            <AnalyticsPreview />
          </div>
        </div>
        <div className="order-1 flex flex-col lg:order-2">
          <p className="text-[12.5px] font-semibold uppercase leading-[19.375px] tracking-[1.5px] text-[#8a3ffc]">Measure outcomes</p>
          <h2 className="pt-[14px] text-[32px] font-semibold leading-[1.08] tracking-[-1.47px] text-[#1c2533] sm:text-[42px] sm:leading-[45.36px]">
            See what is working, and where people drop off.
          </h2>
          <ul className="flex flex-col gap-[14px] pb-[9px] pt-[31px]">
            {POINTS.map(p => (
              <li key={p} className="flex items-start gap-[12px]">
                <img src="/studio-landing/check.svg" alt="" className="mt-px size-[20px] shrink-0" />
                <span className="text-[15.5px] leading-[23.25px] text-[#5b6478]">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
