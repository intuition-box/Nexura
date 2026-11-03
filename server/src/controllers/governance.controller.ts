import logger from "@/config/logger";
import { hub, hubAdmin } from "@/models/hub.model";
import { hubGovernance, governanceProposal } from "@/models/governance.model";
import { campaign } from "@/models/campaign.model";
import { OTP } from "@/models/otp.model";
import { parseDate } from "@/utils/dates";
import { createHubInvite } from "@/utils/hubInvite";
import { IN_ANOTHER_STUDIO, inAnotherStudio } from "@/utils/hubAccounts";
import { applyCampaignUpdate, prepareCampaignSaveBody } from "@/controllers/hub.controller";
import { EMAIL_RE, validateDiscordTaskConfig } from "@/utils/utils";
import { BAD_REQUEST, CONFLICT, CREATED, FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND, OK } from "@/utils/status.utils";

/*
 * Admin Management governance, modelled on a Safe multisig.
 *
 * Roles
 *  - Owner (hub.superAdmin): always a signer; the only one who can change or revoke Super Admins.
 *  - Super Admin: becomes a signer only through an approved proposal (being a Super Admin doesn't
 *    make you a signer, so promotions never silently change the confirmation count).
 *  - Signers (Owner + Super Admins added as signers) make every proposal and vote on it.
 *  - Admin: no governance actions.
 *  - Ownership can move to an existing Super Admin through a proposal only the Owner can make
 *    (e.g. when the Owner's email or wallet is compromised); the signers confirm it.
 *
 * Every proposal, approval, rejection and execution carries an EIP-712 signature from the admin's
 * wallet. An admin's first signature links that wallet; afterwards only that wallet can sign for them.
 * A proposal executes on the server once approvals reach the approval threshold, and is rejected
 * once rejections reach the rejection threshold. Votes only count while the voter is a signer.
 */

// ─── Signing (must match the studio client) ──────────────────────────────────
import { SIGNATURE_MAX_AGE_MS, recoverStudioSigner, signatureScheme } from "@/utils/studioSignature";
const KIND_TO_VERB = { propose: "Propose", approve: "Approve", reject: "Reject", execute: "Execute" } as const;
type SignatureKind = keyof typeof KIND_TO_VERB;

type Role = "owner" | "superadmin" | "admin";
type BackendRole = "superadmin" | "admin";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

// A campaign never ends immediately: an approved "end campaign" proposal gives participants this notice
const CAMPAIGN_END_NOTICE_MS = 7 * 24 * 60 * 60 * 1000;


// ─── Context: team, signers and thresholds for one hub ───────────────────────
async function loadContext(hubId: string) {
  const hubDoc = await hub.findById(hubId).select("superAdmin name").lean() as any;
  if (!hubDoc) throw new HttpError(NOT_FOUND, "hub not found");
  const admins = await hubAdmin.find({ hub: hubId }).select("_id name email role createdAt").lean() as any[];
  let gov = await hubGovernance.findOne({ hub: hubId });
  if (!gov) gov = await hubGovernance.create({ hub: hubId });

  const ownerId = hubDoc.superAdmin ? String(hubDoc.superAdmin) : null;
  const roleOf = (a: { _id: unknown; role?: string }): Role =>
    String(a._id) === ownerId ? "owner" : a.role === "superadmin" ? "superadmin" : "admin";
  const nominated = new Set((gov.signers ?? []).map(String));
  const signers = admins.filter(a => roleOf(a) === "owner" || (roleOf(a) === "superadmin" && nominated.has(String(a._id))));
  const signerIds = new Set(signers.map(a => String(a._id)));
  const n = Math.max(1, signers.length);
  const approval = Math.floor(n / 2) + 1;
  const thresholds = { approval, rejection: n - approval + 1 };
  const adminById = (id: string) => admins.find(a => String(a._id) === id);

  return { hubId, hubDoc, admins, gov, ownerId, roleOf, signers, signerIds, thresholds, adminById };
}
type Ctx = Awaited<ReturnType<typeof loadContext>>;

/** Resolves the calling admin (project hub admins only). */
async function requireMe(req: GlobalRequest, ctx: Ctx) {
  const me = ctx.adminById(String(req.id));
  if (!me) throw new HttpError(FORBIDDEN, "only admins of this hub can use Admin Management");
  return { id: String(me._id), name: String(me.name ?? ""), role: ctx.roleOf(me) };
}

function hubIdOf(req: GlobalRequest): string {
  const id = req.admin?.hub ? String(req.admin.hub) : "";
  if (!id) throw new HttpError(BAD_REQUEST, "create a hub to continue");
  return id;
}

// ─── Signature verification ──────────────────────────────────────────────────
type SignedBody = { signature?: unknown; message?: unknown; scheme?: unknown };

async function verifySignature(ctx: Ctx, me: { id: string; name: string }, kind: SignatureKind, proposal: { ref: string; title: string }, body: SignedBody) {
  const { signature, message } = body;
  const scheme = signatureScheme(body.scheme);
  if (typeof signature !== "string" || !signature.startsWith("0x")) throw new HttpError(BAD_REQUEST, "a wallet signature is required");
  if (!message || typeof message !== "object") throw new HttpError(BAD_REQUEST, "the signed message is required");
  const m = message as Record<string, unknown>;
  for (const f of ["hub", "action", "proposal", "proposalId", "signer", "signedAt"]) {
    if (typeof m[f] !== "string") throw new HttpError(BAD_REQUEST, `signed message is missing ${f}`);
  }
  if (m.action !== KIND_TO_VERB[kind]) throw new HttpError(BAD_REQUEST, "the signature is for a different action");
  if (m.proposalId !== proposal.ref || m.proposal !== proposal.title) throw new HttpError(BAD_REQUEST, "the signature is for a different proposal");
  if (!String(m.signer).includes(`(${me.id})`)) throw new HttpError(BAD_REQUEST, "the signature names a different admin");
  const signedAt = new Date(String(m.signedAt));
  if (isNaN(signedAt.getTime()) || Math.abs(Date.now() - signedAt.getTime()) > SIGNATURE_MAX_AGE_MS) {
    throw new HttpError(BAD_REQUEST, "the signature has expired, sign again");
  }

  let address: string;
  try {
    address = recoverStudioSigner(m, signature, scheme);
  } catch {
    throw new HttpError(BAD_REQUEST, "the wallet signature is not valid");
  }

  const wallets = ctx.gov.signerWallets as unknown as Map<string, string>;
  const linked = wallets.get(me.id);
  if (linked) {
    if (linked.toLowerCase() !== address.toLowerCase()) {
      throw new HttpError(FORBIDDEN, `sign with the wallet linked to your account (${linked.slice(0, 6)}…${linked.slice(-4)})`);
    }
  } else {
    // First signature: link this wallet, unless another admin of the hub already uses it
    for (const [adminId, wallet] of wallets.entries()) {
      if (adminId !== me.id && wallet.toLowerCase() === address.toLowerCase()) {
        throw new HttpError(FORBIDDEN, "this wallet is already linked to another admin of this hub");
      }
    }
    wallets.set(me.id, address);
    ctx.gov.markModified("signerWallets");
    await ctx.gov.save();
  }

  return { admin: me.id, name: me.name, kind, address, signature, scheme, message: m, signedAt };
}

// ─── Proposal validation (who can propose what) ──────────────────────────────
function pendingSignerChangeFor(pending: any[], adminId: string) {
  return pending.some(p => (p.action?.kind === "signer" && p.action.adminId === adminId)
    || (p.action?.kind === "replaceSigner" && (p.action.oldId === adminId || p.action.newId === adminId)));
}

async function validateAction(ctx: Ctx, me: { id: string; role: Role }, raw: any, clientUrl: string) {
  if (!raw || typeof raw !== "object" || typeof raw.kind !== "string") throw new HttpError(BAD_REQUEST, "action is required");
  const pending = await governanceProposal.find({ hub: ctx.hubId, status: "pending" }).select("action").lean() as any[];
  const target =(id: unknown) => {
    const a = typeof id === "string" ? ctx.adminById(id) : undefined;
    if (!a) throw new HttpError(NOT_FOUND, "admin not found in your hub");
    return a;
  };

  switch (raw.kind) {
    case "thresholds":
      throw new HttpError(BAD_REQUEST, "required confirmations are set automatically");
    case "invite": {
      const email = String(raw.email ?? "").trim().toLowerCase();
      const role: BackendRole = raw.role === "superadmin" ? "superadmin" : "admin";
      if (!EMAIL_RE.test(email)) throw new HttpError(BAD_REQUEST, "enter a valid email address");
      if (role === "superadmin" && me.role !== "owner") throw new HttpError(FORBIDDEN, "only the Owner can invite Super Admins");
      if (await hubAdmin.exists({ email, hub: ctx.hubId })) throw new HttpError(BAD_REQUEST, "this email is already in your studio");
      if (await inAnotherStudio(email, ctx.hubId)) throw new HttpError(BAD_REQUEST, IN_ANOTHER_STUDIO);
      if (pending.some(p => p.action?.kind === "invite" && p.action.email === email)) throw new HttpError(BAD_REQUEST, "an invitation for this email is already pending");
      return { kind: "invite", email, role, clientUrl };
    }
    case "member": {
      const t = target(raw.adminId);
      const tRole = ctx.roleOf(t);
      const toRole: BackendRole = raw.toRole === "superadmin" ? "superadmin" : "admin";
      if (String(t._id) === me.id) throw new HttpError(BAD_REQUEST, "you cannot change your own role");
      if (tRole === "owner") throw new HttpError(FORBIDDEN, "the Owner's role cannot be changed");
      if ((tRole === "superadmin" || toRole === "superadmin") && me.role !== "owner") throw new HttpError(FORBIDDEN, "only the Owner can manage Super Admins");
      if (t.role === toRole) throw new HttpError(BAD_REQUEST, "that admin already has this role");
      return { kind: "member", adminId: String(t._id), adminName: t.name, fromRole: t.role, toRole };
    }
    case "revoke": {
      const t = target(raw.adminId);
      const tRole = ctx.roleOf(t);
      if (String(t._id) === me.id) throw new HttpError(BAD_REQUEST, "you cannot revoke your own access");
      if (tRole === "owner") throw new HttpError(FORBIDDEN, "the Owner's access cannot be revoked");
      if (tRole === "superadmin" && me.role !== "owner") throw new HttpError(FORBIDDEN, "only the Owner can revoke a Super Admin");
      return { kind: "revoke", adminId: String(t._id), adminName: t.name };
    }
    case "revokeInvite": {
      const id = typeof raw.inviteId === "string" ? raw.inviteId : "";
      const inv = /^[a-f0-9]{24}$/i.test(id) ? await OTP.findById(id).select("hubId email role").lean() as any : null;
      if (!inv || String(inv.hubId) !== ctx.hubId) throw new HttpError(NOT_FOUND, "invitation not found in your hub");
      const role: BackendRole = inv.role === "superadmin" ? "superadmin" : "admin";
      if (role === "superadmin" && me.role !== "owner") throw new HttpError(FORBIDDEN, "only the Owner can revoke a Super Admin invitation");
      if (pending.some(p => p.action?.kind === "revokeInvite" && p.action.inviteId === id)) throw new HttpError(BAD_REQUEST, "revoking this invitation is already proposed");
      return { kind: "revokeInvite", inviteId: id, email: String(inv.email ?? ""), role };
    }
    case "signer": {
      const t = target(raw.adminId);
      const id = String(t._id);
      const add = raw.add === true;
      if (pendingSignerChangeFor(pending, id)) throw new HttpError(BAD_REQUEST, "a signer change for this admin is already pending");
      if (add) {
        if (ctx.roleOf(t) !== "superadmin") throw new HttpError(BAD_REQUEST, "only Super Admins can be added as signers");
        if (ctx.signerIds.has(id)) throw new HttpError(BAD_REQUEST, "that admin is already a signer");
      } else {
        if (ctx.roleOf(t) === "owner") throw new HttpError(FORBIDDEN, "the Owner is always a signer");
        if (!ctx.signerIds.has(id)) throw new HttpError(BAD_REQUEST, "that admin is not a signer");
      }
      return { kind: "signer", adminId: id, adminName: t.name, add };
    }
    case "replaceSigner": {
      const oldT = target(raw.oldId);
      const newT = target(raw.newId);
      const oldId = String(oldT._id), newId = String(newT._id);
      if (ctx.roleOf(oldT) === "owner") throw new HttpError(FORBIDDEN, "the Owner is always a signer");
      if (!ctx.signerIds.has(oldId)) throw new HttpError(BAD_REQUEST, "the admin being replaced is not a signer");
      if (ctx.roleOf(newT) !== "superadmin" || ctx.signerIds.has(newId)) throw new HttpError(BAD_REQUEST, "pick a Super Admin who isn't a signer yet");
      if (pendingSignerChangeFor(pending, oldId) || pendingSignerChangeFor(pending, newId)) throw new HttpError(BAD_REQUEST, "a signer change for one of these admins is already pending");
      return { kind: "replaceSigner", oldId, oldName: oldT.name, newId, newName: newT.name };
    }
    case "transferOwnership": {
      if (me.role !== "owner") throw new HttpError(FORBIDDEN, "only the Owner can transfer ownership");
      const t = target(raw.newOwnerId);
      const id = String(t._id);
      if (id === me.id) throw new HttpError(BAD_REQUEST, "you are already the Owner");
      if (ctx.roleOf(t) !== "superadmin") throw new HttpError(BAD_REQUEST, "ownership can only go to an existing Super Admin");
      if (pending.some(p => p.action?.kind === "transferOwnership")) throw new HttpError(BAD_REQUEST, "an ownership transfer is already pending");
      const prev = ctx.adminById(me.id);
      return { kind: "transferOwnership", newOwnerId: id, newOwnerName: t.name, prevOwnerId: me.id, prevOwnerName: prev?.name ?? "" };
    }
    case "endCampaign": {
      const id = typeof raw.campaignId === "string" ? raw.campaignId : "";
      const c = /^[a-f0-9]{24}$/i.test(id) ? await campaign.findById(id).select("hub title status ends_at deletedAt").lean() as any : null;
      if (!c || String(c.hub) !== ctx.hubId || c.deletedAt) throw new HttpError(NOT_FOUND, "campaign not found in your hub");
      if (c.status === "Save") throw new HttpError(BAD_REQUEST, "drafts aren't live, so there's nothing to end");
      const endsAt = parseDate(c.ends_at);
      if (c.status === "Ended" || (endsAt && endsAt.getTime() <= Date.now())) throw new HttpError(BAD_REQUEST, "this campaign has already ended");
      if (pending.some(p => p.action?.kind === "endCampaign" && p.action.campaignId === id)) throw new HttpError(BAD_REQUEST, "ending this campaign is already proposed");
      return { kind: "endCampaign", campaignId: id, campaignTitle: String(c.title ?? ""), noticeDays: CAMPAIGN_END_NOTICE_MS / 86_400_000 };
    }
    case "editCampaign": {
      const id = typeof raw.campaignId === "string" ? raw.campaignId : "";
      const c = /^[a-f0-9]{24}$/i.test(id) ? await campaign.findById(id).select("hub title status ends_at deletedAt").lean() as any : null;
      if (!c || String(c.hub) !== ctx.hubId || c.deletedAt) throw new HttpError(NOT_FOUND, "campaign not found in your hub");
      if (c.status === "Save") throw new HttpError(BAD_REQUEST, "drafts aren't published, so they're edited directly");
      const endsAt = parseDate(c.ends_at);
      if (c.status === "Ended" || (endsAt && endsAt.getTime() <= Date.now())) throw new HttpError(BAD_REQUEST, "this campaign has already ended");
      if (pending.some(p => p.action?.kind === "editCampaign" && p.action.campaignId === id)) throw new HttpError(BAD_REQUEST, "changes to this campaign are already proposed; approve or reject that proposal first");

      const changes = raw.changes;
      if (!changes || typeof changes !== "object" || Array.isArray(changes)) throw new HttpError(BAD_REQUEST, "the proposed changes are missing");
      if (JSON.stringify(changes).length > 300_000) throw new HttpError(BAD_REQUEST, "the proposed changes are too large");
      // Only the fields the campaign builder saves
      const ALLOWED = ["title", "description", "nameOfProject", "starts_at", "ends_at", "maxParticipants", "reward", "stages", "rewardsEnabled", "rewardsConfig", "templateId", "builderState", "campaignQuests", "coverImage"];
      const body: Record<string, any> = {};
      for (const k of ALLOWED) if (changes[k] !== undefined) body[k] = changes[k];
      if (body.coverImage !== undefined && !(typeof body.coverImage === "string" && body.coverImage.startsWith("https://"))) delete body.coverImage;
      if (body.campaignQuests !== undefined) {
        if (!Array.isArray(body.campaignQuests) || body.campaignQuests.length > 500) throw new HttpError(BAD_REQUEST, "the proposed tasks are invalid");
        body.campaignQuests.forEach((q: any, i: number) => {
          const check = validateDiscordTaskConfig(q);
          if (!check.success) throw new HttpError(BAD_REQUEST, `task #${i + 1}: ${check.error}`);
        });
      }
      const bodyError = prepareCampaignSaveBody(body);
      if (bodyError) throw new HttpError(BAD_REQUEST, bodyError);
      return { kind: "editCampaign", campaignId: id, campaignTitle: String(body.title ?? c.title ?? ""), changes: body };
    }
    default:
      throw new HttpError(BAD_REQUEST, "this kind of change isn't supported by the server yet; it needs the latest server update");
  }
}

// ─── Tally + execution ───────────────────────────────────────────────────────
function tally(ctx: Ctx, proposal: any) {
  const latest = new Map<string, "approve" | "reject">();
  for (const s of proposal.signatures ?? []) {
    const id = String(s.admin);
    if (!ctx.signerIds.has(id)) continue;
    if (s.kind === "approve" || (s.kind === "propose" && id === String(proposal.proposedBy.id))) latest.set(id, "approve");
    else if (s.kind === "reject") latest.set(id, "reject");
  }
  let approvals = 0, rejections = 0;
  for (const v of latest.values()) v === "approve" ? approvals++ : rejections++;
  return { approvals, rejections, votes: latest };
}

/** Applies an approved action. Returns the invite link and code when an invite email couldn't be sent. */
async function runAction(ctx: Ctx, action: any, proposalRef: string): Promise<{ link: string; code: string; emailError: string } | void> {
  const gov = ctx.gov;
  const signerList = () => (gov.signers ?? []).map(String);
  const setSigners = (ids: string[]) => { (gov as any).signers = Array.from(new Set(ids)); };

  switch (action.kind) {
    case "thresholds":
      break;
    case "invite": {
      // The proposal has been approved, so the invitation is created even if the email can't go out
      const result = await createHubInvite({ hubId: ctx.hubId, email: action.email, role: action.role, clientUrl: action.clientUrl, keepIfEmailFails: true });
      return result.emailed ? undefined : { link: result.link, code: result.code, emailError: result.emailError };
    }
    case "member": {
      const t = ctx.adminById(action.adminId);
      if (!t) throw new Error("that admin is no longer in the hub");
      if (ctx.roleOf(t) === "owner") throw new Error("the Owner's role cannot be changed");
      await hubAdmin.findByIdAndUpdate(action.adminId, { role: action.toRole });
      if (action.toRole === "admin") setSigners(signerList().filter(id => id !== action.adminId)); // Admins can't sign
      break;
    }
    case "revoke": {
      const t = ctx.adminById(action.adminId);
      if (!t) throw new Error("that admin is no longer in the hub");
      if (ctx.roleOf(t) === "owner") throw new Error("the Owner's access cannot be revoked");
      await hubAdmin.findByIdAndDelete(action.adminId);
      setSigners(signerList().filter(id => id !== action.adminId));
      (gov.signerWallets as unknown as Map<string, string>).delete(action.adminId);
      gov.markModified("signerWallets");
      break;
    }
    case "revokeInvite": {
      const inv = await OTP.findById(action.inviteId).select("hubId").lean() as any;
      if (inv) {
        if (String(inv.hubId) !== ctx.hubId) throw new Error("the invitation belongs to another hub");
        await OTP.findByIdAndDelete(action.inviteId);
        return;
      }
      // Gone already: fine if it expired, but if they accepted, revoking the invite wouldn't remove them
      if (ctx.admins.some(a => String(a.email ?? "").toLowerCase() === String(action.email).toLowerCase())) {
        throw new Error(`${action.email} already accepted the invitation; propose revoking their access instead`);
      }
      return;
    }
    case "signer": {
      const t = ctx.adminById(action.adminId);
      if (!t) throw new Error("that admin is no longer in the hub");
      if (action.add) {
        if (ctx.roleOf(t) !== "superadmin") throw new Error("only Super Admins can be signers");
        setSigners([...signerList(), action.adminId]);
      } else {
        setSigners(signerList().filter(id => id !== action.adminId));
      }
      break;
    }
    case "replaceSigner": {
      const t = ctx.adminById(action.newId);
      if (!t || ctx.roleOf(t) !== "superadmin") throw new Error("the replacement must be a Super Admin of this hub");
      setSigners([...signerList().filter(id => id !== action.oldId), action.newId]);
      break;
    }
    case "transferOwnership": {
      if (ctx.ownerId !== action.prevOwnerId) throw new Error("ownership has already changed since this was proposed");
      const t = ctx.adminById(action.newOwnerId);
      if (!t || ctx.roleOf(t) !== "superadmin") throw new Error("the new Owner must still be a Super Admin of this hub");
      await hub.findByIdAndUpdate(ctx.hubId, { superAdmin: action.newOwnerId });
      // The new Owner signs as Owner; the previous Owner stays a Super Admin and keeps signing,
      // so the confirmation count doesn't drop. The new Owner can propose removing them.
      setSigners([...signerList().filter(id => id !== action.newOwnerId), action.prevOwnerId]);
      break;
    }
    case "endCampaign": {
      // The contract that will enforce this isn't deployed yet. Until then the end date moves to
      // 7 days after approval (or stays put if the campaign already ends sooner).
      const c = await campaign.findById(action.campaignId);
      if (!c || String(c.hub) !== ctx.hubId || c.deletedAt) throw new Error("the campaign no longer exists");
      const now = Date.now();
      const currentEnd = parseDate(c.ends_at);
      if (c.status === "Ended" || (currentEnd && currentEnd.getTime() <= now)) throw new Error("the campaign has already ended");
      const noticeEnd = new Date(now + CAMPAIGN_END_NOTICE_MS);
      const endsAt = currentEnd && currentEnd < noticeEnd ? currentEnd : noticeEnd;
      c.ends_at = endsAt.toISOString();
      (c as any).endProposal = { ref: proposalRef, executedAt: new Date(now), endsAt: endsAt.toISOString() };
      await c.save();
      return; // the governance record itself doesn't change
    }
    case "editCampaign": {
      // Applies the edit with the same rules as the builder's save (dates, rewards, quests)
      const hubFound = await hub.findById(ctx.hubId).lean();
      if (!hubFound) throw new Error("the hub no longer exists");
      const c = await campaign.findById(action.campaignId).select("hub deletedAt").lean() as any;
      if (!c || String(c.hub) !== ctx.hubId || c.deletedAt) throw new Error("the campaign no longer exists");
      const changes = { ...action.changes };
      await applyCampaignUpdate(action.campaignId, hubFound, changes, Array.isArray(changes.campaignQuests) ? changes.campaignQuests : null);
      return; // the governance record itself doesn't change
    }
    default:
      throw new Error("unknown action");
  }
  await gov.save();
}

/**
 * Settles a pending proposal. Reaching the approvals only makes it ready: the change is applied
 * when a signer executes it with their wallet (`execute`), as in Safe. Rejection is automatic:
 * at the rejection threshold, or once it can no longer get enough approvals.
 * Execution failures are kept so it can be retried.
 */
async function settle(ctx: Ctx, proposal: any, execute = false) {
  if (proposal.status !== "pending") return;
  const { approvals, rejections } = tally(ctx, proposal);
  if (approvals >= ctx.thresholds.approval) {
    if (!execute) { await proposal.save(); return; } // ready, waiting for a signer to execute
    const staleLock = new Date(Date.now() - 2 * 60 * 1000);
    const locked = await governanceProposal.updateOne(
      { _id: proposal._id, status: "pending", $or: [{ executingAt: null }, { executingAt: { $lt: staleLock } }] },
      { $set: { executingAt: new Date() } }
    );
    if (!locked.modifiedCount) throw new HttpError(CONFLICT, "this proposal is already being executed");
    proposal.executingAt = null;
    proposal.markModified("executingAt");
    try {
      const share = await runAction(ctx, proposal.action, proposal.ref);
      proposal.inviteShare = share ?? null;
      proposal.status = "executed";
      proposal.resolvedAt = new Date();
      proposal.resolvedCount = approvals;
      proposal.executionError = null;
    } catch (err: any) {
      logger.error("governance execution failed:", err);
      proposal.executionError = err?.message || "the change could not be applied";
    }
  } else if (rejections >= ctx.thresholds.rejection || cannotPass(ctx, proposal)) {
    proposal.status = "rejected";
    proposal.resolvedAt = new Date();
    proposal.resolvedCount = rejections;
  }
  await proposal.save();
}

/**
 * True when the signers who haven't voted yet can't bring the approvals up to the threshold,
 * e.g. 2 signers needing 2 approvals with one approval and one rejection. Such a proposal fails
 * right away instead of waiting forever.
 */
function cannotPass(ctx: Ctx, proposal: any): boolean {
  const { approvals, votes } = tally(ctx, proposal);
  const notVoted = [...ctx.signerIds].filter(id => !votes.has(id)).length;
  return approvals + notVoted < ctx.thresholds.approval;
}

/** Fails pending proposals that can no longer pass, e.g. after a vote, a signer leaving or a threshold change. */
async function rejectUnpassable(ctx: Ctx) {
  const pending = await governanceProposal.find({ hub: ctx.hubId, status: "pending" });
  for (const p of pending) {
    if (cannotPass(ctx, p)) await settle(ctx, p);
  }
}

// ─── Response shape (matches the studio client) ──────────────────────────────
function serializeProposal(ctx: Ctx, p: any, meId: string) {
  const { votes } = tally(ctx, p);
  const allVotes: Record<string, "approve" | "reject"> = {};
  for (const s of p.signatures ?? []) {
    const id = String(s.admin);
    if (s.kind === "approve" || (s.kind === "propose" && ctx.signerIds.has(id))) allVotes[id] = "approve";
    else if (s.kind === "reject") allVotes[id] = "reject";
  }
  for (const [id, v] of votes) allVotes[id] = v;
  const signatures: Record<string, unknown> = {};
  for (const s of p.signatures ?? []) {
    const key = s.kind === "execute" ? `execute:${String(s.admin)}` : String(s.admin);
    if (s.kind === "propose" && signatures[key]) continue;
    signatures[key] = { address: s.address, signature: s.signature, message: JSON.stringify(s.message), signedAt: new Date(s.signedAt).toISOString() };
  }
  return {
    id: p.ref,
    title: p.title,
    change: p.change,
    action: p.action,
    proposedBy: { id: String(p.proposedBy.id), name: p.proposedBy.name },
    createdAt: new Date(p.createdAt).toISOString(),
    votes: allVotes,
    signatures,
    status: p.status,
    resolvedAt: p.resolvedAt ? new Date(p.resolvedAt).toISOString() : undefined,
    resolvedCount: p.resolvedCount ?? undefined,
    executionError: p.executionError ?? undefined,
    // The code lets someone register with that email, so only signers see it
    inviteShare: p.inviteShare && ctx.signerIds.has(meId) ? p.inviteShare : undefined,
    readByMe: (p.readBy ?? []).some((id: unknown) => String(id) === meId),
  };
}

async function governanceState(ctx: Ctx, meId: string) {
  await rejectUnpassable(ctx);
  const me = ctx.adminById(meId);
  const seesProposals = !!me && ctx.roleOf(me) !== "admin";
  const proposals = seesProposals ? await governanceProposal.find({ hub: ctx.hubId }).sort({ createdAt: -1 }).limit(200).lean() : [];
  const wallets = ctx.gov.signerWallets as unknown as Map<string, string>;
  return {
    ownerId: ctx.ownerId,
    meId,
    signerIds: Array.from(ctx.signerIds),
    signerWallets: Object.fromEntries(wallets.entries()),
    thresholds: ctx.thresholds,
    proposals: proposals.map(p => serializeProposal(ctx, p, meId)),
  };
}

function handleError(res: GlobalResponse, error: any, fallback: string) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  logger.error(error);
  res.status(INTERNAL_SERVER_ERROR).json({ error: fallback });
}

// ─── Handlers ────────────────────────────────────────────────────────────────
export const getGovernance = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext(hubIdOf(req));
    const me = await requireMe(req, ctx);
    res.status(OK).json(await governanceState(ctx, me.id));
  } catch (error) {
    handleError(res, error, "error loading admin management");
  }
};

export const createGovernanceProposal = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext(hubIdOf(req));
    const me = await requireMe(req, ctx);
    if (!ctx.signerIds.has(me.id)) throw new HttpError(FORBIDDEN, "only signers can make proposals; ask a signer to add you");

    const { ref, title, change, action, clientUrl } = req.body ?? {};
    if (typeof ref !== "string" || !/^[a-z0-9-]{6,64}$/i.test(ref)) throw new HttpError(BAD_REQUEST, "proposal id is invalid");
    if (typeof title !== "string" || !title.trim() || title.length > 200) throw new HttpError(BAD_REQUEST, "proposal title is required");
    if (await governanceProposal.exists({ hub: ctx.hubId, ref })) throw new HttpError(BAD_REQUEST, "this proposal already exists");

    const origin = typeof clientUrl === "string" && /^https?:\/\//.test(clientUrl) ? clientUrl : "";
    const normalized = await validateAction(ctx, me, action, origin);
    const sig = await verifySignature(ctx, me, "propose", { ref, title }, req.body);

    const proposal = await governanceProposal.create({
      hub: ctx.hubId,
      ref,
      title: title.trim(),
      change: typeof change === "string" ? change.slice(0, 500) : "",
      action: normalized,
      proposedBy: { id: me.id, name: me.name },
      signatures: [sig],
    });
    await settle(ctx, proposal);
    const fresh = await loadContext(ctx.hubId);
    res.status(CREATED).json(await governanceState(fresh, me.id));
  } catch (error) {
    handleError(res, error, "error creating proposal");
  }
};

export const checkGovernanceProposal = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext(hubIdOf(req));
    const me = await requireMe(req, ctx);
    if (!ctx.signerIds.has(me.id)) throw new HttpError(FORBIDDEN, "only signers can make proposals; ask a signer to add you");
    await validateAction(ctx, me, req.body?.action, "");
    res.status(OK).json({ ok: true });
  } catch (error) {
    handleError(res, error, "error checking proposal");
  }
};

export const voteOnGovernanceProposal = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext(hubIdOf(req));
    const me = await requireMe(req, ctx);
    const vote = req.body?.vote;
    if (vote !== "approve" && vote !== "reject") throw new HttpError(BAD_REQUEST, "vote must be approve or reject");
    if (!ctx.signerIds.has(me.id)) throw new HttpError(FORBIDDEN, "only signers can approve or reject proposals");

    const proposal = await governanceProposal.findOne({ hub: ctx.hubId, ref: req.params.ref });
    if (!proposal) throw new HttpError(NOT_FOUND, "proposal not found");
    if (proposal.status !== "pending") throw new HttpError(BAD_REQUEST, "this proposal is already decided");
    if (String(proposal.proposedBy?.id) === me.id) throw new HttpError(BAD_REQUEST, "you proposed this, so your signature is already counted");
    if (proposal.signatures.some((s: any) => String(s.admin) === me.id && (s.kind === "approve" || s.kind === "reject"))) {
      throw new HttpError(BAD_REQUEST, "you have already voted on this proposal");
    }

    const sig = await verifySignature(ctx, me, vote, { ref: proposal.ref, title: proposal.title }, req.body);
    proposal.signatures.push(sig as any);
    await settle(ctx, proposal);
    const fresh = await loadContext(ctx.hubId);
    res.status(OK).json(await governanceState(fresh, me.id));
  } catch (error) {
    handleError(res, error, "error recording vote");
  }
};

export const executeGovernanceProposal = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext(hubIdOf(req));
    const me = await requireMe(req, ctx);
    const proposal = await governanceProposal.findOne({ hub: ctx.hubId, ref: req.params.ref });
    if (!proposal) throw new HttpError(NOT_FOUND, "proposal not found");
    if (proposal.status !== "pending") throw new HttpError(BAD_REQUEST, "this proposal is already decided");
    if (!ctx.signerIds.has(me.id) && String(proposal.proposedBy?.id) !== me.id) {
      throw new HttpError(FORBIDDEN, "only signers or the proposer can execute a proposal");
    }
    const { approvals } = tally(ctx, proposal);
    if (approvals < ctx.thresholds.approval) {
      throw new HttpError(BAD_REQUEST, `needs ${ctx.thresholds.approval} confirmations, has ${approvals}`);
    }

    const sig = await verifySignature(ctx, me, "execute", { ref: proposal.ref, title: proposal.title }, req.body);
    proposal.signatures.push(sig as any);
    await settle(ctx, proposal, true);
    const fresh = await loadContext(ctx.hubId);
    res.status(OK).json(await governanceState(fresh, me.id));
  } catch (error) {
    handleError(res, error, "error executing proposal");
  }
};

/** POST /hub/governance/notifications/read { refs?: string[] }: marks proposal notifications read for me (all when refs is omitted). */
export const markGovernanceNotificationsRead = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext(hubIdOf(req));
    const me = await requireMe(req, ctx);
    const refs = req.body?.refs;
    const filter: Record<string, unknown> = { hub: ctx.hubId };
    if (Array.isArray(refs)) {
      const clean = refs.map(String).filter(r => /^[a-z0-9-]{6,64}$/i.test(r)).slice(0, 200);
      if (!clean.length) throw new HttpError(BAD_REQUEST, "no notifications to mark as read");
      filter.ref = { $in: clean };
    }
    await governanceProposal.updateMany(filter, { $addToSet: { readBy: me.id } });
    res.status(OK).json(await governanceState(ctx, me.id));
  } catch (error) {
    handleError(res, error, "error marking notifications as read");
  }
};
