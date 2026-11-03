import { Pill } from "./LandingParts";
import { LessonPreview } from "./PlatformSection";

const POINTS = [
  "Create lessons that explain your project and ecosystem",
  "Add learning activities that check understanding",
  "Recognize completion with XP and progression",
];

export default function LearningSection() {
  return (
    <section id="learning" className="pt-[110px]">
      <div className="grid grid-cols-1 items-center gap-[56px] lg:grid-cols-[514fr_566fr]">
        <div className="flex flex-col">
          <p className="text-[12.5px] font-semibold uppercase leading-[19.375px] tracking-[1.5px] text-[#8a3ffc]">Teach and onboard communities</p>
          <h2 className="pt-[14px] text-[32px] font-semibold leading-[1.08] tracking-[-1.47px] text-[#1c2533] sm:text-[42px] sm:leading-[45.36px]">
            Help people understand before you ask them to act.
          </h2>
          <p className="pt-[14px] text-[17px] leading-[26.35px] text-[#5b6478]">
            Lessons are a core part of Nexura Studio, not an add-on to campaigns. Build knowledge, then invite participation.
          </p>
          <ul className="flex flex-col gap-[14px] pb-[9px] pt-[31px]">
            {POINTS.map(p => (
              <li key={p} className="flex items-start gap-[12px]">
                <img src="/studio-landing/check.svg" alt="" className="mt-px size-[20px] shrink-0" />
                <span className="text-[15.5px] leading-[23.25px] text-[#5b6478]">{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="pb-[14px]">
          <div
            className="flex flex-col gap-[12px] rounded-[40px] border-[1.25px] border-[#e8e4f6] p-[20px] sm:p-[28px]"
            style={{ backgroundImage: "linear-gradient(165.48deg, #f4f1ff 8.49%, #f2f6ff 91.51%)" }}
          >
            <LessonPreview />
            <div className="rounded-[20px] border-[1.25px] border-[#e8e4f6] bg-white p-[16px]">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold leading-[20.925px] text-[#1c2533]">Lesson progress</span>
                <Pill tone="green">4 of 14 done</Pill>
              </div>
              <div className="pt-[12px]">
                <div className="h-[5.996px] overflow-hidden rounded-[3px] bg-[#edeaf7]">
                  <div className="h-full w-[40%] rounded-[3px] bg-[#05936b]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
