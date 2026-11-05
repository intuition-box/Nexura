import Link from "next/link";

/** Shown on the main app while Nexura Studio is being upgraded. */
export default function StudioUpgradeNotice({ compact = false }: { compact?: boolean }) {
  const body = (
    <div className="flex max-w-[560px] flex-col items-center text-center">
      <span className="flex items-center gap-[8px] rounded-full border-[1.25px] border-[#e8e4f6] bg-white px-[14px] py-[6px]">
        <span className="size-[7px] rounded-full bg-[#f59e0b]" />
        <span className="text-[13px] font-semibold text-[#8a3ffc]">Nexura Studio · Coming soon</span>
      </span>
      <h1 className="pt-[18px] text-[30px] font-semibold leading-[1.15] tracking-[-0.8px] text-[#1c2533] sm:text-[40px]">Nexura Studio is getting an upgrade</h1>
      <p className="pt-[12px] text-[15px] leading-[24px] text-[#5b6478]">
        We&apos;re rebuilding Studio with co-hosted campaigns, a campaign simulator and a better way to review submissions. It will be back soon.
      </p>
      <Link href="/" className="mt-[24px] flex h-[44px] items-center rounded-full bg-[#8b3efe] px-[22px] text-[14.5px] font-semibold text-white hover:bg-[#7b35e6]">
        Back to Nexura
      </Link>
    </div>
  );
  if (compact) return body;
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f7f5ff] px-4 py-[60px]" style={{ fontFamily: "'Geist', 'Inter', sans-serif" }}>
      {body}
    </div>
  );
}
