import Link from "next/link";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legal";

export function CtaSection() {
  return (
    <section className="pt-[110px]">
      <div
        className="relative flex flex-col items-center overflow-hidden rounded-[48px] px-4 py-[64px] sm:px-[32px] sm:py-[84px]"
        style={{ backgroundImage: "linear-gradient(161.46deg, #1c2533 0%, #3a1e7a 60%, #8a3ffc 140%)" }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute left-[840px] top-[-204.97px] size-[382.5px] rounded-[191.25px] border-[1.25px] border-[rgba(255,255,255,0.14)] shadow-[0px_0px_0px_56px_rgba(255,255,255,0.04),0px_0px_0px_112px_rgba(255,255,255,0.02)]"
        />
        <h2 className="relative max-w-[700px] text-center text-[34px] font-semibold leading-[1.08] tracking-[-1.61px] text-white sm:text-[46px] sm:leading-[49.68px]">
          Bring your community journey into one place.
        </h2>
        <p className="relative pt-[14px] text-center text-[17px] leading-[26.35px] text-[rgba(255,255,255,0.75)]">
          Set up your Nexura Studio workspace in a few minutes.
        </p>
        <div className="relative flex justify-center gap-[12px] pt-[28px]">
          <Link href="/studio/sign-up" className="flex h-[43.984px] items-center rounded-[999px] border-[1.25px] border-[#e8e4f6] bg-white px-[22px] text-[14.5px] font-semibold text-[#1c2533]">Get started</Link>
          <Link href="/studio/sign-in" className="flex h-[43.984px] items-center rounded-[999px] border-[1.25px] border-[rgba(255,255,255,0.4)] px-[22px] text-[14.5px] font-semibold text-white">Sign in</Link>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 pb-[50px] pt-[34px] text-[13px] leading-[20.15px] text-[#5b6478]">
      <span>© 2026 Nexura.</span>
      <span>
        <a href={TERMS_URL} className="hover:text-[#8a3ffc]">Terms</a> · <a href={PRIVACY_URL} className="hover:text-[#8a3ffc]">Privacy</a> · <a href="/docs" className="hover:text-[#8a3ffc]">Docs</a>
      </span>
    </footer>
  );
}
