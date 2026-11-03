"use client";

import { Check } from "lucide-react";
import type { NoticePart } from "./useProjectNotifications";

export type FeedCategory = "settings" | "team" | "proposal" | "campaign";

export type FeedItem = {
  id: string;
  who: string;
  parts: NoticePart[];
  at: string;
  category: FeedCategory;
  status?: "pending" | "approved" | "executed" | "rejected";
  read?: boolean;
  onOpen?: () => void;
  onMarkRead?: () => void;
};

export const CATEGORY_LABEL: Record<FeedCategory, string> = {
  settings: "Project settings", team: "Username changes", proposal: "Proposals", campaign: "Campaigns",
};

const STATUS = {
  pending: "border-[rgba(194,124,0,0.26)] bg-[rgba(245,158,11,0.12)] text-[#b06f00]",
  approved: "border-[rgba(0,168,124,0.3)] bg-[rgba(0,225,162,0.14)] text-[#00a87c]",
  executed: "border-[rgba(0,168,124,0.3)] bg-[rgba(0,225,162,0.14)] text-[#00a87c]",
  rejected: "border-[rgba(228,84,91,0.3)] bg-[rgba(228,84,91,0.1)] text-[#e4545b]",
};

const fullDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
};

function Sentence({ who, parts }: { who: string; parts: NoticePart[] }) {
  return (
    <>
      <span className="font-semibold text-[#1c2533]">{who}</span>{" "}
      {parts.map((p, i) => typeof p === "string" ? <span key={i}>{p}</span>
        : p.href ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="font-semibold text-[#8a3ffc] underline decoration-[rgba(138,63,252,0.35)] underline-offset-2 hover:decoration-[#8a3ffc]">{p.value}</a>
        ) : <span key={i} className="font-semibold text-[#1c2533]">{p.value}</span>)}
    </>
  );
}

export default function ActivityFeed({ items, compact = false }: { items: FeedItem[]; compact?: boolean }) {
  const sorted = [...items].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return (
    <ul className="flex flex-col">
      {sorted.map((it, i) => {
        const unread = it.read === false;
        return (
          <li
            key={it.id}
            className={`flex items-start gap-[12px] ${compact ? "rounded-[16px] px-[12px] py-[12px]" : "py-[16px]"} ${!compact && i < sorted.length - 1 ? "border-b-[0.833px] border-[rgba(28,37,51,0.09)]" : ""} ${unread ? "bg-[rgba(138,63,252,0.05)]" : ""}`}
          >
            <span
              className="flex size-[34px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
              style={{ backgroundImage: "linear-gradient(120deg, #9b7cff 0%, #7c5cfc 45%, #5aa8ff 100%)" }}
            >
              {it.who.replace(/^@/, "")[0]?.toUpperCase() ?? "?"}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
              <p
                onClick={it.onOpen} role={it.onOpen ? "button" : undefined}
                className={`text-[14px] leading-[21px] text-[#4b5468] [overflow-wrap:anywhere] ${it.onOpen ? "cursor-pointer" : ""} ${compact ? "line-clamp-3" : ""}`}
              >
                <Sentence who={it.who} parts={it.parts} />
              </p>
              <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[4px] text-[12.5px] leading-[18px] text-[#8a8fa3]">
                <time dateTime={it.at}>{fullDate(it.at)}</time>
                <span aria-hidden>·</span>
                <span>{CATEGORY_LABEL[it.category]}</span>
                {it.status && <span className={`rounded-[999px] border-[1px] px-[8px] text-[11.5px] font-semibold capitalize leading-[18px] ${STATUS[it.status]}`}>{it.status}</span>}
                {unread && it.onMarkRead && (
                  <button type="button" onClick={it.onMarkRead} className="ml-auto inline-flex items-center gap-[4px] rounded-[999px] px-[8px] py-[2px] font-semibold text-[#6e2bd8] hover:bg-[rgba(138,63,252,0.1)]">
                    <Check className="size-[13px]" />Mark as read
                  </button>
                )}
              </div>
            </div>
            {unread && <span aria-hidden className="mt-[7px] size-[8px] shrink-0 rounded-full bg-[#8a3ffc]" />}
          </li>
        );
      })}
    </ul>
  );
}
