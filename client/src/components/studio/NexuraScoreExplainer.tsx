"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** The ⓘ next to "Nexura Score Requirement": opens a side panel explaining the score. */
export function NexuraScoreInfoButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)} aria-label="What is the Nexura score?" aria-haspopup="dialog"
        className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.25px] border-[#98a0b4] text-[11px] font-bold leading-none text-[#69728a] hover:border-[#8a3ffc] hover:text-[#8a3ffc]"
      >
        i
      </button>
      {open && <NexuraScoreExplainer onClose={() => setOpen(false)} />}
    </>
  );
}

export default function NexuraScoreExplainer({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex justify-end bg-[rgba(4,3,9,0.45)]" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside
        role="dialog" aria-modal="true" aria-labelledby="nexura-score-title"
        className="flex h-full w-full max-w-[440px] flex-col overflow-y-auto bg-white px-[24px] pb-[28px] pt-[24px] shadow-[-16px_0_40px_rgba(28,37,51,0.18)]"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="nexura-score-title" className="text-[24px] font-semibold leading-[30px] tracking-[-0.6px] text-[#1c2533]">What is the Nexura score?</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="flex size-[32px] shrink-0 items-center justify-center rounded-full border-[1.25px] border-[rgba(28,37,51,0.2)] text-[#3d485c] hover:border-[#8a3ffc] hover:text-[#8a3ffc]">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-[12px] pt-[12px] text-[14px] leading-[22px] text-[#3d485c]">
          <p>The Nexura score shows how real and active a person is on Nexura, from 0 to 100%. It combines trust signals such as their XP, streaks, the campaigns they complete, how long they have been on Nexura and the socials they have linked.</p>
          <p>Your minimum decides who can claim this campaign&apos;s token reward: only people with at least that score qualify. It keeps rewards with genuine users instead of bots and one-off accounts. XP rewards are not affected.</p>
          <p>0% lets everyone claim. The higher you set it, the fewer people qualify; the Eligible Nexura Users count shows how many qualify today.</p>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
