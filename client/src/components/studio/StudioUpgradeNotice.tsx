import Link from "next/link";

/** Shown on the main app while Nexura Studio is being upgraded, in the main app's own look. */
export default function StudioUpgradeNotice() {
  return (
    <div className="flex min-h-full w-full items-center justify-center px-4 py-[80px]">
      <div className="flex max-w-[560px] flex-col items-center text-center">
        <span className="flex items-center gap-[8px] rounded-full border border-white/15 bg-white/[0.06] px-[14px] py-[6px] backdrop-blur-xl">
          <span className="size-[7px] rounded-full bg-[#f59e0b]" />
          <span className="text-[13px] font-semibold text-white/90">Nexura Studio · Coming soon</span>
        </span>
        <h1 className="pt-[18px] text-[30px] font-semibold leading-[1.15] tracking-[-0.8px] text-white sm:text-[40px]">Nexura Studio is getting an upgrade</h1>
        <p className="pt-[12px] text-[15px] leading-[24px] text-white/70">We&apos;re rebuilding Nexura Studio. It will be back soon.</p>
        <Link href="/" className="mt-[24px] flex h-[44px] items-center rounded-full bg-[#8b3efe] px-[22px] text-[14.5px] font-semibold text-white hover:bg-[#7b35e6]">
          Back to Nexura
        </Link>
      </div>
    </div>
  );
}
