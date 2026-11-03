import { HERO_BACKGROUND, HeroIntro } from "@/components/studio/landing/LandingHero";
import { FONT } from "@/components/studio/auth/tokens";

export default function NexuraStudioPage() {
  return (
    <div
      className="flex min-h-full w-full flex-col items-center justify-center bg-[#f7f5ff] px-4 py-[60px] text-[#1c2533] sm:px-[32px]"
      style={{ fontFamily: FONT, backgroundImage: HERO_BACKGROUND }}
    >
      <HeroIntro />
    </div>
  );
}
