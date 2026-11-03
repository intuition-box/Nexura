"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PROJECT_SESSION_EVENT, getStoredProjectToken, isProjectSessionActive } from "@/lib/projectApi";
import { GOVERNANCE_EVENT, awaitingMyVote, fetchGovernance, isGovernanceUnavailable, markNotificationsRead, type Proposal } from "@/lib/adminGovernance";

const POLL_MS = 30_000;

/**
 * Proposals waiting for the signed-in signer's approval or rejection, for the header notification bell.
 * Read state is stored on the server per admin, so it's the same on every device.
 */
export function useProposalNotifications() {
  const [items, setItems] = useState<Proposal[]>([]);
  // Stops polling when the connected API doesn't have the governance endpoints
  const unavailable = useRef(false);

  const refresh = useCallback(async () => {
    // Only project hub admins have governance (studio user hubs don't)
    if (!getStoredProjectToken() || unavailable.current) return;
    // Nothing is shown once the session has expired; they see it again after signing in
    if (!isProjectSessionActive()) { setItems([]); return; }
    try {
      setItems(awaitingMyVote(await fetchGovernance()));
    } catch (err) {
      if (isGovernanceUnavailable(err)) { unavailable.current = true; setItems([]); }
      // otherwise keep the last known list; the next poll retries
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onChange = () => { refresh(); };
    const onFocus = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener(GOVERNANCE_EVENT, onChange);
    window.addEventListener(PROJECT_SESSION_EVENT, onChange);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener(GOVERNANCE_EVENT, onChange);
      window.removeEventListener(PROJECT_SESSION_EVENT, onChange);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  /** Marks the given notifications read (all when omitted). Updates the list right away and syncs with the server. */
  const markRead = useCallback(async (refs?: string[]) => {
    const target = refs ? new Set(refs) : null;
    setItems(prev => prev.map(p => (!target || target.has(p.id) ? { ...p, readByMe: true } : p)));
    try {
      setItems(awaitingMyVote(await markNotificationsRead(refs)));
    } catch {
      refresh(); // put the real state back
    }
  }, [refresh]);

  const unread = items.filter(p => !p.readByMe).length;
  return { items, unread, markRead };
}

/** Event the bell fires to switch an already-open Admin Management page to its Proposals tab. */
export const OPEN_PROPOSALS_EVENT = "nexura-open-proposals";
