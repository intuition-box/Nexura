import logger from "@/config/logger";
import { admin } from "@/models/admin.model";
import { hub } from "@/models/hub.model";
import { platformGovernance, platformProposal } from "@/models/platformGovernance.model";
import { ADMIN_CAMPAIGN_SYSTEM_KEY } from "@/utils/adminCampaignHub";
import { sendEmailToAdmin } from "@/utils/sendMail";
import { EMAIL_RE, generateOTP } from "@/utils/utils";
import { BAD_REQUEST, CONFLICT, CREATED, FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND, OK } from "@/utils/status.utils";
import { SIGNATURE_MAX_AGE_MS, recoverStudioSigner, signatureScheme } from "@/utils/studioSignature";
import { USERNAME_RULE } from "@/utils/hubAccounts";
import { MAX_USERNAME_CHANGES } from "@/controllers/hub.controller";

/*
 * Admin Management governance for the Nexura admin dashboard. The same rules as the Studio's
 * (controllers/governance.controller.ts), applied to platform admins:
 *
 *  - Owner: always a signer; the only one who can invite, change or revoke Super Admins.
 *  - Super Admin: becomes a signer only through an approved proposal.
 *  - Signers (Owner + Super Admins added as signers) make every proposal and vote on it.
 *  - Admin: no governance actions.
 *  - Ownership moves to an existing Super Admin through a proposal only the Owner can make.
 *
 * Every proposal, approval, rejection and execution is an EIP-712 signature from the admin's linked
 * wallet (admin.linkedWallet, set by their first wallet sign-in). A proposal executes once approvals
 * reach a majority of signers and a signer executes it; it is rejected once it can no longer pass.
 * Team changes have no other way in: the direct add/remove/role routes are closed.
 */

// The first Owner of the admin dashboard (PLATFORM_OWNER_EMAIL overrides it). Applied once; ownership can be transferred after.
const DEFAULT_OWNER_EMAIL = "onlyrchris@gmail.com";

const KIND_TO_VERB = { propose: "Propose", approve: "Approve", reject: "Reject", execute: "Execute" } as const;
type SignatureKind = keyof typeof KIND_TO_VERB;
type Role = "owner" | "superadmin" | "admin";
type BackendRole = "superadmin" | "admin";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const nameOf = (a: { username?: string | null; email?: string }) => a.username?.trim() || String(a.email ?? "").split("@")[0] || "Admin";

// ─── Context: team, signers and thresholds ───────────────────────────────────
async function loadContext() {
  const admins = await admin.find({ verified: true }).select("_id username email role createdAt lastActivity linkedWallet usernameChanges twoFactorEnabled testAppInvite").sort({ createdAt: 1 }).lean() as any[];
  let gov = await platformGovernance.findOne({ key: "platform" });
  if (!gov) gov = await platformGovernance.create({ key: "platform" });

  // The Owner: kept on the governance record. PLATFORM_OWNER_EMAIL names it once (it can be
  // transferred afterwards); otherwise it's the owner of the official Nexura hub when that's a
  // platform admin, else the longest-serving Super Admin.
  const present = (id: unknown) => !!id && admins.some(a => String(a._id) === String(id));
  const seedEmail = String(process.env.PLATFORM_OWNER_EMAIL || DEFAULT_OWNER_EMAIL).trim().toLowerCase();
  const seeded = seedEmail && admins.find(a => String(a.email ?? "").toLowerCase() === seedEmail);
  if (seeded && gov.ownerSeedEmail !== seedEmail) {
    gov.ownerId = seeded._id;
    gov.ownerSeedEmail = seedEmail;
    // The Owner signs by default, so they don't also need to be listed
    (gov as any).signers = (gov.signers ?? []).filter((id: unknown) => String(id) !== String(seeded._id));
    await gov.save();
  } else if (!present(gov.ownerId) && admins.length) {
    const systemHub = await hub.findOne({ systemKey: ADMIN_CAMPAIGN_SYSTEM_KEY }).select("superAdmin").lean() as any;
    const pick = present(systemHub?.superAdmin)
      ? systemHub.superAdmin
      : (admins.find(a => a.role === "superadmin") ?? admins[0])._id;
    gov.ownerId = pick;
    await gov.save();
  }

  const ownerId = gov.ownerId ? String(gov.ownerId) : null;
  const roleOf = (a: { _id: unknown; role?: string }): Role =>
    String(a._id) === ownerId ? "owner" : a.role === "superadmin" ? "superadmin" : "admin";
  const nominated = new Set((gov.signers ?? []).map(String));
  const signers = admins.filter(a => roleOf(a) === "owner" || (roleOf(a) === "superadmin" && nominated.has(String(a._id))));
  const signerIds = new Set(signers.map(a => String(a._id)));
  const n = Math.max(1, signers.length);
  const approval = Math.floor(n / 2) + 1;
  const thresholds = { approval, rejection: n - approval + 1 };
  const adminById = (id: string) => admins.find(a => String(a._id) === id);

  return { admins, gov, ownerId, roleOf, signers, signerIds, thresholds, adminById };
}
type Ctx = Awaited<ReturnType<typeof loadContext>>;

const managesTestApp = (ctx: Ctx, a: { _id: unknown; testAppInvite?: boolean }) => ctx.roleOf(a) === "owner" || !!a.testAppInvite;

/** Whether this dashboard admin can add people to the test app whitelist: the Owner, or anyone given the right. */
export async function canManageTestApp(adminId: string): Promise<boolean> {
  const ctx = await loadContext();
  const a = ctx.adminById(adminId);
  return !!a && managesTestApp(ctx, a);
}

function requireMe(req: GlobalRequest, ctx: Ctx) {
  const me = ctx.adminById(String(req.id));
  if (!me) throw new HttpError(FORBIDDEN, "only dashboard admins can use Admin Management");
  return { id: String(me._id), name: nameOf(me), role: ctx.roleOf(me) };
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

  const linked = ctx.adminById(me.id)?.linkedWallet as string | null | undefined;
  if (linked) {
    if (linked.toLowerCase() !== address.toLowerCase()) {
      throw new HttpError(FORBIDDEN, `sign with the wallet linked to your account (${linked.slice(0, 6)}…${linked.slice(-4)})`);
    }
  } else {
    // First signature: link this wallet, unless another admin already uses it
    if (ctx.admins.some(a => String(a._id) !== me.id && String(a.linkedWallet ?? "").toLowerCase() === address.toLowerCase())) {
      throw new HttpError(FORBIDDEN, "this wallet is already linked to another admin");
    }
    await admin.updateOne({ _id: me.id, $or: [{ linkedWallet: null }, { linkedWallet: { $exists: false } }] }, { $set: { linkedWallet: address.toLowerCase() } });
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
  const pending = await platformProposal.find({ status: "pending" }).select("action").lean() as any[];
  const target = (id: unknown) => {
    const a = typeof id === "string" ? ctx.adminById(id) : undefined;
    if (!a) throw new HttpError(NOT_FOUND, "admin not found");
    return a;
  };

  switch (raw.kind) {
    case "invite": {
      const email = String(raw.email ?? "").trim().toLowerCase();
      const role: BackendRole = raw.role === "superadmin" ? "superadmin" : "admin";
      if (!EMAIL_RE.test(email)) throw new HttpError(BAD_REQUEST, "enter a valid email address");
      if (role === "superadmin" && me.role !== "owner") throw new HttpError(FORBIDDEN, "only the Owner can invite Super Admins");
      const existing = await admin.findOne({ email }).select("verified").lean() as any;
      if (existing?.verified) throw new HttpError(BAD_REQUEST, "this email is already an admin");
      if (existing) throw new HttpError(BAD_REQUEST, "this email already has an invitation; resend it from the Team tab");
      if (pending.some(p => p.action?.kind === "invite" && p.action.email === email)) throw new HttpError(BAD_REQUEST, "an invitation for this email is already pending");
      return { kind: "invite", email, role, testAppInvite: raw.testAppInvite === true, clientUrl };
    }
    case "member": {
      const t = target(raw.adminId);
      const tRole = ctx.roleOf(t);
      const toRole: BackendRole = raw.toRole === "superadmin" ? "superadmin" : "admin";
      if (String(t._id) === me.id) throw new HttpError(BAD_REQUEST, "you cannot change your own role");
      if (tRole === "owner") throw new HttpError(FORBIDDEN, "the Owner's role cannot be changed");
      if ((tRole === "superadmin" || toRole === "superadmin") && me.role !== "owner") throw new HttpError(FORBIDDEN, "only the Owner can manage Super Admins");
      if (t.role === toRole) throw new HttpError(BAD_REQUEST, "that admin already has this role");
      return { kind: "member", adminId: String(t._id), adminName: nameOf(t), fromRole: t.role, toRole };
    }
    case "revoke": {
      const t = target(raw.adminId);
      const tRole = ctx.roleOf(t);
      if (String(t._id) === me.id) throw new HttpError(BAD_REQUEST, "you cannot revoke your own access");
      if (tRole === "owner") throw new HttpError(FORBIDDEN, "the Owner's access cannot be revoked");
      if (tRole === "superadmin" && me.role !== "owner") throw new HttpError(FORBIDDEN, "only the Owner can revoke a Super Admin");
      return { kind: "revoke", adminId: String(t._id), adminName: nameOf(t) };
    }
    case "revokeInvite": {
      const id = typeof raw.inviteId === "string" ? raw.inviteId : "";
      const inv = /^[a-f0-9]{24}$/i.test(id) ? await admin.findOne({ _id: id, verified: false }).select("email role").lean() as any : null;
      if (!inv) throw new HttpError(NOT_FOUND, "invitation not found");
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
      return { kind: "signer", adminId: id, adminName: nameOf(t), add };
    }
    case "replaceSigner": {
      const oldT = target(raw.oldId);
      const newT = target(raw.newId);
      const oldId = String(oldT._id), newId = String(newT._id);
      if (ctx.roleOf(oldT) === "owner") throw new HttpError(FORBIDDEN, "the Owner is always a signer");
      if (!ctx.signerIds.has(oldId)) throw new HttpError(BAD_REQUEST, "the admin being replaced is not a signer");
      if (ctx.roleOf(newT) !== "superadmin" || ctx.signerIds.has(newId)) throw new HttpError(BAD_REQUEST, "pick a Super Admin who isn't a signer yet");
      if (pendingSignerChangeFor(pending, oldId) || pendingSignerChangeFor(pending, newId)) throw new HttpError(BAD_REQUEST, "a signer change for one of these admins is already pending");
      return { kind: "replaceSigner", oldId, oldName: nameOf(oldT), newId, newName: nameOf(newT) };
    }
    case "testAppInvite": {
      const t = target(raw.adminId);
      const allow = raw.allow === true;
      if (ctx.roleOf(t) === "owner") throw new HttpError(BAD_REQUEST, "the Owner can always add people to the test app");
      if (String(t._id) === me.id) throw new HttpError(BAD_REQUEST, "you cannot change your own test app access");
      if (ctx.roleOf(t) === "superadmin" && me.role !== "owner") throw new HttpError(FORBIDDEN, "only the Owner can manage Super Admins");
      if (!!t.testAppInvite === allow) throw new HttpError(BAD_REQUEST, allow ? "this admin can already add people to the test app" : "this admin already can't add people to the test app");
      if (pending.some(p => p.action?.kind === "testAppInvite" && p.action.adminId === String(t._id))) throw new HttpError(BAD_REQUEST, "a test app access change for this admin is already pending");
      return { kind: "testAppInvite", adminId: String(t._id), adminName: nameOf(t), allow };
    }
    case "transferOwnership": {
      if (me.role !== "owner") throw new HttpError(FORBIDDEN, "only the Owner can transfer ownership");
      const t = target(raw.newOwnerId);
      const id = String(t._id);
      if (id === me.id) throw new HttpError(BAD_REQUEST, "you are already the Owner");
      if (ctx.roleOf(t) !== "superadmin") throw new HttpError(BAD_REQUEST, "ownership can only go to an existing Super Admin");
      if (pending.some(p => p.action?.kind === "transferOwnership")) throw new HttpError(BAD_REQUEST, "an ownership transfer is already pending");
      const prev = ctx.adminById(me.id);
      return { kind: "transferOwnership", newOwnerId: id, newOwnerName: nameOf(t), prevOwnerId: me.id, prevOwnerName: prev ? nameOf(prev) : "" };
    }
    default:
      throw new HttpError(BAD_REQUEST, "this kind of change isn't supported on the admin dashboard");
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

/** Applies an approved action. Returns the sign-up code when an invite email couldn't be sent. */
async function runAction(ctx: Ctx, action: any): Promise<{ link: string; code: string; emailError: string } | void> {
  const gov = ctx.gov;
  const signerList = () => (gov.signers ?? []).map(String);
  const setSigners = (ids: string[]) => { (gov as any).signers = Array.from(new Set(ids)); };

  switch (action.kind) {
    case "invite": {
      // Approved, so the invitation is created even if the email can't go out
      if (await admin.exists({ email: action.email })) throw new Error("this email already has an account or an invitation");
      const code = generateOTP();
      await admin.create({ email: action.email, role: action.role, testAppInvite: !!action.testAppInvite, code, verified: false });
      try {
        await sendEmailToAdmin(action.email, code, action.clientUrl);
        return;
      } catch (err: any) {
        const base = String(action.clientUrl || "").replace(/\/$/, "");
        return { link: `${base}/?email=${encodeURIComponent(action.email)}`, code, emailError: err?.message ?? "the email couldn't be sent" };
      }
    }
    case "member": {
      const t = ctx.adminById(action.adminId);
      if (!t) throw new Error("that admin no longer exists");
      if (ctx.roleOf(t) === "owner") throw new Error("the Owner's role cannot be changed");
      await admin.findByIdAndUpdate(action.adminId, { role: action.toRole });
      if (action.toRole === "admin") setSigners(signerList().filter(id => id !== action.adminId)); // Admins can't sign
      break;
    }
    case "revoke": {
      const t = ctx.adminById(action.adminId);
      if (!t) throw new Error("that admin no longer exists");
      if (ctx.roleOf(t) === "owner") throw new Error("the Owner's access cannot be revoked");
      await admin.findByIdAndDelete(action.adminId);
      setSigners(signerList().filter(id => id !== action.adminId));
      break;
    }
    case "revokeInvite": {
      const deleted = await admin.findOneAndDelete({ _id: action.inviteId, verified: false });
      if (!deleted && ctx.admins.some(a => String(a.email ?? "").toLowerCase() === String(action.email).toLowerCase())) {
        throw new Error(`${action.email} already accepted the invitation; propose revoking their access instead`);
      }
      return;
    }
    case "signer": {
      const t = ctx.adminById(action.adminId);
      if (!t) throw new Error("that admin no longer exists");
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
      if (!t || ctx.roleOf(t) !== "superadmin") throw new Error("the replacement must be a Super Admin");
      setSigners([...signerList().filter(id => id !== action.oldId), action.newId]);
      break;
    }
    case "testAppInvite": {
      if (!ctx.adminById(action.adminId)) throw new Error("that admin is no longer on the team");
      await admin.findByIdAndUpdate(action.adminId, { testAppInvite: !!action.allow });
      break;
    }
    case "transferOwnership": {
      if (ctx.ownerId !== action.prevOwnerId) throw new Error("ownership has already changed since this was proposed");
      const t = ctx.adminById(action.newOwnerId);
      if (!t || ctx.roleOf(t) !== "superadmin") throw new Error("the new Owner must still be a Super Admin");
      gov.ownerId = action.newOwnerId;
      // The previous Owner stays a Super Admin and keeps signing, so the confirmation count doesn't drop
      setSigners([...signerList().filter(id => id !== action.newOwnerId), action.prevOwnerId]);
      break;
    }
    default:
      throw new Error("unknown action");
  }
  await gov.save();
}

/** Reaching the approvals makes a proposal ready; a signer's `execute` applies it. Rejection is automatic. */
async function settle(ctx: Ctx, proposal: any, execute = false) {
  if (proposal.status !== "pending") return;
  const { approvals, rejections } = tally(ctx, proposal);
  if (approvals >= ctx.thresholds.approval) {
    if (!execute) { await proposal.save(); return; }
    const staleLock = new Date(Date.now() - 2 * 60 * 1000);
    const locked = await platformProposal.updateOne(
      { _id: proposal._id, status: "pending", $or: [{ executingAt: null }, { executingAt: { $lt: staleLock } }] },
      { $set: { executingAt: new Date() } }
    );
    if (!locked.modifiedCount) throw new HttpError(CONFLICT, "this proposal is already being executed");
    proposal.executingAt = null;
    proposal.markModified("executingAt");
    try {
      const share = await runAction(ctx, proposal.action);
      proposal.inviteShare = share ?? null;
      proposal.status = "executed";
      proposal.resolvedAt = new Date();
      proposal.resolvedCount = approvals;
      proposal.executionError = null;
    } catch (err: any) {
      logger.error("platform governance execution failed:", err);
      proposal.executionError = err?.message || "the change could not be applied";
    }
  } else if (rejections >= ctx.thresholds.rejection || cannotPass(ctx, proposal)) {
    proposal.status = "rejected";
    proposal.resolvedAt = new Date();
    proposal.resolvedCount = rejections;
  }
  await proposal.save();
}

function cannotPass(ctx: Ctx, proposal: any): boolean {
  const { approvals, votes } = tally(ctx, proposal);
  const notVoted = [...ctx.signerIds].filter(id => !votes.has(id)).length;
  return approvals + notVoted < ctx.thresholds.approval;
}

async function rejectUnpassable(ctx: Ctx) {
  const pending = await platformProposal.find({ status: "pending" });
  for (const p of pending) {
    if (cannotPass(ctx, p)) await settle(ctx, p);
  }
}

// ─── Response shape (matches the dashboard client, same as the Studio's) ────
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
  const proposals = seesProposals ? await platformProposal.find().sort({ createdAt: -1 }).limit(200).lean() : [];
  const signerWallets: Record<string, string> = {};
  for (const a of ctx.admins) if (a.linkedWallet) signerWallets[String(a._id)] = String(a.linkedWallet);
  return {
    ownerId: ctx.ownerId,
    meId,
    signerIds: Array.from(ctx.signerIds),
    signerWallets,
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

// ─── Handlers (mounted at /admin/governance) ────────────────────────────────
/** GET /admin/governance/team: the team in the Studio's shape, plus invitations not yet accepted. */
export const getPlatformTeam = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext();
    const me = requireMe(req, ctx);
    const invites = await admin.find({ verified: false }).select("_id email role createdAt testAppInvite").sort({ createdAt: -1 }).lean() as any[];
    res.status(OK).json({
      meId: me.id,
      ownerId: ctx.ownerId,
      admins: ctx.admins.map(a => ({
        _id: String(a._id), name: nameOf(a), email: a.email, role: a.role,
        createdAt: a.createdAt, lastActiveAt: a.lastActivity ?? null, testAppInvite: managesTestApp(ctx, a),
      })),
      pendingInvites: invites.map(i => ({ _id: String(i._id), email: i.email, role: i.role, createdAt: i.createdAt, testAppInvite: !!i.testAppInvite })),
    });
  } catch (error) {
    handleError(res, error, "error loading the team");
  }
};

/** GET /admin/governance/me: the signed-in admin's account (My Profile), with the Owner role resolved. */
export const getPlatformMe = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext();
    const me = requireMe(req, ctx);
    const a = ctx.adminById(me.id)!;
    res.status(OK).json({
      admin: {
        _id: me.id, name: me.name, email: a.email, role: a.role, linkedWallet: a.linkedWallet ?? null, createdAt: a.createdAt,
        usernameChanges: a.usernameChanges ?? 0, usernameChangesAllowed: MAX_USERNAME_CHANGES, twoFactorEnabled: !!a.twoFactorEnabled,
      },
      role: me.role,
      signer: ctx.signerIds.has(me.id),
      canManageTestApp: managesTestApp(ctx, a),
    });
  } catch (error) {
    handleError(res, error, "error loading your account");
  }
};

/** Why a username can't be used by this admin, or null when it can. */
async function usernameProblem(username: string, meId: string): Promise<string | null> {
  if (!USERNAME_RULE.test(username)) return "Use 3 to 30 letters, numbers, dots or underscores.";
  const escaped = username.replace(/[.]/g, "\.");
  const taken = await admin.exists({ _id: { $ne: meId }, username: new RegExp(`^${escaped}$`, "i") });
  return taken ? "That username is taken." : null;
}

/** GET /admin/governance/username-available?username= */
export const platformUsernameAvailable = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const reason = await usernameProblem(String(req.query.username ?? "").trim(), String(req.id));
    res.status(OK).json({ available: !reason, reason });
  } catch (error) {
    handleError(res, error, "couldn't check the username");
  }
};

/** PATCH /admin/governance/username { username }: change my username, at most MAX_USERNAME_CHANGES times. */
export const changePlatformUsername = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const reason = await usernameProblem(username, String(req.id));
    if (reason) throw new HttpError(BAD_REQUEST, reason);
    const done = await admin.updateOne(
      { _id: req.id, $or: [{ usernameChanges: { $lt: MAX_USERNAME_CHANGES } }, { usernameChanges: null }, { usernameChanges: { $exists: false } }] },
      { $set: { username }, $inc: { usernameChanges: 1 } },
    );
    if (!done.modifiedCount) throw new HttpError(FORBIDDEN, `You can change your username only ${MAX_USERNAME_CHANGES} times.`);
    res.status(OK).json({ message: "username updated" });
  } catch (error) {
    handleError(res, error, "couldn't change the username");
  }
};

export const getPlatformGovernance = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext();
    const me = requireMe(req, ctx);
    res.status(OK).json(await governanceState(ctx, me.id));
  } catch (error) {
    handleError(res, error, "error loading admin management");
  }
};

export const createPlatformProposal = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext();
    const me = requireMe(req, ctx);
    if (!ctx.signerIds.has(me.id)) throw new HttpError(FORBIDDEN, "only signers can make proposals; ask a signer to add you");

    const { ref, title, change, action, clientUrl } = req.body ?? {};
    if (typeof ref !== "string" || !/^[a-z0-9-]{6,64}$/i.test(ref)) throw new HttpError(BAD_REQUEST, "proposal id is invalid");
    if (typeof title !== "string" || !title.trim() || title.length > 200) throw new HttpError(BAD_REQUEST, "proposal title is required");
    if (await platformProposal.exists({ ref })) throw new HttpError(BAD_REQUEST, "this proposal already exists");

    const origin = typeof clientUrl === "string" && /^https?:\/\//.test(clientUrl) ? clientUrl : "";
    const normalized = await validateAction(ctx, me, action, origin);
    const sig = await verifySignature(ctx, me, "propose", { ref, title }, req.body);

    const proposal = await platformProposal.create({
      ref,
      title: title.trim(),
      change: typeof change === "string" ? change.slice(0, 500) : "",
      action: normalized,
      proposedBy: { id: me.id, name: me.name },
      signatures: [sig],
    });
    // A sole signer's proposal already has every approval it needs, so it applies straight away
    // instead of waiting for a second signature to execute it
    await settle(ctx, proposal, true);
    res.status(CREATED).json(await governanceState(await loadContext(), me.id));
  } catch (error) {
    handleError(res, error, "error creating proposal");
  }
};

export const checkPlatformProposal = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext();
    const me = requireMe(req, ctx);
    if (!ctx.signerIds.has(me.id)) throw new HttpError(FORBIDDEN, "only signers can make proposals; ask a signer to add you");
    await validateAction(ctx, me, req.body?.action, "");
    res.status(OK).json({ ok: true });
  } catch (error) {
    handleError(res, error, "error checking proposal");
  }
};

export const voteOnPlatformProposal = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext();
    const me = requireMe(req, ctx);
    const vote = req.body?.vote;
    if (vote !== "approve" && vote !== "reject") throw new HttpError(BAD_REQUEST, "vote must be approve or reject");
    if (!ctx.signerIds.has(me.id)) throw new HttpError(FORBIDDEN, "only signers can approve or reject proposals");

    const proposal = await platformProposal.findOne({ ref: req.params.ref });
    if (!proposal) throw new HttpError(NOT_FOUND, "proposal not found");
    if (proposal.status !== "pending") throw new HttpError(BAD_REQUEST, "this proposal is already decided");
    if (String(proposal.proposedBy?.id) === me.id) throw new HttpError(BAD_REQUEST, "you proposed this, so your signature is already counted");
    if (proposal.signatures.some((s: any) => String(s.admin) === me.id && (s.kind === "approve" || s.kind === "reject"))) {
      throw new HttpError(BAD_REQUEST, "you have already voted on this proposal");
    }

    const sig = await verifySignature(ctx, me, vote, { ref: proposal.ref, title: proposal.title }, req.body);
    proposal.signatures.push(sig as any);
    await settle(ctx, proposal);
    res.status(OK).json(await governanceState(await loadContext(), me.id));
  } catch (error) {
    handleError(res, error, "error recording vote");
  }
};

export const executePlatformProposal = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext();
    const me = requireMe(req, ctx);
    const proposal = await platformProposal.findOne({ ref: req.params.ref });
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
    res.status(OK).json(await governanceState(await loadContext(), me.id));
  } catch (error) {
    handleError(res, error, "error executing proposal");
  }
};

export const markPlatformNotificationsRead = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ctx = await loadContext();
    const me = requireMe(req, ctx);
    const refs = req.body?.refs;
    const filter: Record<string, unknown> = {};
    if (Array.isArray(refs)) {
      const clean = refs.map(String).filter(r => /^[a-z0-9-]{6,64}$/i.test(r)).slice(0, 200);
      if (!clean.length) throw new HttpError(BAD_REQUEST, "no notifications to mark as read");
      filter.ref = { $in: clean };
    }
    await platformProposal.updateMany(filter, { $addToSet: { readBy: me.id } });
    res.status(OK).json(await governanceState(ctx, me.id));
  } catch (error) {
    handleError(res, error, "error marking notifications as read");
  }
};

/** Team changes go through proposals; the old direct routes answer with this. */
export const useGovernanceInstead = (_req: GlobalRequest, res: GlobalResponse) => {
  res.status(FORBIDDEN).json({ error: "Team changes are proposals now. Open Admin Management and propose the change for your signers to approve." });
};
