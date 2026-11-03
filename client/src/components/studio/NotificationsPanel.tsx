"use client";

import { useState } from "react";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import type { Proposal } from "@/lib/adminGovernance";
import { noticeParts, type ProjectNotice } from "./useProjectNotifications";
import ActivityFeed, { type FeedItem } from "./ActivityFeed";

type Props = {
  items: Proposal[];
  notices?: ProjectNotice[];
  unread: number;
  onOpen: (p: Proposal) => void;
  onOpenNotice?: (n: ProjectNotice) => void;
  onMarkRead: (refs?: string[]) => void;
  onMarkNoticesRead?: (ids?: string[]) => void;
  onViewAll: () => void;
  onViewChanges?: () => void;
};

/** Dropdown under the header bell: proposals waiting for my signature and project settings changes, with read state. */
export default function NotificationsPanel({ items, notices = [], unread, onOpen, onOpenNotice, onMarkRead, onMarkNoticesRead, onViewAll, onViewChanges }: Props) {
  const [tab, setTab] = useState<"unread" | "all">(unread > 0 ? "unread" : "all");
  const entries: FeedItem[] = [
    ...items.map(p => ({
      id: p.id, read: !!p.readByMe, at: p.createdAt, category: "proposal" as const, status: "pending" as const,
      who: `@${p.proposedBy.name}`, parts: ["proposed ", { value: p.title }, " and needs your signature"],
      onOpen: () => { if (!p.readByMe) onMarkRead([p.id]); onOpen(p); }, onMarkRead: () => onMarkRead([p.id]),
    })),
    ...notices.map(n => {
      const d = noticeParts(n);
      return {
        id: n.id, read: n.readByMe, at: n.createdAt, category: n.kind === "campaign" ? "campaign" as const : n.kind === "username" ? "team" as const : "settings" as const, who: d.who, parts: d.parts,
        onOpen: () => { if (!n.readByMe) onMarkNoticesRead?.([n.id]); onOpenNotice?.(n); }, onMarkRead: () => onMarkNoticesRead?.([n.id]),
      };
    }),
  ];
  const shown = tab === "unread" ? entries.filter(e => !e.read) : entries;

  return (
    <div role="dialog" aria-label="Notifications"
      className="absolute right-0 top-[calc(100%+10px)] z-[200] flex w-[400px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[24px] border border-[rgba(28,37,51,0.09)] bg-white shadow-[0_18px_44px_rgba(28,37,51,0.18)]">
      <div className="flex items-center justify-between gap-3 px-[18px] pb-[12px] pt-[16px]">
        <span className="text-[16px] font-semibold text-[#1c2533]">Notifications</span>
        {unread > 0 && (
          <button
            onClick={() => { onMarkRead(); onMarkNoticesRead?.(); }}
            className="inline-flex items-center gap-[6px] rounded-[999px] bg-[rgba(138,63,252,0.1)] px-[12px] py-[6px] text-[12.5px] font-semibold text-[#6e2bd8] hover:bg-[rgba(138,63,252,0.16)]"
          >
            <CheckCheck className="size-[15px]" />Mark all as read
          </button>
        )}
      </div>

      <div className="mx-[18px] mb-[6px] flex rounded-[999px] bg-[#f4f1fc] p-[3px]">
        {([["unread", `Unread${unread ? ` · ${unread}` : ""}`], ["all", "All"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-[999px] py-[6px] text-[12.5px] font-semibold transition ${tab === t ? "bg-white text-[#1c2533] shadow-[0_1px_4px_rgba(28,37,51,0.12)]" : "text-[#69728a] hover:text-[#1c2533]"}`}>
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <span className="grid size-[44px] place-items-center rounded-full bg-[#f7f4fe] text-[#8a3ffc]"><Bell className="size-[20px]" /></span>
          <span className="text-[14px] font-semibold text-[#1c2533]">You&apos;re all caught up</span>
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto bg-white px-[6px] pb-[8px]">
          <ActivityFeed items={shown} compact />
        </div>
      )}

      {(items.length > 0 || (notices.length > 0 && onViewChanges)) && (
        <div className="flex border-t border-[rgba(28,37,51,0.08)]">
          {items.length > 0 && (
            <button onClick={onViewAll} className="flex flex-1 items-center justify-center gap-1 py-[12px] text-[13px] font-semibold text-[#6e2bd8] hover:bg-[#faf8ff]">
              View all proposals<ChevronRight className="size-[16px]" />
            </button>
          )}
          {notices.length > 0 && onViewChanges && (
            <button onClick={onViewChanges} className="flex flex-1 items-center justify-center gap-1 border-l border-[rgba(28,37,51,0.08)] py-[12px] text-[13px] font-semibold text-[#6e2bd8] first:border-l-0 hover:bg-[#faf8ff]">
              Hub activity<ChevronRight className="size-[16px]" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
