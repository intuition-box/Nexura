"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import StudioHeader from "../StudioHeader";

import { FONT } from "./tokens";
export { FONT };
export const INK = "#1c2533";
export const MUTED = "#5b6478";
export const PURPLE = "#8a3ffc";

export const shortAddress = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export type StepState = "done" | "active" | "todo";

const SIGN_IN_STEPS = [
  { title: "Account", desc: "Your registered email or username and password" },
];

const STEPS = [
  { title: "Account", desc: "Username, email and password" },
  { title: "Verify", desc: "Confirm your email with a code" },
  { title: "Project", desc: "Tell us about your project" },
];

export function AuthHeader({ title }: { title?: string } = {}) {
  return <StudioHeader title={title} showLogo={!title} />;
}

function StepBadge({ state, n }: { state: StepState; n: number }) {
  const cls =
    state === "done" ? "border-[#00e1a2] bg-[#00e1a2] text-white"
    : state === "active" ? "border-white bg-white text-[#3a1e7a]"
    : "border-[rgba(255,255,255,0.3)] text-[rgba(255,255,255,0.7)]";
  return (
    <span className={`flex size-[31.992px] shrink-0 items-center justify-center rounded-[15.996px] border-[1.25px] text-[13px] font-semibold leading-[20.15px] ${cls}`}>
      {state === "done" ? "✓" : n}
    </span>
  );
}

export function AuthSidebar({ steps, signIn = false }: { steps: StepState[]; signIn?: boolean }) {
  const items = signIn ? SIGN_IN_STEPS : STEPS;
  return (
    <aside
      className="relative hidden w-[462px] shrink-0 flex-col overflow-hidden px-[44px] py-[36px] lg:flex"
      style={{ backgroundImage: "linear-gradient(155.09deg, rgb(28, 37, 51) 8.49%, rgb(58, 30, 122) 59.96%, rgb(138, 63, 252) 133.03%)" }}
    >
      <div className="flex flex-1 flex-col justify-end">
        <h2 className="max-w-[420px] pb-[10px] text-[30px] font-semibold leading-[34px] tracking-[-1.05px] text-white">
          {signIn ? "Welcome back to your studio." : "Set up your hub in three steps."}
        </h2>
      </div>
      <p className="max-w-[360px] pb-[28px] text-[14px] leading-[21.5px] text-[rgba(255,255,255,0.72)]">
        {signIn
          ? "Connect the wallet linked to your studio from the top bar, then sign in."
          : "Your wallet connects from the top bar. Create your account, verify your email and add your project details."}
      </p>
      <ol className="flex flex-1 flex-col">
        {items.map((s, i) => {
          const state = steps[i]!;
          const strong = state !== "todo";
          return (
            <li key={s.title} className="relative flex h-[71.934px] gap-[14px] pb-[22px]">
              <StepBadge state={state} n={i + 1} />
              <div className="flex w-[185px] flex-col">
                <span className={`pt-[5px] text-[15px] font-semibold leading-[23.25px] ${strong ? "text-white" : "text-[rgba(255,255,255,0.7)]"}`}>{s.title}</span>
                <span className="text-[13px] leading-[20.15px] text-[rgba(255,255,255,0.65)]">{s.desc}</span>
              </div>
              {i < items.length - 1 && <span className="absolute left-[15px] top-[33.98px] h-[35.938px] w-[1.992px] bg-[rgba(255,255,255,0.18)]" />}
            </li>
          );
        })}
      </ol>
      <div className="h-[120px] shrink-0" />
      <span
        aria-hidden
        className="pointer-events-none absolute left-[297px] top-[-140px] size-[382.5px] rounded-[191.25px] border-[1.25px] border-[rgba(255,255,255,0.14)] shadow-[0px_0px_0px_56px_rgba(255,255,255,0.04),0px_0px_0px_112px_rgba(255,255,255,0.02)]"
      />
    </aside>
  );
}

export function AuthTopRow({ onBack, account = "signin" }: { onBack?: () => void; account?: "signin" | "signup" }) {
  return (
    <div className="flex w-full max-w-[772px] items-center justify-between">
      <button
        type="button" onClick={onBack ?? (() => history.back())}
        className="flex h-[37.988px] items-center gap-[8px] rounded-[999px] border-[1.25px] border-transparent px-[16px] text-[13.5px] font-semibold text-[#5b6478]"
      >
        <img src="/studio-auth/arrow-left.svg" alt="" className="size-[15.996px]" />
        Back
      </button>
      <p className="text-[14px] leading-[21.7px] text-[#5b6478]">
        {account === "signin" ? "Already have an account? " : "New to Nexura Studio? "}
        <Link href={account === "signin" ? "/studio/sign-in" : "/studio/sign-up"} className="font-semibold text-[#8a3ffc]">
          {account === "signin" ? "Sign in" : "Create account"}
        </Link>
      </p>
    </div>
  );
}

/** Header, purple steps panel and the right-hand content area shared by sign up, sign in and reset. */
export default function AuthShell({ steps, children, onBack, account }: {
  steps: StepState[];
  children: ReactNode;
  onBack?: () => void;
  account?: "signin" | "signup";
}) {
  return (
    <div className="min-h-screen bg-[#f7f5ff] text-[#1c2533]" style={{ fontFamily: FONT }}>
      <AuthHeader />
      <div className="flex min-h-[calc(100vh-60px)]">
        <AuthSidebar steps={steps} signIn={account === "signup"} />
        <main className="flex flex-1 flex-col items-center px-4 pb-[24px] pt-[14px] sm:px-[15px] lg:pr-[36px]">
          <AuthTopRow onBack={onBack} account={account} />
          <div className="flex w-full flex-1 flex-col items-center">{children}</div>
        </main>
      </div>
    </div>
  );
}
