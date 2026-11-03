import type { ReactNode } from "react";

export function SectionIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <>
      <p className="text-[12.5px] font-semibold uppercase leading-[19.375px] tracking-[1.5px] text-[#8a3ffc]">{eyebrow}</p>
      <h2 className="max-w-[760px] pt-[14px] text-[34px] font-semibold leading-[1.07] tracking-[-1.61px] text-[#1c2533] sm:text-[46px] sm:leading-[49.22px]">{title}</h2>
      <p className="max-w-[620px] pt-[16px] text-[18px] leading-[27.9px] text-[#5b6478]">{text}</p>
    </>
  );
}

export function ModuleCard({ icon, title, text, children, className = "", style }: {
  icon: string; title: string; text: string; children?: ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div className={`flex flex-col gap-[18px] rounded-[40px] border-[1.25px] border-[#e8e4f6] bg-white p-[24px] sm:p-[30px] ${className}`} style={style}>
      <div className="flex flex-col">
        <span className="flex size-[40px] items-center justify-center rounded-[12px] bg-[rgba(138,63,252,0.1)]">
          <img src={`/studio-landing/${icon}`} alt="" className="size-[20px]" />
        </span>
        <h3 className="pt-[14px] text-[22px] font-semibold leading-[25.3px] tracking-[-0.77px] text-[#1c2533]">{title}</h3>
        <p className="pt-[6px] text-[15px] leading-[23.25px] text-[#5b6478]">{text}</p>
      </div>
      {children}
    </div>
  );
}

export const Pill = ({ children, tone = "purple" }: { children: ReactNode; tone?: "purple" | "blue" | "grey" | "green" }) => {
  const cls = {
    purple: "bg-[rgba(138,63,252,0.12)] text-[#8a3ffc]",
    blue: "bg-[rgba(59,130,246,0.13)] text-[#2563eb]",
    grey: "bg-[#eef0f6] text-[#5b6478]",
    green: "bg-[rgba(0,225,162,0.16)] text-[#05936b]",
  }[tone];
  return <span className={`rounded-[999px] px-[9px] py-[3px] text-[11px] font-semibold leading-[17.05px] ${cls}`}>{children}</span>;
};

export function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-[4px] rounded-[20px] border-[1.25px] border-[#ece8f8] bg-white px-[14px] py-[13px]">
      <span className="text-[11px] leading-[17.05px] text-[#6b7690]">{label}</span>
      <span className="pb-px pt-[3px] text-[22px] font-semibold tracking-[-0.44px] text-[#1c2533]">{value}</span>
      <span className="text-[10.5px] leading-[16.275px] text-[#6b7690]">{note}</span>
    </div>
  );
}

export const GRADIENT_BAR = "bg-gradient-to-r from-[#8a3ffc] to-[#3b82f6]";
