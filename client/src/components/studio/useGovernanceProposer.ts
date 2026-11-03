"use client";

import { useCallback, useEffect, useState } from "react";
import { useStudioSigner } from "./useStudioSigner";
import { useStudioWallet } from "./useStudioWallet";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { projectApiRequest } from "@/lib/projectApi";
import {
  EMPTY_SNAPSHOT, type GovernanceSnapshot, type ProposalAction,
  checkProposal, fetchGovernance, isGovernanceUnavailable, newProposalId, notifyGovernanceChanged, submitProposal,
} from "@/lib/adminGovernance";

/**
 * Makes signed governance proposals from outside Admin Management (e.g. proposing to end a campaign).
 * Loads the governance state so callers can show what's already pending.
 */
export function useGovernanceProposer() {
  const [gov, setGov] = useState<GovernanceSnapshot>(EMPTY_SNAPSHOT);
  const [me, setMe] = useState<{ id: string; name: string; hubName: string } | null>(null);
  const signStudioAction = useStudioSigner();
  const sessionWallet = useStudioWallet();

  const refresh = useCallback(async () => {
    try { setGov(await fetchGovernance()); }
    catch (err) { if (!isGovernanceUnavailable(err)) console.error("Failed to load proposals:", err); }
  }, []);

  useEffect(() => {
    refresh();
    projectApiRequest<{ hub?: Record<string, any>; admin?: Record<string, any> }>({ method: "GET", endpoint: "/hub/me" })
      .then(r => { if (r?.admin?._id) setMe({ id: String(r.admin._id), name: String(r.admin.name ?? "Admin"), hubName: String(r.hub?.name ?? "") }); })
      .catch(() => {});
  }, [refresh]);

  // Pending proposals change as other signers vote
  useLiveRefresh(refresh);

  /**
   * Has the connected wallet sign a studio action (EIP-712, no transaction or gas).
   * `id` is what the action is about: a proposal ref, or a campaign id when publishing.
   */
  const sign = async (verb: "Propose" | "Publish", title: string, id: string) => {
    if (!me) throw new Error("Your admin account is still loading. Try again in a moment.");
    const message = {
      hub: me.hubName,
      action: verb,
      proposal: title,
      proposalId: id,
      signer: `${me.name} (${me.id})`,
      signedAt: new Date().toISOString(),
    };
    // Signs through the shown wallet without asking to connect it again
    const { signature, scheme } = await signStudioAction(message, { linked: gov.signerWallets?.[me.id], preferred: sessionWallet.address });
    return { signature, scheme, message };
  };

  /**
   * Signs the proposal with the admin's linked wallet and submits it. Throws with a readable reason.
   * `action` can be a function, built only after the wallet has signed (e.g. when it needs an upload first).
   */
  const propose = async (title: string, change: string, action: ProposalAction | (() => Promise<ProposalAction>)) => {
    if (me && !gov.signerIds.includes(me.id)) throw new Error("Only signers can make proposals. Ask a signer to add you in Admin Management.");
    if (typeof action !== "function") await checkProposal(action);
    const ref = newProposalId();
    const signed = await sign("Propose", title, ref);
    const resolved = typeof action === "function" ? await action() : action;
    const snap = await submitProposal({ ref, title, change, action: resolved, clientUrl: window.location.origin, ...signed });
    setGov(snap);
    notifyGovernanceChanged();
    return snap.proposals.find(p => p.id === ref) ?? null;
  };

  return { gov, propose, sign, refresh };
}
