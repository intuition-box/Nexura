"use client";

/** Shown instead of notifications or the wallet once the studio session has expired. */
export default function SignInPrompt({ what, onSignIn }: { what: string; onSignIn: () => void }) {
  return (
    <div role="dialog" aria-label="Sign in required"
      className="absolute right-0 top-[calc(100%+10px)] z-[200] w-[320px] max-w-[calc(100vw-24px)] rounded-2xl border border-[rgba(28,37,51,0.09)] bg-white p-5 text-center shadow-[0_16px_40px_rgba(28,37,51,0.16)]">
      <span className="text-[15px] font-semibold text-[#1c2533]">You&apos;re not signed in</span>
      <p className="mt-1.5 text-[12.5px] leading-[18px] text-[#69728a]">Your session has expired. Sign in again to {what}.</p>
      <button onClick={onSignIn}
        className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-[#8b3efe] px-5 text-[13px] font-semibold text-white hover:bg-[#7a28e8]">
        Sign in
      </button>
    </div>
  );
}
