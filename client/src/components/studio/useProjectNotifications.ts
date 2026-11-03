"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PROJECT_SESSION_EVENT, getStoredProjectToken, isProjectSessionActive, projectApiRequest } from "@/lib/projectApi";

const POLL_MS = 30_000;

export type ChangeDetail = { field: string; from?: string; to?: string };

export type ProjectNotice = {
  id: string; kind: "project" | "username" | "campaign"; actorName: string; changes: string[]; details?: ChangeDetail[]; tab: "project" | "accounts";
  createdAt: string; readByMe: boolean;
};

/** Event fired after this tab saves project settings, so the bell refreshes straight away. */
export const PROJECT_SETTINGS_EVENT = "nexura-project-settings-changed";

/** Notices that another Owner/Super Admin changed the project settings (they don't go through proposals). */
export function useProjectNotifications() {
  const [items, setItems] = useState<ProjectNotice[]>([]);
  const unavailable = useRef(false);

  const refresh = useCallback(async () => {
    if (!getStoredProjectToken() || unavailable.current) return;
    if (!isProjectSessionActive()) { setItems([]); return; }
    try {
      const res = await projectApiRequest<{ items: ProjectNotice[] }>({ method: "GET", endpoint: "/hub/notifications" });
      setItems(res.items ?? []);
    } catch (err) {
      // An API without this endpoint yet: stop asking
      if ((err as { status?: number })?.status === 404) { unavailable.current = true; setItems([]); }
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onChange = () => { refresh(); };
    const onFocus = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener(PROJECT_SESSION_EVENT, onChange);
    window.addEventListener(PROJECT_SETTINGS_EVENT, onChange);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener(PROJECT_SESSION_EVENT, onChange);
      window.removeEventListener(PROJECT_SETTINGS_EVENT, onChange);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const markRead = useCallback(async (ids?: string[]) => {
    const target = ids ? new Set(ids) : null;
    setItems(prev => prev.map(n => (!target || target.has(n.id) ? { ...n, readByMe: true } : n)));
    try { await projectApiRequest({ method: "POST", endpoint: "/hub/notifications/read", data: ids ? { ids } : {} }); }
    catch { refresh(); }
  }, [refresh]);

  return { items, unread: items.filter(n => !n.readByMe).length, markRead };
}


export type NoticePart = string | { value: string; href?: string };

const v = (value: string, href?: string): NoticePart => ({ value, href });
const link = (url: string) => v(url.replace(/^https?:\/\//, "").replace(/\/$/, ""), url);
const handle = (s: string) => `@${s.replace(/^@/, "")}`;

function fromTo(noun: string, from: string | undefined, to: string | undefined, show: (s: string) => NoticePart): NoticePart[] {
  if (from && to) return [`updated the ${noun} from `, show(from), " to ", show(to)];
  if (to) return [`added the ${noun} `, show(to)];
  if (from) return [`removed the ${noun} `, show(from)];
  return [`updated the ${noun}`];
}

function detailParts({ field, from, to }: ChangeDetail): NoticePart[] {
  switch (field) {
    case "name": return fromTo("project name", from, to, s => v(s));
    case "website": return fromTo("website", from, to, link);
    case "categories": return fromTo("tags", from, to, s => v(s));
    case "description": return [to ? "updated the description" : "removed the description"];
    case "logo": return ["updated the project picture"];
    case "document": return ["updated the project document"];
    case "xAccount": return to ? ["linked the X account ", v(handle(to))] : ["unlinked the X account ", ...(from ? [v(handle(from))] : [])];
    case "discord": return to ? ["connected the Discord server ", v(to)] : ["disconnected Discord"];
    case "telegram": return to ? ["connected Telegram ", v(to)] : ["disconnected Telegram"];
    default: return [`updated the ${field}`];
  }
}

const joinParts = (lists: NoticePart[][]): NoticePart[] =>
  lists.flatMap((l, i) => [...(i === 0 ? [] : [i === lists.length - 1 ? " and " : ", "]), ...l]);

export function noticeParts(n: ProjectNotice): { who: string; parts: NoticePart[] } {
  const d = n.details?.[0];
  if (n.kind === "username" && d) return { who: handle(d.to ?? ""), parts: ["changed their username from ", v(handle(d.from ?? "")), " to ", v(handle(d.to ?? ""))] };
  const who = n.actorName ? handle(n.actorName) : "An admin";
  if (n.kind === "campaign" && d) return { who: n.actorName ? who : "The Owner or a Super Admin", parts: [`${d.from === "Scheduled" ? "scheduled" : "published"} a campaign titled `, v(d.to ?? "")] };
  if (n.details?.length) return { who, parts: joinParts(n.details.map(detailParts)) };
  const names = n.changes.map(c => c === "categories" ? "tags" : c);
  const list = names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return { who, parts: [`updated the ${list || "project settings"}`] };
}

export function describeNotice(n: ProjectNotice) {
  const { who, parts } = noticeParts(n);
  return { who, what: parts.map(p => typeof p === "string" ? p : p.value).join("") };
}

export const noticeUrl = (n: ProjectNotice) =>
  n.kind === "campaign" ? "/studio-dashboard/campaigns-tab" : `/studio-dashboard/hub-profile?tab=${n.tab}`;
