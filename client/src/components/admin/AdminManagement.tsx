"use client";
import StudioLoader from "@/components/studio/StudioLoader";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useStudioWallet } from "../studio/useStudioWallet";
import { useStudioSigner } from "../studio/useStudioSigner";
import { getStoredProjectInfo, projectApiRequest } from "../../lib/projectApi";
import { useToast } from "../../hooks/use-toast";
import { useUrlState } from "../../hooks/use-url-state";
import { useLiveRefresh } from "../../hooks/use-live-refresh";
import StudioDropdown from "../studio/StudioDropdown";
import { OPEN_PROPOSALS_EVENT } from "../studio/useProposalNotifications";
import { RECOMMENDED_SIGNERS } from "../studio/SignerReminder";
import ActivityFeed, { CATEGORY_LABEL, type FeedCategory, type FeedItem } from "../studio/ActivityFeed";
import { noticeParts, type NoticePart, type ProjectNotice } from "../studio/useProjectNotifications";
import { useRouter } from "next/navigation";
import { EMAIL_RE } from "@/lib/email";
import {
  type BackendRole, type GovernanceSnapshot, type Proposal, type ProposalAction, type ProposalStatus, type SignedPayload,
  type StudioRole, type TeamMember, type Vote,
  PERMISSION_COUNT, PERMISSION_GROUPS, ROLE_LABEL, ROLE_SUMMARY, SIGNER_PERMISSIONS, presenceOf, timeAgo,
  EMPTY_SNAPSHOT, apiHost, assignableRoles, isGovernanceUnavailable, can, canManageMember, checkProposal, fetchGovernance, formatDateTime, requiredApprovals, newProposalId,
  notifyGovernanceChanged, permissionCount, studioRole, submitExecution, submitProposal, submitVote, tally,
} from "../../lib/adminGovernance";

export type AdminType = TeamMember;

type PendingInvite = {
  _id: string;
  email: string;
  role: string;
  createdAt?: string;
  expiresAt?: string;
};

type Tab = "team" | "proposals" | "roles" | "signers" | "history";
const TABS: Tab[] = ["team", "proposals", "roles", "signers", "history"];
type ProposalFilter = ProposalStatus | "all";
const FILTERS: ProposalFilter[] = ["pending", "executed", "rejected", "all"];
const EMPTY_PROPOSALS: Record<ProposalFilter, string> = {
  pending: "Nothing waiting for approval",
  executed: "Nothing approved yet",
  rejected: "Nothing rejected",
  all: "No proposals yet",
};
const ROLE_TABS: StudioRole[] = ["owner", "superadmin", "admin"];

const ICON = "/admin-management";

const FONT: React.CSSProperties = { fontFamily: "'Geist', 'Inter', sans-serif" };
const MONO = "font-['Geist_Mono','ui-monospace',monospace]";

// ─── Small presentational pieces ─────────────────────────────────────────────
function Pill({ tone, children, dot }: { tone: "violet" | "green" | "grey" | "amber" | "red"; children: React.ReactNode; dot?: boolean }) {
  const tones = {
    violet: "bg-[rgba(138,63,252,0.1)] border-[rgba(138,63,252,0.28)] text-[#6e2bd8]",
    green: "bg-[rgba(0,225,162,0.16)] border-[rgba(0,168,124,0.3)] text-[#00a87c]",
    grey: "bg-[#f7f4fe] border-[rgba(28,37,51,0.15)] text-[#3d485c]",
    amber: "bg-[rgba(245,158,11,0.14)] border-[rgba(194,124,0,0.3)] text-[#c27c00]",
    red: "bg-[rgba(248,113,113,0.16)] border-[rgba(228,84,91,0.3)] text-[#e4545b]",
  }[tone];
  const dotColor = { violet: "#6e2bd8", green: "#00a87c", grey: "#69728a", amber: "#c27c00", red: "#e4545b" }[tone];
  return (
    <span className={`inline-flex items-center gap-[6px] h-[24.45px] px-[9px] py-[3px] rounded-[20px] border-[0.833px] border-solid text-[12px] font-semibold leading-[16.8px] whitespace-nowrap ${tones}`}>
      {dot && <span className="size-[7px] rounded-full shrink-0" style={{ background: dotColor }} />}
      {children}
    </span>
  );
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-[12px] items-start px-[16px] py-[14px] rounded-[40px] bg-[rgba(138,63,252,0.1)] border-[0.833px] border-solid border-[rgba(138,63,252,0.24)]">
      <img src={`${ICON}/info.svg`} alt="" className="size-[18px] mt-px shrink-0" />
      <p className="text-[13px] leading-[20.15px] text-[#6e2bd8]">{children}</p>
    </div>
  );
}

function SegmentedTabs<T extends string>({ items, value, onChange, label }: { items: { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-[2px] p-[3px] rounded-[40px] bg-[#f4f1fc] border-[0.833px] border-solid border-[rgba(28,37,51,0.19)]">
      {items.map(it => {
        const active = it.id === value;
        return (
          <button
            key={it.id} role="tab" aria-selected={active} onClick={() => onChange(it.id)}
            className={`px-[14px] py-[7px] rounded-[40px] text-[13px] font-semibold whitespace-nowrap transition-colors ${active ? "text-white" : "text-[#69728a] hover:text-[#1c2533]"}`}
            style={active ? { backgroundImage: "linear-gradient(150deg, #9b7cff 0%, #7c5cfc 45%, #5aa8ff 100%)" } : undefined}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function Select({ value, onChange, options, disabled, height = 40, ariaLabel }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean; height?: number; ariaLabel: string;
}) {
  return <StudioDropdown value={value} onChange={onChange} options={options} disabled={disabled} height={height} ariaLabel={ariaLabel} />;
}

function PrimaryButton({ children, onClick, disabled, glow, type = "button" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; glow?: boolean; type?: "button" | "submit" }) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-[8px] min-h-[40px] px-[16px] py-[10px] rounded-[40px] bg-[#8b3efe] text-white text-[14px] font-semibold whitespace-nowrap border-[0.833px] border-solid border-transparent hover:bg-[#7c2ff0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${glow ? "drop-shadow-[0px_8px_11px_rgba(138,63,252,0.65)]" : ""}`}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, danger, disabled }: { children: React.ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center min-h-[40px] px-[16px] py-[10px] rounded-[40px] text-[14px] font-semibold whitespace-nowrap border-[0.833px] border-solid disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${danger
        ? "bg-[rgba(248,113,113,0.16)] border-[rgba(228,84,91,0.64)] text-[#e4545b] hover:bg-[rgba(248,113,113,0.24)]"
        : "bg-[#f7f4fe] border-[rgba(28,37,51,0.15)] text-[#1c2533] hover:bg-[#efeafb]"}`}
    >
      {children}
    </button>
  );
}

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[rgba(16,14,27,0.55)]" onMouseDown={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()}
        className="w-full max-w-[480px] bg-white rounded-[40px] border-[0.833px] border-solid border-[rgba(28,37,51,0.15)] drop-shadow-[0px_22px_25px_rgba(28,37,51,0.28)]"
        style={FONT}
      >
        <h3 className="pt-[22px] px-[24px] text-[16.38px] font-semibold leading-[18.84px] tracking-[-0.33px] text-[#1c2533]">{title}</h3>
        <div className="px-[24px] py-[16px]">{children}</div>
        <div className="flex flex-wrap gap-[10px] justify-end px-[24px] pt-[16px] pb-[22px]">{footer}</div>
      </div>
    </div>
  );
}

function Toast({ tone, title, body, onClose }: { tone: "executed" | "rejected"; title: string; body: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div role="status" className="fixed bottom-6 right-6 z-[400] max-w-[360px] flex gap-[12px] items-start px-[15px] py-[13px] rounded-[12px] bg-[#f7f4fe] border-[0.833px] border-solid border-[rgba(28,37,51,0.15)] drop-shadow-[0px_22px_25px_rgba(28,37,51,0.28)]" style={FONT}>
      <span className={`mt-px grid place-items-center size-[22px] rounded-[6px] shrink-0 ${tone === "executed" ? "bg-[rgba(0,225,162,0.16)]" : "bg-[rgba(245,158,11,0.14)]"}`}>
        <img src={`${ICON}/${tone === "executed" ? "toast-executed" : "toast-rejected"}.svg`} alt="" className="size-[14px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold leading-[20.9px] text-[#1c2533]">{title}</p>
        <p className="pt-[2px] text-[12.5px] leading-[19.4px] text-[#69728a]">{body}</p>
      </div>
    </div>
  );
}

type ConfirmationSigner = { id: string; name: string; role: string; isMe: boolean; vote?: "approve" | "reject"; signature?: { address: string; signedAt: string } };

const SIGNER_CHIPS_SHOWN = 4;
const MAX_PROGRESS_SEGMENTS = 6;

/**
 * Safe-style summary: a short progress bar, "1 of 2 confirmations" and a chip per signer.
 * Large teams show the first few signers (those who voted first, then you) and a "+N more" toggle.
 */
function Confirmations({ approvals, needed, signers }: { approvals: number; needed: number; signers: ConfirmationSigner[] }) {
  const [expanded, setExpanded] = useState(false);
  const rank = (sg: ConfirmationSigner) => (sg.vote ? 0 : sg.isMe ? 1 : 2);
  const ordered = [...signers].sort((a, b) => rank(a) - rank(b));
  const hidden = Math.max(0, ordered.length - SIGNER_CHIPS_SHOWN);
  const visible = expanded || hidden === 0 ? ordered : ordered.slice(0, SIGNER_CHIPS_SHOWN);
  return (
    <div className="flex flex-wrap items-center gap-x-[14px] gap-y-[8px] min-w-0">
      <div className="flex items-center gap-[8px]">
        {needed <= MAX_PROGRESS_SEGMENTS ? (
          <div className="flex gap-[3px]" aria-hidden>
            {Array.from({ length: needed }, (_, i) => (
              <span key={i} className={`h-[6px] w-[18px] rounded-full ${i < approvals ? "bg-[#00a87c]" : "bg-[#e9e5f5]"}`} />
            ))}
          </div>
        ) : (
          <div className="h-[6px] w-[90px] rounded-full bg-[#e9e5f5] overflow-hidden" aria-hidden>
            <div className="h-full rounded-full bg-[#00a87c]" style={{ width: `${Math.min(100, (approvals / needed) * 100)}%` }} />
          </div>
        )}
        <span className="text-[12.5px] font-semibold text-[#3d485c] whitespace-nowrap">{Math.min(approvals, needed)} of {needed} confirmations</span>
      </div>
      <div className="flex flex-wrap items-center gap-[6px]">
        {visible.map(sg => {
          const state = sg.vote === "approve" ? "Approved" : sg.vote === "reject" ? "Rejected" : "Hasn't signed yet";
          const Icon = sg.vote === "approve" ? CheckCircle2 : sg.vote === "reject" ? XCircle : Clock;
          const iconColor = sg.vote === "approve" ? "text-[#00a87c]" : sg.vote === "reject" ? "text-[#e4545b]" : "text-[#98a0b4]";
          return (
            <span key={sg.id} title={`${sg.name}${sg.isMe ? " (you)" : ""} · ${sg.role} · ${state}${sg.signature ? ` · signed with ${sg.signature.address.slice(0, 6)}…${sg.signature.address.slice(-4)}` : ""}`}
              className="inline-flex items-center gap-[6px] h-[28px] pl-[8px] pr-[11px] rounded-[8px] bg-[#f8f7fb] border-[0.833px] border-solid border-[rgba(28,37,51,0.08)] text-[12.5px] font-medium text-[#3d485c]">
              <Icon className={`size-[15px] shrink-0 ${iconColor}`} strokeWidth={2.2} />
              {sg.name}{sg.isMe && <span className="text-[#98a0b4]">(you)</span>}
            </span>
          );
        })}
        {hidden > 0 && (
          <button onClick={() => setExpanded(v => !v)}
            className="h-[28px] px-[11px] rounded-[8px] text-[12.5px] font-semibold text-[#6e2bd8] hover:bg-[rgba(138,63,252,0.08)]">
            {expanded ? "Show less" : `+${hidden} more`}
          </button>
        )}
      </div>
    </div>
  );
}

/** Invite created but its email didn't go out: the link to send the person directly. */
function InviteShareBox({ share, email }: { share: { link: string; code: string; emailError: string }; email: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(share.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="mt-[12px] px-[16px] py-[12px] rounded-[24px] bg-[rgba(245,158,11,0.08)] border-[0.833px] border-solid border-[rgba(245,158,11,0.35)]">
      <p className="text-[13px] font-semibold text-[#b45309]">Invitation created · the email couldn&apos;t be delivered</p>
      <p className="pt-[2px] text-[12.5px] leading-[19.4px] text-[#3d485c]">
        Send this link to {email || "the invitee"} yourself. It fills in their email and access code ({share.code}) and stays valid for 24 hours.
      </p>
      <div className="mt-[10px] flex flex-wrap items-center gap-[8px]">
        <code className={`min-w-0 flex-1 truncate px-[12px] py-[7px] rounded-[40px] bg-white border-[0.833px] border-solid border-[rgba(28,37,51,0.12)] text-[12px] ${MONO}`}>{share.link}</code>
        <button onClick={copy} className="min-h-[34px] px-[14px] py-[7px] rounded-[40px] bg-[#8b3efe] text-white text-[13px] font-semibold hover:bg-[#7c2ff0]">
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

/** Plain-language reason for a failed execution. */
function explainExecutionError(raw: string): string {
  if (/connection timeout|etimedout|econnection|greeting|smtp|socket/i.test(raw)) {
    return `The server couldn't send the invitation email (${raw}). Choose Try again: the invitation will be created, and if the email still can't go out you'll get a link to send yourself.`;
  }
  if (/already in use/i.test(raw)) return "That email already belongs to an admin, so no invitation was sent.";
  return `The server refused the change: ${raw}`;
}

const thStyle = "px-[12px] py-[10px] text-left text-[12px] font-semibold leading-[18.6px] tracking-[0.36px] uppercase text-[#69728a] border-b-[0.833px] border-solid border-[rgba(28,37,51,0.09)] whitespace-nowrap";
const tdStyle = "p-[12px] h-[70px] border-b-[0.833px] border-solid border-[rgba(28,37,51,0.09)] align-middle";
const thCenter = thStyle.replace("text-left", "text-center");

// ─── Main component ──────────────────────────────────────────────────────────
export default function AdminManagement() {
  const { toast } = useToast();
  const router = useRouter();

  const [admins, setAdmins] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [hubId, setHubId] = useState<string>("");
  const [hubName, setHubName] = useState<string>("your project");
  const [meId, setMeId] = useState<string>(() => (getStoredProjectInfo()?.adminId ?? "") as string);

  const [gov, setGov] = useState<GovernanceSnapshot>(EMPTY_SNAPSHOT);
  // The connected API doesn't have the governance endpoints yet (not deployed)
  const [govUnavailable, setGovUnavailable] = useState(false);

  // Kept in the URL so a refresh stays on the same tab
  const [tab, setTab] = useUrlState<Tab>("tab", "team", TABS);
  const [filter, setFilter] = useUrlState<ProposalFilter>("status", "pending", FILTERS);
  const [roleTab, setRoleTab] = useUrlState<StudioRole>("role", "owner", ROLE_TABS);
  const [addOpen, setAddOpen] = useState(false);
  const [signerDialog, setSignerDialog] = useState<SignerDialogState | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [managing, setManaging] = useState<TeamMember | null>(null);
  const [toastMsg, setToastMsg] = useState<{ tone: "executed" | "rejected"; title: string; body: string } | null>(null);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [signing, setSigning] = useState<string | null>(null);
  const sessionWallet = useStudioWallet();
  const signStudioAction = useStudioSigner();

  // Ticks with the team refresh so "Last seen" and online status stay current
  const [now, setNow] = useState(() => Date.now());

  /** `quiet` refreshes in the background (statuses), without the loading state or error toasts. */
  const fetchTeam = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [team, me] = await Promise.all([
        projectApiRequest<{ admins?: TeamMember[]; pendingInvites?: PendingInvite[] }>({ method: "GET", endpoint: "/hub/hub-admins" }),
        projectApiRequest<{ hub?: Record<string, any>; admin?: Record<string, any> }>({ method: "GET", endpoint: "/hub/me" }).catch(() => null),
      ]);
      setAdmins(team.admins ?? []);
      setPendingInvites(team.pendingInvites ?? []);
      if (me?.hub) {
        setOwnerId(me.hub.superAdmin ? String(me.hub.superAdmin) : null);
        setHubId(String(me.hub._id ?? ""));
        if (me.hub.name) setHubName(String(me.hub.name));
      }
      if (me?.admin?._id) setMeId(String(me.admin._id));
      setNow(Date.now());
    } catch (err: unknown) {
      if (!quiet) toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load your team.", variant: "destructive" });
    } finally {
      if (!quiet) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const [activity, setActivity] = useState<ProjectNotice[] | null>(null);
  const [historyFilter, setHistoryFilter] = useState<FeedCategory | "all">("all");
  useEffect(() => {
    if (tab !== "history") return;
    projectApiRequest<{ items?: ProjectNotice[] }>({ method: "GET", endpoint: "/hub/activity" })
      .then(r => setActivity(r.items ?? []))
      .catch(() => setActivity(a => a ?? []));
  }, [tab]);

  // The notification bell switches an already-open page to its Proposals tab
  useEffect(() => {
    const openProposals = () => { setTab("proposals"); setFilter("pending"); };
    window.addEventListener(OPEN_PROPOSALS_EVENT, openProposals);
    return () => window.removeEventListener(OPEN_PROPOSALS_EVENT, openProposals);
  }, []);

  // ─── Derived team / governance data ────────────────────────────────────────
  const roleOf = useCallback((m: TeamMember) => studioRole(m, ownerId), [ownerId]);
  const me = admins.find(a => a._id === meId);
  const myRole: StudioRole = me ? roleOf(me) : ((getStoredProjectInfo()?.role === "superadmin") ? "superadmin" : "admin");
  const tabs =([["team", "Team"], ["proposals", "Proposals"], ["roles", "Roles & permissions"], ["signers", "Signers"], ["history", "Hub activity"]] as [Tab, string][])
    .filter(([id]) => id !== "proposals" || myRole !== "admin");
  useEffect(() => { if (me && myRole === "admin" && tab === "proposals") setTab("team"); }, [me, myRole, tab, setTab]);

  const sortedAdmins = useMemo(() => {
    const rank: Record<StudioRole, number> = { owner: 0, superadmin: 1, admin: 2 };
    return [...admins].sort((a, b) => rank[roleOf(a)] - rank[roleOf(b)] || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  }, [admins, roleOf]);

  const signerIds = useMemo(() => new Set(gov.signerIds), [gov.signerIds]);
  const signers = useMemo(() => sortedAdmins.filter(a => signerIds.has(a._id)), [sortedAdmins, signerIds]);
  const thresholds = gov.thresholds;
  const amSigner = signerIds.has(meId);
  // Every change is a proposal, and only signers (Owner + Super Admins added as signers) make proposals
  // Owner and Super Admins get every governance button. The server is the gatekeeper:
  // only signers can actually submit, and its reason is shown if a request is refused.
  const canPropose = myRole !== "admin";
  const showGovButtons = canPropose;
  const canAddAdmins = canPropose && assignableRoles(myRole).length > 0;


  const nameOf = (id: string) => admins.find(a => a._id === id)?.name ?? "Former member";

  // ─── Server governance ─────────────────────────────────────────────────────
  /**
   * After every server response: store the new state, tell the bell, and report what happened
   * to the proposal that was just acted on (executed, rejected or failed to execute).
   */
  const applySnapshot = (snap: GovernanceSnapshot, actedOn?: string) => {
    setGov(snap);
    if (snap.ownerId) setOwnerId(snap.ownerId);
    notifyGovernanceChanged();
    if (!actedOn) return;
    const p = snap.proposals.find(x => x.id === actedOn);
    if (!p) return;
    if (p.status === "executed") {
      setToastMsg({ tone: "executed", title: "Proposal executed", body: p.inviteShare ? "Invitation created. The email couldn't be delivered, so copy the link on the proposal and send it yourself." : `${p.title} was applied` });
      if (p.action.kind !== "thresholds") fetchTeam(true);
    } else if (p.status === "rejected") {
      setToastMsg({ tone: "rejected", title: "Proposal rejected", body: (p.resolvedCount ?? 0) >= snap.thresholds.rejection ? "It reached the rejection threshold" : "It can no longer get enough approvals to pass" });
    } else if (p.executionError) {
      toast({ title: "Execution failed", description: explainExecutionError(p.executionError), variant: "destructive" });
    }
  };

  /** `quiet` refreshes in the background, without error toasts. */
  const loadGovernance = useCallback(async (quiet = false) => {
    try {
      const snap = await fetchGovernance();
      setGov(snap);
      setGovUnavailable(false);
      if (snap.ownerId) setOwnerId(snap.ownerId);
    } catch (err: unknown) {
      if (isGovernanceUnavailable(err)) { setGovUnavailable(true); return; }
      if (quiet) return;
      toast({ title: "Couldn't load proposals", description: err instanceof Error ? err.message : "Try again shortly.", variant: "destructive" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadGovernance(); }, [loadGovernance]);

  // Pick up changes other admins make (votes, new proposals, team changes) without a reload
  useLiveRefresh(() => Promise.all([fetchTeam(true), govUnavailable ? null : loadGovernance(true)]));

  /**
   * Safe-style proof of intent: the connected wallet signs structured (EIP-712) data describing the action,
   * so the wallet shows exactly what is being confirmed. The server verifies the signature, links the
   * wallet on an admin's first signature, and afterwards only accepts that wallet for them.
   */
  const signAction = async (verb: "Propose" | "Approve" | "Reject" | "Execute", proposal: Pick<Proposal, "id" | "title">): Promise<SignedPayload> => {
    const message = {
      hub: hubName,
      action: verb,
      proposal: proposal.title,
      proposalId: proposal.id,
      signer: `${me?.name ?? "Admin"} (${meId})`,
      signedAt: new Date().toISOString(),
    };
    // Signs through the shown wallet without asking to connect it again
    const { signature, scheme } = await signStudioAction(message, { linked: gov.signerWallets?.[meId], preferred: sessionWallet.address });
    return { signature, scheme, message };
  };

  const signError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (/user (rejected|denied)|request rejected|cancel/i.test(msg)) return; // closed the wallet prompt
    // An older server that doesn't know this proposal type yet
    const description = /^unknown action$/i.test(msg.trim()) ? "The server doesn't support this change yet. It needs the latest server update." : msg;
    toast({ title: "Not completed", description, variant: "destructive" });
  };

  /** Sign → send to the server → show the server's result. */
  const signAndSubmit = async (busyId: string, verb: "Propose" | "Approve" | "Reject" | "Execute", proposal: Pick<Proposal, "id" | "title">, send: (signed: SignedPayload) => Promise<GovernanceSnapshot>) => {
    setSigning(busyId);
    let signed: SignedPayload;
    try { signed = await signAction(verb, proposal); }
    catch (err) { setSigning(null); signError(err); return false; }
    setSigning(null);
    setExecuting(busyId);
    try {
      applySnapshot(await send(signed), proposal.id);
      return true;
    } catch (err) {
      if (isGovernanceUnavailable(err)) { setGovUnavailable(true); return false; }
      signError(err);
      loadGovernance();
      return false;
    } finally {
      setExecuting(null);
    }
  };

  const createProposal = async (title: string, change: string, action: ProposalAction) => {
    if (!canPropose) return;
    try { await checkProposal(action); }
    catch (err) { if (isGovernanceUnavailable(err)) setGovUnavailable(true); else signError(err); return; }
    const ref = newProposalId();
    const ok = await signAndSubmit(ref, "Propose", { id: ref, title }, signed =>
      submitProposal({ ref, title, change, action, clientUrl: window.location.origin, ...signed }));
    if (ok) { setTab("proposals"); setFilter("pending"); }
  };

  const castVote = async (p: Proposal, vote: Vote) => {
    if (!amSigner || p.status !== "pending" || p.votes[meId] || p.proposedBy.id === meId) return;
    await signAndSubmit(p.id, vote === "approve" ? "Approve" : "Reject", p, signed => submitVote(p.id, { vote, ...signed }));
  };

  /** Execute = sign with the wallet; the server applies the approved change. */
  const executeProposal = async (p: Proposal) => {
    if (executing || signing) return;
    await signAndSubmit(p.id, "Execute", p, signed => submitExecution(p.id, signed));
  };

  // ─── Invitations (already-approved invites) ────────────────────────────────
  /** Revoking an invitation is a proposal like any other team change; it is removed once executed. */
  const revokeInvite = (invite: PendingInvite) => {
    const role: BackendRole = invite.role === "superadmin" ? "superadmin" : "admin";
    createProposal(
      `Revoke invitation for ${invite.email}`,
      `Cancel the ${ROLE_LABEL[role]} invitation sent to ${invite.email}`,
      { kind: "revokeInvite", inviteId: invite._id, email: invite.email, role },
    );
  };
  const revokeInviteProposed = (inviteId: string) =>
    gov.proposals.some(p => p.status === "pending" && p.action.kind === "revokeInvite" && p.action.inviteId === inviteId);

  const resendInvite = async (invite: PendingInvite) => {
    setBusyInvite(invite._id);
    try {
      await projectApiRequest({ method: "POST", endpoint: "/hub/resend-invite", data: { inviteId: invite._id, clientUrl: window.location.origin } });
      toast({ title: "Invitation resent", description: `A new invitation was sent to ${invite.email}.` });
      fetchTeam(true);
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to resend the invitation.", variant: "destructive" });
    } finally {
      setBusyInvite(null);
    }
  };

  // ─── Render helpers ────────────────────────────────────────────────────────
  const counts = {
    pending: gov.proposals.filter(p => p.status === "pending").length,
    executed: gov.proposals.filter(p => p.status === "executed").length,
    rejected: gov.proposals.filter(p => p.status === "rejected").length,
    all: gov.proposals.length,
  };
  const visibleProposals = gov.proposals.filter(p => filter === "all" || p.status === filter);

  const openProposalList = () => { setTab("proposals"); setFilter("all"); };
  const roleName = (r: BackendRole) => (r === "superadmin" ? "a Super Admin" : "an Admin");
  const proposalParts = (a: ProposalAction, title: string): NoticePart[] => {
    switch (a.kind) {
      case "invite": return ["to invite ", { value: a.email }, ` as ${roleName(a.role)}`];
      case "revokeInvite": return ["to cancel the invitation for ", { value: a.email }];
      case "member": return ["to make ", { value: `@${a.adminName}` }, ` ${roleName(a.toRole)}`];
      case "revoke": return ["to remove ", { value: `@${a.adminName}` }, " from the hub"];
      case "signer": return [a.add ? "to add " : "to remove ", { value: `@${a.adminName}` }, " as a signer"];
      case "replaceSigner": return ["to replace signer ", { value: `@${a.oldName}` }, " with ", { value: `@${a.newName}` }];
      case "transferOwnership": return ["to transfer ownership to ", { value: a.newOwnerName ? `@${a.newOwnerName}` : "another admin" }];
      case "thresholds": return ["to change approvals needed from ", { value: String(a.prevApproval) }, " to ", { value: String(a.approval) }];
      case "endCampaign": return ["to end the campaign ", { value: a.campaignTitle ?? title }];
      case "editCampaign": return ["to edit the campaign ", { value: a.campaignTitle ?? title }];
      default: return [{ value: title }];
    }
  };
  const historyItems: FeedItem[] = [
    ...(activity ?? []).map(n => {
      const d = noticeParts(n);
      const category: FeedCategory = n.kind === "username" ? "team" : n.kind === "campaign" ? "campaign" : "settings";
      return {
        id: n.id, who: d.who, parts: d.parts, at: n.createdAt, category,
        onOpen: category === "team" ? undefined
          : () => router.push(category === "campaign" ? "/studio-dashboard/campaigns-tab" : `/studio-dashboard/hub-profile?tab=${n.tab}`),
      };
    }),
    ...gov.proposals.flatMap(p => [
      {
        id: p.id, who: `@${p.proposedBy.name}`, parts: ["proposed ", ...proposalParts(p.action, p.title)], at: p.createdAt, category: "proposal" as const,
        status: p.status === "executed" ? "approved" as const : p.status, onOpen: openProposalList,
      },
      ...Object.entries(p.votes ?? {}).filter(([id]) => id !== p.proposedBy.id).map(([id, vote]) => {
        const name = admins.find(a => a._id === id)?.name;
        return {
          id: `${p.id}:${id}`, who: name ? `@${name}` : "A former admin",
          parts: [`${vote === "approve" ? "approved" : "rejected"} `, { value: `@${p.proposedBy.name}` }, "’s proposal ", ...proposalParts(p.action, p.title)],
          at: p.signatures?.[id]?.signedAt ?? p.resolvedAt ?? p.createdAt, category: "proposal" as const, onOpen: openProposalList,
          status: vote === "approve" ? "approved" as const : "rejected" as const,
        };
      }),
      ...(p.status !== "pending" && p.resolvedAt ? [{
        id: `${p.id}:outcome`, who: `@${p.proposedBy.name}’s`,
        parts: ["proposal ", ...proposalParts(p.action, p.title), ` was ${p.status === "executed" ? "executed" : "rejected"}`],
        at: p.resolvedAt, category: "proposal" as const, onOpen: openProposalList,
        status: p.status === "executed" ? "executed" as const : "rejected" as const,
      }] : []),
    ]),
  ];
  const historyCount = (c: FeedCategory | "all") => c === "all" ? historyItems.length : historyItems.filter(i => i.category === c).length;
  const shownHistory = historyFilter === "all" ? historyItems : historyItems.filter(i => i.category === historyFilter);

  // Signer candidates: Super Admins who aren't signers yet and have no signer change waiting
  const pendingSignerChange = (adminId: string) =>
    gov.proposals.some(p => p.status === "pending" && (
      (p.action.kind === "signer" && p.action.adminId === adminId) ||
      (p.action.kind === "replaceSigner" && (p.action.oldId === adminId || p.action.newId === adminId))
    ));
  const pendingNominations = gov.proposals.filter(p => p.status === "pending" && p.action.kind === "signer" && p.action.add);
  const nomineeOptions = sortedAdmins.filter(m => roleOf(m) === "superadmin" && !signerIds.has(m._id) && !pendingSignerChange(m._id));

  const roleMembers = (r: StudioRole) => sortedAdmins.filter(a => roleOf(a) === r);
  const signerRuleText = `${thresholds.approval} of ${signers.length} signer${signers.length === 1 ? "" : "s"} must approve`;

  return (
    <div className="min-h-full bg-[#f7f5ff] text-[#1c2533]" style={FONT}>
      <div className="max-w-[1118px] px-4 md:px-[36px] pt-[30px] pb-16 md:pb-[48px] box-content">
        {/* Title + Add Admin */}
        <div className="flex flex-wrap items-start gap-[16px]">
          <div className="flex-1 min-w-[220px]">
            <h1 className="text-[26px] font-semibold leading-[40.3px] tracking-[-0.65px] text-[#1c2533]">Admin Management</h1>
            <p className="text-[14px] leading-[21.7px] text-[#69728a]">Team access and project settings for your hub.</p>
          </div>
          {canAddAdmins && tab === "team" && (
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-[8px] min-h-[40px] px-[16px] py-[10px] rounded-[40px] bg-[#8b3efe] text-white text-[14px] font-semibold drop-shadow-[0px_8px_11px_rgba(138,63,252,0.25)] hover:bg-[#7c2ff0]"
            >
              <img src={`${ICON}/plus.svg`} alt="" className="size-[16px]" />
              Add Admin
            </button>
          )}
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Admin management sections" className="flex gap-[2px] h-[45px] mt-[20px] border-b-[0.833px] border-solid border-[rgba(28,37,51,0.09)] overflow-x-auto">
          {tabs.map(([id, label]) => (
            <button
              key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`px-[18px] py-[12px] text-[14px] font-semibold whitespace-nowrap border-b-[1.667px] border-solid ${tab === id ? "border-[#8a3ffc] text-[#1c2533]" : "border-transparent text-[#69728a] hover:text-[#1c2533]"}`}
            >
              {label}
              {id === "proposals" && counts.pending > 0 && <span className="ml-[6px] text-[#8a3ffc]">{counts.pending}</span>}
            </button>
          ))}
        </div>

        {govUnavailable && (
          <div className="mt-[18px] flex gap-[12px] items-start px-[16px] py-[14px] rounded-[40px] bg-[rgba(245,158,11,0.14)] border-[0.833px] border-solid border-[rgba(194,124,0,0.26)]">
            <img src={`${ICON}/warning.svg`} alt="" className="size-[18px] mt-px shrink-0" />
            <p className="text-[13px] leading-[20.15px] text-[#c27c00]">
              <b className="font-bold">Proposals aren&apos;t available on this server yet. </b>
              <span className="font-medium">Your studio is connected to {apiHost}, which doesn&apos;t have the Admin Management update. Deploy the latest server, then reload this page. You can still view your team.</span>
            </p>
          </div>
        )}
        {!govUnavailable && !amSigner && myRole !== "admin" && !loading && (
          <div className="mt-[18px]">
            <InfoBanner>You can view everything here, but only signers make and approve proposals. A signer can add you as a signer from the Signers tab.</InfoBanner>
          </div>
        )}

        {/* ─── TEAM ─────────────────────────────────────────────────────── */}
        {tab === "team" && (
          <div className="mt-[20px]">
            {/* Members */}
            <section className="bg-white border-[0.833px] border-solid border-[rgba(28,37,51,0.09)] rounded-[40px] p-[10px] overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr>
                    <th className={`${thCenter} w-[25%]`}>Member</th>
                    <th className={`${thCenter} w-[22%]`}>Role</th>
                    <th className={`${thCenter} w-[22%]`}>Status</th>
                    <th className={thCenter}>Joined</th>
                    <th className={thStyle}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={5}><StudioLoader compact message="Loading team…" /></td></tr>
                  )}
                  {!loading && sortedAdmins.length === 0 && (
                    <tr><td colSpan={5} className="py-10 text-center text-[13.5px] text-[#69728a]">No team members found.</td></tr>
                  )}
                  {!loading && sortedAdmins.map(m => {
                    const role = roleOf(m);
                    const isMe = m._id === meId;
                    const manageable = canPropose && !isMe && canManageMember(myRole, role);
                    return (
                      <tr key={m._id}>
                        <td className={tdStyle}>
                          <div className="flex items-center justify-center gap-[8px]">
                            <span className="grid place-items-center size-[36px] rounded-full bg-[rgba(138,63,252,0.1)] text-[13.5px] font-bold text-[#8a3ffc] shrink-0">{(m.name || "?").charAt(0).toUpperCase()}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-[6px]">
                                <span className="text-[14px] font-semibold leading-[21.7px] text-[#3d485c] truncate">{m.name}</span>
                                {isMe && <Pill tone="grey">You</Pill>}
                              </div>
                              {m.email && <p className={`pt-[2px] text-[11.5px] leading-[17.8px] text-[#69728a] truncate ${MONO}`}>{m.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className={tdStyle}>
                          <div className="flex justify-center gap-[8px]">
                            <Pill tone="violet">{ROLE_LABEL[role]}</Pill>
                            {signerIds.has(m._id) && <Pill tone="green">Signer</Pill>}
                          </div>
                        </td>
                        <td className={`${tdStyle} text-center`}>
                          {(() => {
                            // Older API responses have no activity time; joining is then the latest thing we know
                            const presence = (isMe ? { online: true, label: "Online now" } : presenceOf(m.lastActiveAt ?? m.createdAt, now))
                              ?? { online: false, label: "Last seen recently" };
                            return <Pill tone={presence.online ? "green" : "grey"} dot>{presence.label}</Pill>;
                          })()}
                        </td>
                        <td className={`${tdStyle} text-center text-[13.5px] leading-[20.9px] text-[#69728a] whitespace-nowrap`}>{formatDateTime(m.createdAt)}</td>
                        <td className={`${tdStyle} text-right`}>
                          {manageable && (
                            <button onClick={() => setManaging(m)} className="inline-flex items-center gap-[8px] min-h-[34px] px-[12px] py-[7px] rounded-[8px] text-[13px] font-semibold text-[#3d485c] hover:bg-[rgba(138,63,252,0.06)]">
                              <img src={`${ICON}/manage.svg`} alt="" className="size-[16px]" />
                              Manage
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            {/* Compromised wallet warning */}
            <div className="mt-[16px] flex gap-[12px] items-start px-[16px] py-[14px] rounded-[40px] bg-[rgba(245,158,11,0.14)] border-[0.833px] border-solid border-[rgba(194,124,0,0.26)]">
              <img src={`${ICON}/warning.svg`} alt="" className="size-[18px] mt-px shrink-0" />
              <p className="text-[13px] leading-[20.15px] text-[#c27c00]">
                <b className="font-bold">If an admin&apos;s wallet is compromised, </b>
                <span className="font-medium">revoke their access immediately and re-invite them by email. To rejoin the team and regain hub access, they must sign in with the invited email, set a password and connect a wallet.</span>
              </p>
            </div>

            {/* Invitations */}
            <h3 className="pt-[24px] text-[16px] font-semibold leading-[18.4px] tracking-[-0.32px]">Invitations</h3>
            {pendingInvites.length === 0 ? (
              <div className="flex flex-col items-center text-center pt-[16px]">
                <div className="flex flex-col items-center max-w-[420px] p-[28px]">
                  <span className="grid place-items-center size-[56px] rounded-[16px] bg-[rgba(138,63,252,0.1)]">
                    <img src={`${ICON}/invitations-empty.svg`} alt="" className="size-[26px]" />
                  </span>
                  <p className="pt-[16px] text-[18px] font-semibold leading-[20.7px] tracking-[-0.36px]">No invitations yet</p>
                  <p className="pt-[6px] pb-[18px] text-[13.5px] leading-[20.9px] text-[#69728a]">Use Add Admin to invite a new admin. Invited people get access only after connecting that wallet and accepting.</p>
                </div>
              </div>
            ) : (
              <section className="mt-[36px] bg-white border-[0.833px] border-solid border-[rgba(28,37,51,0.09)] rounded-[40px] p-[10px] overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr>
                      <th className={thCenter}>Invited email address</th>
                      <th className={thCenter}>Role</th>
                      <th className={thCenter}>Status</th>
                      <th className={thCenter}>Created</th>
                      <th className={thStyle}><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvites.map(inv => {
                      const invRole: StudioRole = inv.role === "superadmin" ? "superadmin" : "admin";
                      const canTouch = canManageMember(myRole, invRole);
                      return (
                        <tr key={inv._id}>
                          <td className={`${tdStyle} h-[54px] text-center`}>
                            <span className={`inline-flex px-[8px] py-[3px] rounded-[40px] bg-[#f4f1fc] border-[0.833px] border-solid border-[rgba(28,37,51,0.09)] text-[12.5px] text-[#3d485c] ${MONO}`}>{inv.email}</span>
                          </td>
                          <td className={`${tdStyle} h-[54px] text-center`}><Pill tone="violet">{ROLE_LABEL[invRole]}</Pill></td>
                          <td className={`${tdStyle} h-[54px] text-center`}><Pill tone="amber" dot>Pending — no access yet</Pill></td>
                          <td className={`${tdStyle} h-[54px] text-center text-[13.5px] text-[#69728a] whitespace-nowrap`}>{formatDateTime(inv.createdAt)}</td>
                          <td className={`${tdStyle} h-[54px] text-right`}>
                            {canTouch && (
                              <div className="inline-flex gap-[8px]">
                                <button disabled={busyInvite === inv._id} onClick={() => resendInvite(inv)} className="min-h-[34px] px-[12px] py-[6px] rounded-[40px] text-[13px] font-semibold text-[#3d485c] hover:bg-[rgba(138,63,252,0.06)] disabled:opacity-50">Resend</button>
                                {revokeInviteProposed(inv._id) ? (
                                  <button onClick={() => { setTab("proposals"); setFilter("pending"); }} className="min-h-[34px] px-[12px] py-[6px] rounded-[40px] text-[13px] font-semibold text-[#8a3ffc] hover:bg-[rgba(138,63,252,0.06)]">Revoke pending approval</button>
                                ) : (
                                  <button disabled={busyInvite === inv._id || !!signing || !!executing} onClick={() => revokeInvite(inv)} title="Sends a proposal; the invitation is cancelled once signers approve and it is executed" className="min-h-[34px] px-[12px] py-[6px] rounded-[40px] bg-[#f7f4fe] border-[0.833px] border-solid border-[rgba(28,37,51,0.15)] text-[13px] font-semibold text-[#1c2533] hover:bg-[#efeafb] disabled:opacity-50">Propose revoke</button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        )}

        {/* ─── PROPOSALS ────────────────────────────────────────────────── */}
        {tab === "proposals" && (
          <div className="mt-[18px]">
            <div>
              <SegmentedTabs<ProposalFilter>
                label="Proposal status" value={filter} onChange={setFilter}
                items={[
                  { id: "pending", label: `Pending · ${counts.pending}` },
                  { id: "executed", label: `Executed · ${counts.executed}` },
                  { id: "rejected", label: `Rejected · ${counts.rejected}` },
                  { id: "all", label: `All · ${counts.all}` },
                ]}
              />
            </div>

            {visibleProposals.length === 0 ? (
              <div className="flex flex-col items-center text-center pt-[24px]">
                <div className="flex flex-col items-center max-w-[420px] px-[24px] py-[48px]">
                  <span className="grid place-items-center size-[56px] rounded-[16px] bg-[rgba(138,63,252,0.1)]">
                    <img src={`${ICON}/proposals-empty.svg`} alt="" className="size-[26px]" />
                  </span>
                  <p className="pt-[16px] text-[18px] font-semibold leading-[20.7px] tracking-[-0.36px]">{EMPTY_PROPOSALS[filter]}</p>
                  {(filter === "pending" || filter === "all") && (
                    <p className="pt-[6px] pb-[18px] text-[13.5px] leading-[20.9px] text-[#69728a]">Changes to your hub wait here until your signers approve them.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-[16px] pt-[24px]">
                {visibleProposals.map(p => {
                  const { approvals, rejections } = tally(p, signerIds);
                  const myVote = p.votes[meId];
                  const ready = p.status === "pending" && approvals >= thresholds.approval;
                  const failed = !!p.executionError;
                  const iProposed = p.proposedBy.id === meId;
                  const busy = executing === p.id || signing === p.id;
                  const statusPill = p.status === "pending"
                    ? (executing === p.id ? <Pill tone="amber" dot>Executing…</Pill>
                      : failed ? <Pill tone="red" dot>Execution failed</Pill>
                      : ready ? <Pill tone="green" dot>Ready to execute</Pill>
                      : <Pill tone="amber" dot>Pending</Pill>)
                    : p.status === "executed" ? <Pill tone="green" dot>Executed</Pill> : <Pill tone="red" dot>Rejected</Pill>;
                  return (
                    <article key={p.id} className="bg-white border-[0.833px] border-solid border-[rgba(28,37,51,0.09)] rounded-[32px] px-[22px] py-[20px]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-[16px] font-semibold leading-[22px] tracking-[-0.32px]">{p.title}</h3>
                          <p className="pt-[2px] text-[12.5px] leading-[19.4px] text-[#69728a]">Proposed by {p.proposedBy.name} · {timeAgo(p.createdAt)}</p>
                        </div>
                        <div className="shrink-0">{statusPill}</div>
                      </div>
                      <p className="pt-[10px] text-[13.5px] leading-[20.9px] text-[#3d485c]">{p.change}</p>

                      {p.status === "pending" ? (
                        <>
                          <div className="mt-[16px] pt-[14px] border-t-[0.833px] border-solid border-[rgba(28,37,51,0.08)] flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[12px]">
                            <Confirmations
                              approvals={approvals}
                              needed={thresholds.approval}
                              signers={signers.map(sg => ({
                                id: sg._id, name: sg.name, role: ROLE_LABEL[roleOf(sg)], isMe: sg._id === meId,
                                vote: p.votes[sg._id], signature: p.signatures?.[sg._id],
                              }))}
                            />
                            <div className="flex items-center gap-[8px] ml-auto">
                              {ready ? (
                                (amSigner || iProposed) ? (
                                  <button disabled={busy} onClick={() => executeProposal(p)} title="Confirm with your wallet to apply this change"
                                    className="inline-flex items-center gap-[8px] h-[36px] px-[16px] rounded-[40px] bg-[#8b3efe] text-white text-[13px] font-semibold hover:bg-[#7c2ff0] disabled:opacity-50">
                                    {signing === p.id ? "Check your wallet…" : executing === p.id ? "Executing…" : failed ? "Try again" : "Execute"}
                                  </button>
                                ) : <span className="text-[12.5px] text-[#69728a]">Waiting for a signer to execute</span>
                              ) : !amSigner && !iProposed ? (
                                <span className="text-[12.5px] text-[#69728a]">Only signers can vote</span>
                              ) : iProposed || myVote ? (
                                <span className={`text-[12.5px] font-semibold ${myVote === "reject" ? "text-[#e4545b]" : "text-[#00a87c]"}`}>
                                  {myVote === "reject" ? "You rejected" : "You approved"} · waiting for others
                                </span>
                              ) : (
                                <>
                                  <button disabled={busy} onClick={() => castVote(p, "reject")}
                                    className="inline-flex items-center gap-[6px] h-[36px] px-[14px] rounded-[40px] bg-white border-[0.833px] border-solid border-[rgba(228,84,91,0.45)] text-[#e4545b] text-[13px] font-semibold hover:bg-[rgba(248,113,113,0.08)] disabled:opacity-50">
                                    Reject
                                  </button>
                                  <button disabled={busy} onClick={() => castVote(p, "approve")}
                                    className="inline-flex items-center gap-[6px] h-[36px] px-[16px] rounded-[40px] bg-[#00a87c] text-white text-[13px] font-semibold hover:bg-[#009670] disabled:opacity-50">
                                    {signing === p.id ? "Check your wallet…" : "Approve"}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {ready && failed && (
                            <p className="pt-[10px] text-[12.5px] leading-[19.4px] text-[#e4545b]">{explainExecutionError(p.executionError!)}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="pt-[10px] text-[12.5px] leading-[19.4px] text-[#69728a]">
                            {p.status === "executed"
                              ? `Approved ${formatDateTime(p.resolvedAt)} with ${p.resolvedCount ?? approvals} approval${(p.resolvedCount ?? approvals) === 1 ? "" : "s"}.`
                              : (p.resolvedCount ?? rejections) >= thresholds.rejection
                                ? `Rejected ${formatDateTime(p.resolvedAt)} after ${p.resolvedCount ?? rejections} rejection${(p.resolvedCount ?? rejections) === 1 ? "" : "s"}.`
                                : `Rejected ${formatDateTime(p.resolvedAt)}: with ${p.resolvedCount ?? rejections} rejection${(p.resolvedCount ?? rejections) === 1 ? "" : "s"}, it could no longer reach ${thresholds.approval} approvals.`}
                          </p>
                          {p.status === "executed" && p.inviteShare && <InviteShareBox share={p.inviteShare} email={p.action.kind === "invite" ? p.action.email : ""} />}
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── HUB ACTIVITY ─────────────────────────────────────────────── */}
        {tab === "history" && (
          <div className="mt-[18px]">
            <SegmentedTabs<FeedCategory | "all">
              label="Activity type" value={historyFilter} onChange={setHistoryFilter}
              items={(["all", "settings", "team", "proposal", "campaign"] as const).map(c => ({
                id: c, label: `${c === "all" ? "All" : CATEGORY_LABEL[c]} · ${historyCount(c)}`,
              }))}
            />
            <section className="mt-[16px] rounded-[40px] border-[0.833px] border-solid border-[rgba(28,37,51,0.09)] bg-white px-[20px] pb-[14px] pt-[4px] md:px-[28px]">
              {activity === null ? (
                <p className="py-[28px] text-[14px] text-[#69728a]">Loading activity…</p>
              ) : shownHistory.length === 0 ? (
                <p className="py-[28px] text-center text-[14px] text-[#69728a]">Nothing here yet.</p>
              ) : (
                <ActivityFeed items={shownHistory} />
              )}
            </section>
          </div>
        )}

        {/* ─── SIGNERS ──────────────────────────────────────────────────── */}
        {tab === "signers" && (
          <div className="mt-[18px] flex flex-col gap-[20px]">
            {/* Signers */}
            <section className="bg-white border-[0.833px] border-solid border-[rgba(28,37,51,0.09)] rounded-[40px] p-[20px] md:p-[24px]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-[620px]">
                  <div className="flex items-center gap-[8px]">
                    <h3 className="text-[16px] font-semibold leading-[18.4px] tracking-[-0.32px]">Signers</h3>
                    <Pill tone="violet">{signers.length}</Pill>
                  </div>
                  <p className="pt-[6px] text-[13px] leading-[20.15px] text-[#69728a]">
                    Signers confirm every proposal before it takes effect. The Owner is always a signer. Being a Super Admin doesn't make someone a signer: any signer can propose adding, removing or replacing one.
                  </p>
                </div>
                {showGovButtons && (
                  <div className="flex flex-col items-end gap-[6px]">
                    <PrimaryButton glow onClick={() => setSignerDialog({ mode: "add" })}>
                      <img src={`${ICON}/plus-white.svg`} alt="" className="size-[16px]" />Add signer
                    </PrimaryButton>
                    
                  </div>
                )}
              </div>

              {!loading && signers.length > 0 && signers.length < RECOMMENDED_SIGNERS && (
                <div className="mt-[16px] flex gap-[12px] items-start px-[16px] py-[14px] rounded-[24px] bg-[rgba(245,158,11,0.1)] border-[0.833px] border-solid border-[rgba(194,124,0,0.3)]">
                  <img src={`${ICON}/warning.svg`} alt="" className="size-[18px] mt-px shrink-0" />
                  <p className="text-[13px] leading-[20.15px] text-[#8a5a00]">
                    <b className="font-bold">We recommend at least {RECOMMENDED_SIGNERS} signers. It&apos;s up to you.</b>{" "}
                    {signers.length === 1
                      ? "Right now 1 signer can approve any change alone, so if that wallet is compromised, nothing stops a harmful change."
                      : "Right now both signers must approve every change, so if one wallet is compromised or lost, nothing can be approved and it can't be replaced."}{" "}
                    With {RECOMMENDED_SIGNERS} or more, a compromised wallet can&apos;t approve anything alone, and the other signers can reject its proposals and replace it.
                  </p>
                </div>
              )}

              <ul className="mt-[16px] rounded-[24px] border-[0.833px] border-solid border-[rgba(28,37,51,0.09)] overflow-hidden">
                {signers.map((m, i) => {
                  const role = roleOf(m);
                  const changePending = pendingSignerChange(m._id);
                  const editable = canPropose && role !== "owner" && !changePending;
                  return (
                    <li key={m._id} className={`flex flex-wrap items-center gap-x-[12px] gap-y-[8px] px-[16px] py-[12px] ${i > 0 ? "border-t-[0.833px] border-solid border-[rgba(28,37,51,0.09)]" : ""}`}>
                      <span className="grid place-items-center size-[38px] rounded-full bg-[rgba(138,63,252,0.1)] text-[14px] font-bold text-[#8a3ffc] shrink-0">{(m.name || "?").charAt(0).toUpperCase()}</span>
                      <div className="flex-1 min-w-[160px]">
                        <div className="flex items-center gap-[6px]">
                          <span className="text-[14px] font-semibold leading-[21.7px] text-[#1c2533] truncate">{m.name}</span>
                          {m._id === meId && <Pill tone="grey">You</Pill>}
                        </div>
                        {m.email && <p className={`text-[11.5px] leading-[17.8px] text-[#69728a] truncate ${MONO}`}>{m.email}</p>}
                        <p className={`text-[11.5px] leading-[17.8px] truncate ${gov.signerWallets?.[m._id] ? `text-[#3d485c] ${MONO}` : "text-[#98a0b4]"}`}>
                          {gov.signerWallets?.[m._id] ? `Wallet ${gov.signerWallets[m._id]}` : "Wallet links on their first signature"}
                        </p>
                      </div>
                      <Pill tone="violet">{ROLE_LABEL[role]}</Pill>
                      {changePending && <Pill tone="amber" dot>Change pending</Pill>}
                      {editable && (
                        <div className="flex items-center gap-[4px]">
                          <button
                            onClick={() => setSignerDialog({ mode: "replace", target: m })}
                            className="min-h-[32px] px-[12px] rounded-[40px] text-[13px] font-semibold text-[#3d485c] hover:bg-[rgba(138,63,252,0.06)]"
                          >
                            Replace
                          </button>
                          <button
                            onClick={() => setSignerDialog({ mode: "remove", target: m })}
                            className="min-h-[32px] px-[12px] rounded-[40px] text-[13px] font-semibold text-[#e4545b] hover:bg-[rgba(248,113,113,0.12)]"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
                {pendingNominations.map(p => p.action.kind === "signer" && (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-[12px] gap-y-[8px] px-[16px] py-[12px] border-t-[0.833px] border-dashed border-[rgba(28,37,51,0.15)] bg-[#fbfaff]">
                    <span className="grid place-items-center size-[38px] rounded-full border-[1.5px] border-dashed border-[rgba(138,63,252,0.4)] text-[14px] font-bold text-[#8a3ffc] shrink-0">{p.action.adminName.charAt(0).toUpperCase()}</span>
                    <div className="flex-1 min-w-[160px]">
                      <span className="text-[14px] font-semibold leading-[21.7px] text-[#3d485c]">{p.action.adminName}</span>
                      <p className="text-[11.5px] leading-[17.8px] text-[#69728a]">Proposed by {p.proposedBy.name} · {formatDateTime(p.createdAt)}</p>
                    </div>
                    <Pill tone="amber" dot>Awaiting confirmations</Pill>
                    <button onClick={() => { setTab("proposals"); setFilter("pending"); }} className="min-h-[32px] px-[12px] rounded-[40px] text-[13px] font-semibold text-[#8a3ffc] hover:bg-[rgba(138,63,252,0.06)]">View</button>
                  </li>
                ))}
              </ul>
            </section>

            {/* Required confirmations */}
            <section className="bg-white border-[0.833px] border-solid border-[rgba(28,37,51,0.09)] rounded-[40px] p-[20px] md:p-[24px]">
              <h3 className="text-[16px] font-semibold leading-[18.4px] tracking-[-0.32px]">Required confirmations</h3>
              <p className="pt-[6px] text-[13px] leading-[20.15px] font-semibold text-[#1c2533]">{signerRuleText}</p>
              <div className="flex items-center gap-[10px] pt-[16px]">
                <div className="flex-1 h-[8px] rounded-[20px] bg-[#efeafb] overflow-hidden">
                  <div className="h-full rounded-[20px] bg-[#8a3ffc]" style={{ width: `${(thresholds.approval / Math.max(1, signers.length)) * 100}%` }} />
                </div>
                <span className={`text-[12.5px] text-[#1c2533] ${MONO}`}>{thresholds.approval}/{signers.length}</span>
              </div>
            </section>
            {/* Ownership */}
            {(() => {
              const owner = sortedAdmins.find(a => roleOf(a) === "owner");
              const transferPending = gov.proposals.find(p => p.status === "pending" && p.action.kind === "transferOwnership");
              return (
                <section className="bg-white border-[0.833px] border-solid border-[rgba(28,37,51,0.09)] rounded-[40px] p-[20px] md:p-[24px]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="max-w-[620px]">
                      <h3 className="text-[16px] font-semibold leading-[18.4px] tracking-[-0.32px]">Ownership</h3>
                      <p className="pt-[6px] text-[13px] leading-[20.15px] text-[#69728a]">
                        <b className="font-bold text-[#1c2533]">{owner?.name ?? "The Owner"}</b> owns this hub. If the Owner&apos;s email or wallet is compromised, the Owner can transfer ownership to an existing Super Admin. The signers confirm it first.
                      </p>
                    </div>
                    {myRole === "owner" && !transferPending && (
                      <div className="flex flex-col items-end gap-[6px]">
                        <GhostButton danger onClick={() => setTransferOpen(true)}>Transfer ownership</GhostButton>
                        
                      </div>
                    )}
                  </div>
                  {transferPending && transferPending.action.kind === "transferOwnership" && (
                    <button onClick={() => { setTab("proposals"); setFilter("pending"); }} className="mt-[12px] inline-flex">
                      <Pill tone="amber" dot>Transfer to {transferPending.action.newOwnerName ?? "a Super Admin"} is awaiting confirmations · View</Pill>
                    </button>
                  )}
                </section>
              );
            })()}
          </div>
        )}

        {/* ─── ROLES & PERMISSIONS ──────────────────────────────────────── */}
        {tab === "roles" && (
          <div className="mt-[18px]">
            {myRole === "admin" && (
              <div className="pb-[24px]">
                <InfoBanner>Edits and sensitive actions need approval from your Owner and signers before they take effect.</InfoBanner>
              </div>
            )}
            <div>
              <SegmentedTabs<StudioRole>
                label="Role" value={roleTab} onChange={setRoleTab}
                items={[{ id: "owner", label: "Owner" }, { id: "superadmin", label: "Super Admin" }, { id: "admin", label: "Admin" }]}
              />
            </div>

            <div className="flex flex-col gap-[20px] pt-[24px]">
              {/* Role summary */}
              <section className="bg-white border-[0.833px] border-solid border-[rgba(28,37,51,0.09)] rounded-[40px] p-[20px]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 max-w-[704px]">
                    <div className="flex items-center gap-[8px]">
                      <h3 className="text-[18px] font-semibold leading-[20.7px] tracking-[-0.36px]">{ROLE_LABEL[roleTab]}</h3>
                      <Pill tone="violet">{roleMembers(roleTab).length} member{roleMembers(roleTab).length === 1 ? "" : "s"}</Pill>
                    </div>
                    <p className="pt-[6px] text-[13px] leading-[20.15px] text-[#3d485c]">{ROLE_SUMMARY[roleTab]}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="whitespace-nowrap"><span className="text-[24px] font-extrabold leading-[37.2px] text-[#8a3ffc]">{permissionCount(roleTab)}</span><span className="text-[14px] font-semibold text-[#69728a]"> / {PERMISSION_COUNT}</span></p>
                    <p className="text-[12px] leading-[18.6px] text-[#69728a]">permissions</p>
                  </div>
                </div>
                {roleMembers(roleTab).length > 0 && (
                  <div className="flex flex-wrap gap-[8px] pt-[16px]">
                    {roleMembers(roleTab).map(m => (
                      <Pill key={m._id} tone="grey"><span className={MONO}>{m.email || m.name}</span>{m._id === meId && <span>· You</span>}</Pill>
                    ))}
                  </div>
                )}
              </section>

              {PERMISSION_GROUPS.map(group => (
                <section key={group.title} className="bg-white border-[0.833px] border-solid border-[rgba(28,37,51,0.09)] rounded-[40px] p-[20px]">
                  <h4 className="text-[14px] font-semibold leading-[16.1px] tracking-[-0.28px]">{group.title}</h4>
                  <ul className="pt-[6px]">
                    {group.items.map(item => {
                      const allowed = can(roleTab, item.id);
                      return (
                        <li key={item.id} className="flex items-center gap-[8px] py-[9px] border-b-[0.833px] border-solid border-[rgba(28,37,51,0.09)]">
                          <img src={`${ICON}/${allowed ? "perm-allowed" : "perm-locked"}.svg`} alt="" className="size-[22px] shrink-0" />
                          <span className="flex-1 text-[13.5px] leading-[20.9px]">
                            {item.label}
                            {roleTab === "superadmin" && SIGNER_PERMISSIONS.has(item.id) && <span className="text-[#69728a]"> · if added as a signer</span>}
                          </span>
                          <span className={`text-[12px] font-semibold leading-[18.6px] whitespace-nowrap ${allowed ? "text-[#00a87c]" : "text-[#98a0b4]"}`}>{allowed ? "Allowed" : "Not allowed"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              <InfoBanner>
                {roleTab === "owner"
                  ? `Owners are always signers. Edits and closing or disabling a campaign become proposals that ${signerRuleText}. Payments don't need approval.`
                  : roleTab === "superadmin"
                    ? `Edits and closing or disabling a campaign become proposals that ${signerRuleText}. Payments don't need approval.`
                    : `Admins are never signers. Edits and closing or disabling a campaign become proposals that ${signerRuleText}. Payments don't need approval.`}
              </InfoBanner>
            </div>
          </div>
        )}
      </div>

      {signerDialog && (
        <SignerChangeDialog
          state={signerDialog}
          candidates={nomineeOptions}
          signerCount={signers.length}
          currentApproval={thresholds.approval}
          onClose={() => setSignerDialog(null)}
          onGoToTeam={() => { setSignerDialog(null); setTab("team"); }}
          onPropose={picked => {
            const d = signerDialog;
            setSignerDialog(null);
            if (d.mode === "add" && picked) {
              createProposal(`Add ${picked.name} as a signer`, `Add ${picked.name} (Super Admin) · ${requiredApprovals(signers.length + 1)} of ${signers.length + 1} must approve`, { kind: "signer", adminId: picked._id, adminName: picked.name, add: true });
            } else if (d.mode === "remove") {
              createProposal(`Remove ${d.target.name} as a signer`, `Remove ${d.target.name} · ${requiredApprovals(signers.length - 1)} of ${signers.length - 1} must approve`, { kind: "signer", adminId: d.target._id, adminName: d.target.name, add: false });
            } else if (d.mode === "replace" && picked) {
              createProposal(`Replace ${d.target.name} with ${picked.name}`, `Signer ${d.target.name} → ${picked.name}`, { kind: "replaceSigner", oldId: d.target._id, oldName: d.target.name, newId: picked._id, newName: picked.name });
            }
          }}
        />
      )}

      {transferOpen && (
        <TransferOwnershipDialog
          candidates={sortedAdmins.filter(a => roleOf(a) === "superadmin")}
          approvalsNeeded={thresholds.approval}
          signerCount={signers.length}
          onClose={() => setTransferOpen(false)}
          onGoToTeam={() => { setTransferOpen(false); setTab("team"); }}
          onPropose={m => {
            setTransferOpen(false);
            createProposal(`Transfer ownership to ${m.name}`, `Owner ${me?.name ?? "you"} → ${m.name} (Super Admin)`, { kind: "transferOwnership", newOwnerId: m._id });
          }}
        />
      )}

      {addOpen && (
        <AddAdminDialog
          hubName={hubName}
          roles={assignableRoles(myRole)}
          existingEmails={[...admins.map(a => a.email ?? ""), ...pendingInvites.map(i => i.email)]}
          onClose={() => setAddOpen(false)}
          onPropose={(email, role) => {
            setAddOpen(false);
            createProposal(`Invite ${email} as ${ROLE_LABEL[role]}`, `Send an invitation to ${email} with the ${ROLE_LABEL[role]} role`, { kind: "invite", email, role });
          }}
        />
      )}

      {managing && (
        <ManageMemberDialog
          member={managing}
          memberRole={roleOf(managing)}
          isSelf={managing._id === meId}
          actorRole={myRole}
          signer={signerIds.has(managing._id)}
          onOpenSigners={() => { setManaging(null); setTab("signers"); }}
          onClose={() => setManaging(null)}
          onRevoke={() => {
            const m = managing;
            setManaging(null);
            createProposal(`Revoke access for ${m.name}`, `Remove ${m.name} (${ROLE_LABEL[roleOf(m)]}) from the team`, { kind: "revoke", adminId: m._id, adminName: m.name });
          }}
          onPropose={toRole => {
            const m = managing;
            setManaging(null);
            createProposal(`Update access for ${m.name}`, `Role from ${ROLE_LABEL[m.role]} → ${ROLE_LABEL[toRole]}`, { kind: "member", adminId: m._id, adminName: m.name, fromRole: m.role, toRole });
          }}
        />
      )}

      {toastMsg && <Toast {...toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  );
}

// ─── Dialogs ────────────────────────────────────────────────────────────────
const ROLE_HINT: Record<BackendRole, string> = {
  admin: "Validates tasks manually. Cannot create, publish, edit, disable, close or fund campaigns, and cannot make payments",
  superadmin: "Creates, publishes and funds campaigns, makes payments and edits the project profile",
};

function StatTile({ label, value, suffix, hint }: { label: string; value: string; suffix?: string; hint?: string }) {
  return (
    <div className="rounded-[24px] bg-[#f7f4fe] border-[0.833px] border-solid border-[rgba(28,37,51,0.06)] px-[18px] py-[14px]">
      <p className="text-[12px] font-semibold leading-[18.6px] text-[#69728a]">{label}</p>
      <p className="pt-[2px] whitespace-nowrap">
        <span className="text-[26px] font-extrabold leading-[34px] text-[#8a3ffc]">{value}</span>
        {suffix && <span className="text-[14px] font-semibold text-[#69728a]"> {suffix}</span>}
      </p>
      {hint && <p className="text-[12px] leading-[18px] text-[#98a0b4]">{hint}</p>}
    </div>
  );
}

type SignerDialogState = { mode: "add" } | { mode: "remove"; target: TeamMember } | { mode: "replace"; target: TeamMember };

function SignerChangeDialog({ state, candidates, signerCount, currentApproval, onClose, onGoToTeam, onPropose }: {
  state: SignerDialogState; candidates: TeamMember[]; signerCount: number; currentApproval: number;
  onClose: () => void; onGoToTeam: () => void;
  onPropose: (picked: TeamMember | null) => void;
}) {
  const nextCount = state.mode === "add" ? signerCount + 1 : state.mode === "remove" ? signerCount - 1 : signerCount;
  const [picked, setPicked] = useState<string>(candidates[0]?._id ?? "");
  const chosen = candidates.find(c => c._id === picked) ?? null;
  const needsPick = state.mode !== "remove";
  const title = state.mode === "add" ? "Add signer" : state.mode === "remove" ? `Remove ${state.target.name}` : `Replace ${state.target.name}`;

  if (needsPick && candidates.length === 0) {
    return (
      <Modal
        title={title} onClose={onClose}
        footer={<>
          <GhostButton onClick={onClose}>Close</GhostButton>
          <PrimaryButton glow onClick={onGoToTeam}>Go to Team</PrimaryButton>
        </>}
      >
        <div className="flex flex-col items-center text-center px-[8px] py-[8px]">
          <span className="grid place-items-center size-[56px] rounded-[16px] bg-[rgba(138,63,252,0.1)]">
            <img src={`${ICON}/invitations-empty.svg`} alt="" className="size-[26px]" />
          </span>
          <p className="pt-[14px] text-[15px] font-semibold text-[#1c2533]">No Super Admins available</p>
          <p className="pt-[6px] text-[13px] leading-[20.15px] text-[#69728a]">
            Only Super Admins who aren&apos;t signers yet can be added. Invite one with Add Admin, or promote an Admin to Super Admin from Team.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={title} onClose={onClose}
      footer={<>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton glow disabled={needsPick && !chosen} onClick={() => onPropose(chosen)}>
          {state.mode === "remove" ? "Propose removal" : state.mode === "replace" ? "Propose replacement" : "Propose signer"}
        </PrimaryButton>
      </>}
    >
      {state.mode === "remove" ? (
        <div className="flex items-center gap-[10px] px-[14px] py-[10px] rounded-[20px] bg-[rgba(248,113,113,0.08)] border-[0.833px] border-solid border-[rgba(228,84,91,0.3)]">
          <span className="grid place-items-center size-[34px] rounded-full bg-[rgba(228,84,91,0.12)] text-[13px] font-bold text-[#e4545b] shrink-0">{(state.target.name || "?").charAt(0).toUpperCase()}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13.5px] font-semibold text-[#1c2533] truncate">{state.target.name}</span>
            <span className="block text-[12px] text-[#69728a]">Stops confirming proposals. Their role stays the same.</span>
          </span>
        </div>
      ) : (
        <>
          <p className="text-[13.5px] leading-[21.6px] text-[#3d485c]">
            {state.mode === "add" ? "Choose the Super Admin to add as a signer." : `Choose the Super Admin who will take ${state.target.name}'s place as a signer.`}
          </p>
          <div role="radiogroup" aria-label="Super Admin" className="flex flex-col gap-[8px] pt-[12px] max-h-[240px] overflow-y-auto">
            {candidates.map(c => {
              const sel = c._id === picked;
              return (
                <button
                  key={c._id} type="button" role="radio" aria-checked={sel} onClick={() => setPicked(c._id)}
                  className={`flex items-center gap-[10px] px-[14px] py-[10px] rounded-[20px] border-[0.833px] border-solid text-left transition-colors ${sel ? "bg-[rgba(138,63,252,0.08)] border-[#8a3ffc]" : "bg-[#f7f4fe] border-[rgba(28,37,51,0.09)] hover:border-[rgba(138,63,252,0.4)]"}`}
                >
                  <span className="grid place-items-center size-[34px] rounded-full bg-[rgba(138,63,252,0.1)] text-[13px] font-bold text-[#8a3ffc] shrink-0">{(c.name || "?").charAt(0).toUpperCase()}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-semibold text-[#1c2533] truncate">{c.name}</span>
                    {c.email && <span className={`block text-[11.5px] text-[#69728a] truncate ${MONO}`}>{c.email}</span>}
                  </span>
                  <span className={`grid place-items-center size-[18px] rounded-full border-[1.5px] border-solid shrink-0 ${sel ? "border-[#8a3ffc]" : "border-[rgba(28,37,51,0.25)]"}`}>
                    {sel && <span className="size-[8px] rounded-full bg-[#8a3ffc]" />}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-[14px] px-[16px] py-[12px] rounded-[20px] bg-[rgba(138,63,252,0.1)] border-[0.833px] border-solid border-[rgba(138,63,252,0.24)] text-[13px] leading-[20.15px] text-[#6e2bd8]">
        This creates a proposal. It takes effect once <b>{currentApproval} of {signerCount}</b> current signer{signerCount === 1 ? "" : "s"} confirm
        {state.mode !== "replace" && <>, then any proposal needs <b>{requiredApprovals(nextCount)} out of {nextCount}</b></>}.
      </div>
    </Modal>
  );
}

function TransferOwnershipDialog({ candidates, approvalsNeeded, signerCount, onClose, onGoToTeam, onPropose }: {
  candidates: TeamMember[]; approvalsNeeded: number; signerCount: number;
  onClose: () => void; onGoToTeam: () => void; onPropose: (member: TeamMember) => void;
}) {
  const [picked, setPicked] = useState<string>("");
  const chosen = candidates.find(c => c._id === picked) ?? null;

  if (candidates.length === 0) {
    return (
      <Modal
        title="Transfer ownership" onClose={onClose}
        footer={<>
          <GhostButton onClick={onClose}>Close</GhostButton>
          <PrimaryButton glow onClick={onGoToTeam}>Go to Team</PrimaryButton>
        </>}
      >
        <p className="text-[13px] leading-[20.15px] text-[#69728a]">
          Ownership can only go to an existing Super Admin. Invite one with Add Admin, or promote an Admin to Super Admin, then come back here.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Transfer ownership" onClose={onClose}
      footer={<>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton glow disabled={!chosen} onClick={() => chosen && onPropose(chosen)}>Propose transfer</PrimaryButton>
      </>}
    >
      <div className="flex gap-[12px] items-start px-[16px] py-[12px] rounded-[24px] bg-[rgba(248,113,113,0.08)] border-[0.833px] border-solid border-[rgba(228,84,91,0.3)]">
        <img src={`${ICON}/warning.svg`} alt="" className="size-[18px] mt-px shrink-0" />
        <p className="text-[12.5px] leading-[19.4px] text-[#3d485c]">
          The new Owner gets full control, including managing and removing Super Admins. You stay on as a Super Admin and signer until the new Owner proposes otherwise.
        </p>
      </div>
      <p className="pt-[14px] text-[13.5px] leading-[21.6px] text-[#3d485c]">Choose the Super Admin who will own this hub.</p>
      <div role="radiogroup" aria-label="New Owner" className="flex flex-col gap-[8px] pt-[10px] max-h-[240px] overflow-y-auto">
        {candidates.map(c => {
          const sel = c._id === picked;
          return (
            <button
              key={c._id} type="button" role="radio" aria-checked={sel} onClick={() => setPicked(c._id)}
              className={`flex items-center gap-[10px] px-[14px] py-[10px] rounded-[20px] border-[0.833px] border-solid text-left transition-colors ${sel ? "bg-[rgba(138,63,252,0.08)] border-[#8a3ffc]" : "bg-[#f7f4fe] border-[rgba(28,37,51,0.09)] hover:border-[rgba(138,63,252,0.4)]"}`}
            >
              <span className="grid place-items-center size-[34px] rounded-full bg-[rgba(138,63,252,0.1)] text-[13px] font-bold text-[#8a3ffc] shrink-0">{(c.name || "?").charAt(0).toUpperCase()}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-semibold text-[#1c2533] truncate">{c.name}</span>
                {c.email && <span className={`block text-[11.5px] text-[#69728a] truncate ${MONO}`}>{c.email}</span>}
              </span>
              <span className={`grid place-items-center size-[18px] rounded-full border-[1.5px] border-solid shrink-0 ${sel ? "border-[#8a3ffc]" : "border-[rgba(28,37,51,0.25)]"}`}>
                {sel && <span className="size-[8px] rounded-full bg-[#8a3ffc]" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-[14px] px-[16px] py-[12px] rounded-[20px] bg-[rgba(138,63,252,0.1)] border-[0.833px] border-solid border-[rgba(138,63,252,0.24)] text-[13px] leading-[20.15px] text-[#6e2bd8]">
        This creates a proposal signed with your wallet. Ownership moves once <b>{approvalsNeeded} of {signerCount}</b> signer{signerCount === 1 ? "" : "s"} confirm.
      </div>
    </Modal>
  );
}

function AddAdminDialog({ hubName, roles, existingEmails, onClose, onPropose }: {
  hubName: string; roles: BackendRole[]; existingEmails: string[];
  onClose: () => void; onPropose: (email: string, role: BackendRole) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BackendRole>(roles[0] ?? "admin");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) { setError("Enter a valid email address."); return; }
    if (existingEmails.some(x => x.toLowerCase() === clean)) { setError("This email is already on the team or has a pending invitation."); return; }
    onPropose(clean, role);
  };

  return (
    <form onSubmit={submit}>
      <Modal
        title="Add Admin" onClose={onClose}
        footer={<>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" glow><img src={`${ICON}/plus-white.svg`} alt="" className="size-[16px]" />Propose invitation</PrimaryButton>
        </>}
      >
        <p className="text-[13.5px] leading-[21.6px] text-[#3d485c]">
          We&apos;ll email an invitation to join <b className="font-bold">{hubName}</b>. They have no access until they sign in with that email, set a password and connect a wallet. Sending it needs approval from your signers.
        </p>
        <label className="flex flex-col gap-[7px] pt-[16px]">
          <span className="text-[13px] font-semibold leading-[20.15px] text-[#3d485c]">Email address</span>
          <input
            type="email" autoFocus value={email} placeholder="name@example.com"
            onChange={e => { setEmail(e.target.value); setError(""); }}
            className={`h-[44.6px] px-[13px] rounded-[12px] bg-[#f4f1fc] border-[0.833px] border-solid border-[rgba(28,37,51,0.15)] text-[14px] text-[#1c2533] placeholder:text-[#98a0b4] outline-none focus:border-[#8a3ffc] focus:shadow-[0_0_0_3px_rgba(138,63,252,0.1)] ${MONO}`}
          />
          {error && <span role="alert" className="text-[12.5px] text-[#e4545b]">{error}</span>}
        </label>
        <label className="flex flex-col gap-[7px] pt-[16px] pb-[2px]">
          <span className="text-[13px] font-semibold leading-[20.15px] text-[#3d485c]">Access role</span>
          <Select ariaLabel="Access role" value={role} onChange={v => setRole(v as BackendRole)} options={roles.map(r => ({ value: r, label: ROLE_LABEL[r] }))} disabled={roles.length < 2} />
          <span className="text-[12.5px] leading-[18.75px] text-[#69728a]">{ROLE_HINT[role]}</span>
        </label>
      </Modal>
    </form>
  );
}

function ManageMemberDialog({ member, memberRole, isSelf, actorRole, signer, onOpenSigners, onClose, onRevoke, onPropose }: {
  member: TeamMember; memberRole: StudioRole; isSelf: boolean; actorRole: StudioRole; signer: boolean;
  onOpenSigners: () => void; onClose: () => void; onRevoke: () => void; onPropose: (role: BackendRole) => void;
}) {
  const [role, setRole] = useState<BackendRole>(member.role);

  const roleLocked = isSelf || memberRole === "owner";
  const roleOptions: BackendRole[] = roleLocked ? [member.role] : assignableRoles(actorRole);
  const changed = role !== member.role;

  return (
    <Modal
      title={`Manage ${member.name}`} onClose={onClose}
      footer={<>
        {!isSelf && memberRole !== "owner" && <GhostButton danger onClick={onRevoke}>Revoke access</GhostButton>}
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton glow disabled={!changed} onClick={() => onPropose(role)}>Propose changes</PrimaryButton>
      </>}
    >
      <div className="flex flex-wrap items-center gap-[8px]">
        {member.email && <span className={`px-[8px] py-[3px] rounded-[40px] bg-[#f4f1fc] border-[0.833px] border-solid border-[rgba(28,37,51,0.09)] text-[12.5px] leading-[19.4px] text-[#3d485c] ${MONO}`}>{member.email}</span>}
        <span className="text-[12.5px] leading-[19.4px] text-[#69728a]">{ROLE_LABEL[memberRole]}</span>
      </div>
      <p className="pt-[16px] text-[13px] leading-[20.8px] text-[#3d485c]">Each change is submitted as a proposal for your signers to decide.</p>
      <label className="flex flex-col gap-[7px] pt-[16px]">
        <span className="text-[13px] font-semibold leading-[20.15px] text-[#3d485c]">Role</span>
        {memberRole === "owner"
          ? <Select ariaLabel="Role" value="owner" onChange={() => {}} options={[{ value: "owner", label: "Owner" }]} disabled height={44} />
          : <Select ariaLabel="Role" value={role} onChange={v => setRole(v as BackendRole)} options={roleOptions.map(r => ({ value: r, label: ROLE_LABEL[r] }))} disabled={roleOptions.length < 2} height={44} />}
      </label>
      <div className="pt-[16px]">
        <div className="flex items-center justify-between gap-4 px-[18px] py-[12px] rounded-[40px] bg-[#f4f1fc] border-[0.833px] border-solid border-[rgba(28,37,51,0.09)]">
          <div>
            <p className="text-[13.5px] font-semibold leading-[20.9px] text-[#1c2533]">Signer</p>
            <p className="pt-[3px] text-[12px] leading-[18.6px] text-[#69728a]">
              {memberRole === "admin" ? "Admins can't vote on proposals." : signer ? "This member votes on proposals." : "Not a signer yet. A signer can propose adding them in Signers."}
            </p>
          </div>
          {memberRole !== "admin" && (
            <button type="button" onClick={onOpenSigners} className="shrink-0 text-[13px] font-semibold text-[#8a3ffc] hover:underline">
              {actorRole !== "admin" ? "Manage signers" : "View signers"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
