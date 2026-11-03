"use client";

import { useEffect, useRef, useState } from "react";
import { CheckMark, POPOVER } from "@/components/admin/CreateNewCampaign";

export type DropdownOption = { value: string; label: string };

/**
 * Pill select whose menu matches the Create Campaign dropdowns:
 * white popover, light-violet selected row, violet check mark.
 */
export default function StudioDropdown({ value, options, onChange, ariaLabel, disabled, height = 40 }: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  height?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <button
        type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", height, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          padding: "0 14px", background: "#f4f1fc", borderRadius: 52, fontFamily: "inherit", fontSize: 13, color: "#1c2533",
          border: open ? "1px solid #8b3efe" : "1px solid rgba(28,37,51,0.15)",
          boxShadow: open ? "0 0 0 3px rgba(138,63,252,0.1)" : "none",
          cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, textAlign: "left",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current?.label ?? ""}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M4 6L8 10L12 6" stroke="#8B889E" strokeWidth="1.33333" />
        </svg>
      </button>
      {open && (
        <div role="listbox" aria-label={ariaLabel} style={{ ...POPOVER, left: 0, width: "100%", minWidth: 160, maxHeight: 280, overflowY: "auto", borderRadius: 16, padding: 5 }}>
          {options.map(o => {
            const sel = o.value === value;
            return (
              <button
                key={o.value} type="button" role="option" aria-selected={sel}
                onMouseDown={e => { e.preventDefault(); onChange(o.value); setOpen(false); }}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(o.value); setOpen(false); } }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#f7f4fe"; }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderRadius: 10, border: "none", background: sel ? "rgba(138,63,252,0.08)" : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
              >
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: sel ? 600 : 500, color: "#1c2533", whiteSpace: "nowrap" }}>{o.label}</span>
                {sel && <CheckMark />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
