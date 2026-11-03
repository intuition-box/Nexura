"use client";

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";

export const MUTED = "#69728a";

export function PanelTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[20px] font-semibold leading-[23px] tracking-[-0.4px] text-[#1c2533]">{children}</h3>;
}

export function Card({ title, text, id, children }: { title?: string; text?: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex w-full scroll-mt-[20px] flex-col items-start rounded-[40px] border-[1.25px] border-[rgba(28,37,51,0.09)] bg-white px-[20px] py-[28px] md:px-[32px]">
      {title && <h3 className="text-[18px] font-semibold leading-[20.7px] tracking-[-0.36px] text-[#1c2533]">{title}</h3>}
      {text && <p className="pt-[4px] text-[13px] leading-[20.15px] text-[#69728a]">{text}</p>}
      {children}
    </section>
  );
}

export function Row({ title, text, children, last = false, align = "center", below }: {
  title: string; text: string; children?: ReactNode; last?: boolean; align?: "center" | "start";
  /** Content shown full width under the title (long values such as a description). */
  below?: ReactNode;
}) {
  if (below !== undefined) {
    return (
      <div className={`flex w-full flex-col gap-[12px] py-[20px] ${last ? "" : "border-b-[1.25px] border-[rgba(28,37,51,0.09)]"}`}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 flex-col">
            <span className="pb-[3px] text-[14.5px] font-semibold leading-[22.475px] text-[#1c2533]">{title}</span>
            <span className="text-[12.5px] leading-[19.375px] text-[#69728a]">{text}</span>
          </div>
          {children && <div className="flex shrink-0 items-center gap-[12px]">{children}</div>}
        </div>
        <div className="w-full text-[14px] leading-[21.7px] text-[#1c2533] [overflow-wrap:anywhere]">{below}</div>
      </div>
    );
  }
  return (
    <div className={`flex w-full flex-col gap-3 py-[20px] sm:flex-row sm:justify-between sm:gap-6 ${align === "center" ? "sm:items-center" : "sm:items-start"} ${last ? "" : "border-b-[1.25px] border-[rgba(28,37,51,0.09)]"}`}>
      <div className="flex min-w-0 flex-col sm:w-[40%] sm:max-w-[400px] sm:shrink-0">
        <span className="pb-[3px] text-[14.5px] font-semibold leading-[22.475px] text-[#1c2533]">{title}</span>
        <span className="text-[12.5px] leading-[19.375px] text-[#69728a]">{text}</span>
      </div>
      {children && <div className="flex min-w-0 flex-1 items-center justify-between gap-[12px] sm:justify-end">{children}</div>}
    </div>
  );
}

export function Value({ children }: { children: ReactNode }) {
  return <span className="min-w-0 flex-1 break-words text-left text-[14px] leading-[21.7px] text-[#1c2533] [overflow-wrap:anywhere] sm:text-right">{children}</span>;
}

export function StatusPill({ tone, children }: { tone: "green" | "grey" | "purple"; children: ReactNode }) {
  if (tone === "purple") {
    return <span className="shrink-0 rounded-[20px] border-[1.25px] border-[rgba(138,63,252,0.28)] bg-[rgba(138,63,252,0.1)] px-[9px] py-[3px] text-[12px] font-semibold leading-[16.8px] text-[#6e2bd8]">{children}</span>;
  }
  const green = tone === "green";
  return (
    <span className={`flex shrink-0 items-center gap-[6px] rounded-[20px] border-[1.25px] px-[9px] py-[3px] ${green ? "border-[rgba(0,168,124,0.3)] bg-[rgba(0,225,162,0.16)]" : "border-[rgba(28,37,51,0.15)] bg-[#f7f4fe]"}`}>
      <span className={`size-[6.992px] rounded-[3.496px] ${green ? "bg-[#00a87c]" : "bg-[#69728a]"}`} />
      <span className={`text-[12px] font-semibold leading-[16.8px] ${green ? "text-[#00a87c]" : "text-[#3d485c]"}`}>{children}</span>
    </span>
  );
}

export function SmallButton({ variant = "primary", className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" }) {
  const cls = variant === "primary"
    ? "border-[#8a3ffc] bg-[#8a3ffc] text-white"
    : "border-[rgba(28,37,51,0.15)] bg-white text-[#1c2533]";
  return (
    <button type="button" {...props} className={`flex h-[35.996px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[999px] border-[1.25px] px-[16px] text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${cls} ${className}`}>
      {children}
    </button>
  );
}

export function Dialog({ open, onClose, children, labelledBy }: { open: boolean; onClose: () => void; children: ReactNode; labelledBy: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(4,3,9,0.7)] p-[20px] backdrop-blur-[4px]" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="flex w-full max-w-[480px] flex-col rounded-[40px] border-[1.25px] border-[rgba(28,37,51,0.15)] bg-white drop-shadow-[0px_22px_25px_rgba(28,37,51,0.28)]">
        {children}
      </div>
    </div>
  );
}

export function DialogActions({ onCancel, confirmLabel, busy, disabled }: { onCancel: () => void; confirmLabel: string; busy?: boolean; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-[10px] px-[24px] pb-[22px] pt-[16px]">
      <button type="button" onClick={onCancel} className="flex min-h-[40px] items-center justify-center rounded-[40px] border-[1.25px] border-[rgba(28,37,51,0.15)] bg-[#f7f4fe] px-[16px] py-[10px] text-[14px] font-semibold text-[#1c2533]">
        Cancel
      </button>
      <button type="submit" disabled={busy || disabled} className="flex min-h-[40px] items-center justify-center rounded-[40px] border-[1.25px] border-transparent bg-gradient-to-b from-[#8a3ffc] to-[#6e2bd8] px-[16px] py-[10px] text-[14px] font-semibold text-white drop-shadow-[0px_8px_11px_rgba(138,63,252,0.65)] disabled:opacity-60">
        {busy ? "Please wait…" : confirmLabel}
      </button>
    </div>
  );
}

export const maskEmail = (email: string) => {
  const [user, domain] = email.split("@");
  return user && domain ? `${user[0]}***@${domain}` : email;
};
