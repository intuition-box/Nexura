import mongoose from "mongoose";
import { OTP } from '@/models/otp.model';
import { hub, hubAdmin, userHub, userHubAdmin } from '@/models/hub.model';
import { user } from '@/models/user.model';
import { server } from '@/models/server.model';
import { addHubAdminEmail } from '@/utils/sendMail';
import { createHubInvite, InviteError } from '@/utils/hubInvite';
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, CREATED, OK, NO_CONTENT, NOT_FOUND, FORBIDDEN } from '@/utils/status.utils';
import { CLIENT_URL, STUDIO_PAYMENTS_ENABLED } from '@/utils/env.utils';
import { launchFeeProblem } from '@/controllers/studioPayment.controller';
import { generateOTP, validateHubData, getMissingFields, validateCampaignData, validateCampaignQuestData, validateSaveCampaignData, validateUserHubData, validateDiscordTaskConfig } from '@/utils/utils';
import logger from '@/config/logger';
import { submission } from '@/models/submission.model';
import { miniQuestCompleted, campaignQuestCompleted } from '@/models/questsCompleted.models';
import { campaign } from '@/models/campaign.model';
import { campaignQuest } from '@/models/quests.model';
import { withSubmissionCategory } from '@/controllers/quest.controller';
import { refreshUserRetention } from "@/utils/retention";
import { payCompletedStageXp, syncCampaignXp } from "@/utils/campaignXp";
import { uploadImg } from "@/utils/img.utils";
import { FileTypeError, uploadFile } from "@/utils/file.utils";
import { isHubOwner, ownsHubRecord, submissionInHub } from "@/utils/hubOwnership";
import { USERNAME_RULE, usernameTaken } from "@/utils/hubAccounts";
import { notifyProjectChange, recordHubActivity } from "@/utils/hubNotifications";
import { hubNotification } from "@/models/hubNotification.model";

const OWNER_ONLY_SOCIALS = "only the studio Owner can connect or disconnect its X, Discord and Telegram";
import { campaignRewardAsset, rewardAsset } from "@/utils/rewardAssets";
import { normalizeCampaignDateInput, normalizeCampaignDatesForResponse, parseDate } from "@/utils/dates";

const DISCORD_CAMPAIGN_TAGS = new Set([
  "discord",
  "join",
  "join-discord",
  "message",
  "message-discord",
  "acquire-role-discord",
  "send-message-discord",
]);

const isDiscordCampaignTask = (task: Record<string, any>) =>
  DISCORD_CAMPAIGN_TAGS.has(String(task?.tag ?? "").trim()) || String(task?.category ?? "").trim() === "discord";

const ONGOING_CAMPAIGN_STATUSES = ["Active", "Scheduled"] as const;

const getDiscordQuestGuildIdsForCampaigns = async (campaignIds: string[]) => {
  if (campaignIds.length === 0) return [];

  const quests = await campaignQuest
    .find({ campaign: { $in: campaignIds } })
    .select("guildId tag category")
    .lean();

  return Array.from(
    new Set(
      quests
        .filter((quest: any) => isDiscordCampaignTask(quest))
        .map((quest: any) => String(quest.guildId ?? "").trim())
        .filter(Boolean)
    )
  );
};

const resolveCampaignDiscordLaunchGuildId = async (campaignDoc: any) => {
  const storedGuildId = String(campaignDoc?.discordLaunchGuildId ?? "").trim();
  if (storedGuildId) return storedGuildId;

  const guildIds = await getDiscordQuestGuildIdsForCampaigns([String(campaignDoc?._id ?? "")].filter(Boolean));
  return guildIds[0] ?? "";
};

const getRequiredOngoingDiscordGuildIdForHub = async (hubId: unknown) => {
  const ongoingCampaigns = await campaign
    .find({ hub: hubId, status: { $in: ONGOING_CAMPAIGN_STATUSES } })
    .select("_id discordLaunchGuildId")
    .lean();

  if (ongoingCampaigns.length === 0) {
    return "";
  }

  const lockedGuildIds = new Set<string>();
  const fallbackCampaignIds: string[] = [];

  for (const ongoingCampaign of ongoingCampaigns) {
    const storedGuildId = String((ongoingCampaign as any).discordLaunchGuildId ?? "").trim();
    if (storedGuildId) {
      lockedGuildIds.add(storedGuildId);
      continue;
    }

    fallbackCampaignIds.push(String((ongoingCampaign as any)._id ?? "").trim());
  }

  const fallbackGuildIds = await getDiscordQuestGuildIdsForCampaigns(fallbackCampaignIds.filter(Boolean));
  for (const guildId of fallbackGuildIds) {
    lockedGuildIds.add(guildId);
  }

  if (lockedGuildIds.size > 1) {
    throw new Error("Multiple active campaigns with Discord tasks are locked to different Discord servers. Reconnect the original server used for those campaigns before changing Studio Discord.");
  }

  return Array.from(lockedGuildIds)[0] ?? "";
};

const MAX_CATEGORIES = 5;

const readCategories = (raw: unknown): string[] => {
  let list: unknown = raw;
  if (typeof raw === "string") { try { list = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(list)) return [];
  const tags = list.filter((t): t is string => typeof t === "string").map(t => t.trim()).filter(t => t && t.length <= 30);
  return [...new Set(tags)].slice(0, MAX_CATEGORIES);
};

export const createHub = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { error } = validateHubData(req.body);
    if (error) {
      const emptyFields = getMissingFields(error);

      res
        .status(BAD_REQUEST)
        .json({ error: `these field(s) are required: ${emptyFields}` });
      return;
    }

    const name = String(req.body.name ?? "").trim().toUpperCase();

    const existingHubWithName = await hub.findOne({ name });
    if (existingHubWithName) {
      // If it's already their hub, we can just update it or proceed
      if (String(existingHubWithName.superAdmin) === String(req.id)) {
        // Proceed to update or just return success if already exists
        await hub.findByIdAndUpdate(existingHubWithName._id, {
          description: req.body.description ?? existingHubWithName.description,
          website: String(req.body.website ?? existingHubWithName.website).trim(),
          xAccount: String(req.body.xAccount ?? existingHubWithName.xAccount).trim(),
          discordServer: String(req.body.discordServer ?? existingHubWithName.discordServer).trim(),
          ...(req.body.categories !== undefined ? { categories: readCategories(req.body.categories) } : {}),
        });
        res.status(OK).json({ message: "hub updated!" });
        return;
      }
      res.status(BAD_REQUEST).json({ error: "name is already in use" });
      return;
    }

    const hubLogoAsFile = req.file?.buffer;
    if (!hubLogoAsFile) {
      res.status(BAD_REQUEST).json({ error: "hub logo is required" });
      return;
    }

    const hubLogo = await uploadImg({ file: hubLogoAsFile, filename: req.file?.originalname, folder: "hub-logos" });
    const website = String(req.body.website ?? "").trim();
    const xAccount = String(req.body.xAccount ?? "").trim();
    const discordServer = String(req.body.discordServer ?? "").trim();

    const createdHub = await hub.create({
      name,
      description: req.body.description ?? "",
      categories: readCategories(req.body.categories),
      website,
      xAccount,
      discordServer,
      logo: hubLogo,
      superAdmin: req.id,
      xpAllocated: 200,
    });

    const adminDoc = req.admin as any;
    await hubAdmin.findByIdAndUpdate(req.id, { hub: createdHub._id, pendingTxHash: null });

    // Migrate any pending payment hash from admins to hub (payment represents completed on-chain studio fee)
    if (adminDoc?.pendingTxHash) {
      await hub.findByIdAndUpdate(createdHub._id, { pendingTxHash: adminDoc.pendingTxHash, $inc: { noOfPayments: 1 } });
    }

    res.status(CREATED).json({ message: "hub created!" });
  } catch (error: any) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "Error creating hub" });
  }
};

export const getHub = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const hubFound = await hub.findById(req.admin.hub).lean() as any;
    // If hub exists but pendingTxHash isn't on it, fall back to admin's stored hash
    const adminHash = (req.admin as any).pendingTxHash ?? null;
    const pendingTxHash = hubFound?.pendingTxHash ?? adminHash;
    const adminInfo = { _id: req.id, name: req.admin.name, email: req.admin.email, role: req.admin.role, usernameChanges: (req.admin as any).usernameChanges ?? 0, usernameChangesAllowed: MAX_USERNAME_CHANGES, twoFactorEnabled: !!(req.admin as any).twoFactorEnabled };
    res.status(OK).json({ hub: hubFound ? { ...hubFound, pendingTxHash } : { pendingTxHash }, admin: adminInfo });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error getting hub" });
  }
};

export const savePaymentHash = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { txHash } = req.body;
    if (txHash && STUDIO_PAYMENTS_ENABLED) {
      const problem = await launchFeeProblem(txHash);
      if (problem) {
        res.status(BAD_REQUEST).json({ error: problem });
        return;
      }
    }
    if (req.admin.hub) {
      // Hub exists — save on hub
      if (txHash) {
        await hub.findByIdAndUpdate(req.admin.hub, { pendingTxHash: txHash, $inc: { noOfPayments: 1 } });
      } else {
        await hub.findByIdAndUpdate(req.admin.hub, { pendingTxHash: null });
      }
    } else {
      // Hub not created yet — save on admin as fallback; counter is incremented when hub is created
      await hubAdmin.findByIdAndUpdate(req.id, { pendingTxHash: txHash ?? null });
    }
    res.status(OK).json({ message: "payment hash saved" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error saving payment hash" });
  }
};

export const updateIds = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { guildId, discordSessionId } = req.body;
    const normalizedGuildId = String(guildId ?? "").trim();
    const normalizedDiscordSessionId = String(discordSessionId ?? "").trim();

    // userHubAdmin has userId field; hubAdmin has role field
    const isUserHub = !!(req.admin as any).userId;

    if (!isUserHub && !(await isHubOwner(req))) {
      res.status(FORBIDDEN).json({ error: OWNER_ONLY_SOCIALS });
      return;
    }

    const session = mongoose.Types.ObjectId.isValid(normalizedDiscordSessionId)
      ? await server.findById(normalizedDiscordSessionId).select("servers").lean() as any
      : null;
    const chosen = /^\d{5,25}$/.test(normalizedGuildId)
      ? session?.servers?.find((s: any) => String(s?.id) === normalizedGuildId)
      : null;
    if (!chosen) {
      res.status(BAD_REQUEST).json({ error: "reconnect Discord and choose one of your servers" });
      return;
    }

    const updatePayload: Record<string, any> = {
      guildId: normalizedGuildId,
      discordServer: String(chosen.name ?? "").trim(),
      discordSessionId: normalizedDiscordSessionId,
      discordConnected: true,
    };

    // Note: with the schema no longer enforcing guildId uniqueness, we no
    // longer $unset other hubs' guildId here — multiple hubs may legitimately
    // share a Discord server.

    if (isUserHub) {
      await userHub.findByIdAndUpdate(req.admin.hub, updatePayload);
    } else {
      await hub.findByIdAndUpdate(req.admin.hub, updatePayload);
      void notifyProjectChange(req, ["discord"], [{ field: "discord", to: updatePayload.discordServer || "connected" }]);
    }

    res.status(OK).json({ message: "ids updated successfully" });
  } catch (error: any) {
    logger.error(error);
    if (error?.code === 11000 || error?.message?.includes("E11000")) {
      res.status(FORBIDDEN).json({ error: "This Discord server is already linked to another hub. Disconnect it there first." });
      return;
    }
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error updating ids" });
	}
}

export const completeHubDiscordConnect = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { serverId } = req.body as { serverId?: string };
    if (!serverId) {
      res.status(BAD_REQUEST).json({ error: "serverId is required" });
      return;
    }

    const serverDoc = await server.findById(serverId);
    if (!serverDoc || !serverDoc.servers?.length) {
      res.status(NOT_FOUND).json({ error: "Discord server data not found" });
      return;
    }

    const primaryGuild = serverDoc.servers[0]!;

    // Multi-hub to one-server is allowed: guildId is no longer unique-indexed,
    // so a disconnected hub doesn't block another hub from connecting either
    // to the same Discord server or to a different one.

    await hub.findByIdAndUpdate(req.admin.hub, {
      guildId: primaryGuild.id,
      discordServer: primaryGuild.name,
      discordConnected: true,
      discordSessionId: serverId,
    });

    res.status(OK).json({ message: "Discord connected successfully" });
  } catch (error: any) {
    logger.error(error);
    if (error?.code === 11000 || error?.message?.includes("E11000")) {
      res.status(FORBIDDEN).json({
        error: "This Discord server is already linked to another hub. Disconnect it there first.",
      });
      return;
    }
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error connecting Discord" });
  }
};

export const disconnectHubDiscord = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    if (!(await isHubOwner(req))) {
      res.status(FORBIDDEN).json({ error: OWNER_ONLY_SOCIALS });
      return;
    }
    // Also $unset guildId and verifiedId so the unique-indexed slot is released
    // — otherwise a future hub can no longer connect to the same Discord server.
    await hub.findByIdAndUpdate(req.admin.hub, {
      $unset: { guildId: 1, verifiedId: 1 },
      discordConnected: false,
      discordServer: "",
      discordSessionId: "",
    });
    void notifyProjectChange(req, ["discord"], [{ field: "discord" }]);

    res.status(OK).json({ message: "discord disconnected" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error disconnecting discord" });
  }
};

export const addHubAdmin = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { email, role, clientUrl } = req.body;
    await createHubInvite({ hubId: req.admin.hub ? String(req.admin.hub) : "", email, role, clientUrl });
    res.status(OK).json({ message: "otp sent" });
  } catch (error: any) {
    if (error instanceof InviteError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    logger.error("addHubAdmin failed:", error);
    const msg = error?.message || 'Failed to add hub admin';
    res.status(INTERNAL_SERVER_ERROR).json({ error: msg });
  }
};

/** The hub fields an admin may edit directly (the project profile). */
const EDITABLE_HUB_FIELDS = ["name", "description", "website", "xAccount", "logo", "document"] as const;

export const updateHub = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
    const logoFile = files?.logo?.[0];
    const documentFile = files?.document?.[0];

    const { name } = req.body;

    if (logoFile?.buffer) {
      req.body.logo = await uploadImg({
        file: logoFile.buffer,
        filename: logoFile.originalname,
        folder: "hub-logo",
      });
    }

    if (documentFile?.buffer) {
      req.body.document = await uploadFile({
        file: documentFile.buffer,
        filename: documentFile.originalname,
        contentType: documentFile.mimetype,
        folder: "hub-documents",
      });
    }

    const trimmedName = typeof name === "string" ? name.trim().toUpperCase() : undefined;
    if (trimmedName) {
      const nameExists = await hub.exists({
        name: trimmedName,
        _id: { $ne: req.admin.hub },
      });

      if (nameExists) {
        res.status(400).json({ error: "hub name already exists" });
        return;
      }
      req.body.name = trimmedName;
    }

    // The Nexura dashboard (platform admins, /api/admin/update-hub) keeps its full control of the Nexura hub
    if (req.isPlatformAdmin) {
      const { xpAllocated: _xp, ...safeBody } = req.body;
      if (safeBody.website !== undefined) safeBody.website = String(safeBody.website ?? "").trim();
      if (safeBody.xAccount !== undefined) safeBody.xAccount = String(safeBody.xAccount ?? "").trim();
      if (safeBody.discordServer !== undefined) safeBody.discordServer = String(safeBody.discordServer ?? "").trim();
      if (safeBody.guildId !== undefined) safeBody.guildId = String(safeBody.guildId ?? "").trim();
      if (safeBody.document !== undefined) safeBody.document = String(safeBody.document ?? "").trim();
      if (safeBody.categories !== undefined) safeBody.categories = readCategories(safeBody.categories);
      const updatedHub = await hub.findByIdAndUpdate(req.admin.hub, safeBody, { new: true });
      res.status(OK).json(updatedHub);
      return;
    }

    // Studio hubs only change their profile here. The Owner (superAdmin) changes through an approved
    // transferOwnership proposal, payment records through the payment flow, the Discord link
    // through the Discord connect flow, and the counters and systemKey never from the client.
    const safeBody: Record<string, string> = {};
    for (const field of EDITABLE_HUB_FIELDS) {
      if (req.body[field] !== undefined) safeBody[field] = String(req.body[field] ?? "").trim();
    }
    // Links shown to users and Nexura admins can't carry script (javascript:, data:, vbscript:)
    const unsafe = (["website", "xAccount", "logo", "document"] as const).find(f => /^[\s\x00-\x1f]*(javascript|data|vbscript):/i.test(safeBody[f] ?? ""));
    if (unsafe) {
      res.status(BAD_REQUEST).json({ error: `the ${unsafe} link isn't valid; use a normal web address` });
      return;
    }
    if (safeBody.xAccount !== undefined && !(await isHubOwner(req))) {
      res.status(FORBIDDEN).json({ error: OWNER_ONLY_SOCIALS });
      return;
    }
    const categories = req.body.categories !== undefined ? readCategories(req.body.categories) : undefined;
    if (categories && !categories.length) {
      res.status(BAD_REQUEST).json({ error: "pick at least one category" });
      return;
    }
    const before = await hub.findById(req.admin.hub).select([...EDITABLE_HUB_FIELDS, "categories"].join(" ")).lean() as any;
    const ignored = Object.keys(req.body ?? {}).filter(k => k !== "categories" && !(EDITABLE_HUB_FIELDS as readonly string[]).includes(k));
    if (ignored.length) logger.warn(`updateHub: ignored fields that can't be set here: ${ignored.join(", ")} (admin ${req.id}, hub ${req.admin.hub})`);
    const updatedHub = await hub.findByIdAndUpdate(req.admin.hub, { ...safeBody, ...(categories ? { categories } : {}) }, { new: true });
    // The other Owner/Super Admins hear about project settings changes (they don't go through proposals)
    const changed = Object.keys(safeBody).filter(f => String(before?.[f] ?? "") !== safeBody[f]);
    if (categories && categories.join() !== (before?.categories ?? []).join()) changed.push("categories");
    const details = changed.map(f => f === "categories"
      ? { field: f, from: (before?.categories ?? []).join(", "), to: categories!.join(", ") }
      : { field: f, from: String(before?.[f] ?? ""), to: safeBody[f] });
    void notifyProjectChange(req, changed, details);
    res.status(OK).json(updatedHub);
  } catch (error) {
    if (error instanceof FileTypeError) {
      res.status(BAD_REQUEST).json({ error: error.message });
      return;
    }
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: 'Failed to update hub' });
  }
};

export const deleteHub = async (req: GlobalRequest, res: GlobalResponse) => {
  try {

    await hub.findByIdAndDelete(req.admin.hub);

    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error)
    res.status(INTERNAL_SERVER_ERROR).json({ error: 'Failed to delete hub' });
  }
};

export const removeHubAdmin = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id } = req.query as { id: string };
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "admin id is required" });
      return;
    }

    if (id === req.id) {
      res.status(BAD_REQUEST).json({ error: "you cannot remove yourself" });
      return;
    }

    // Only allow removing admins from the same hub
    const target = await hubAdmin.findById(id).lean();
    if (!target || String(target.hub) !== String(req.admin.hub)) {
      res.status(NOT_FOUND).json({ error: "admin not found in your hub" });
      return;
    }

    await hubAdmin.findByIdAndDelete(id);

    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error removing admin" })
  }
};

export const getHubAdmins = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    if (!req.admin.hub) {
      res.status(BAD_REQUEST).json({ error: "no hub found" });
      return;
    }

    const found = await hubAdmin.find({ hub: req.admin.hub }).select("_id name email role createdAt updatedAt lastActiveAt").lean() as any[];
    // Last seen: recorded activity, or for people not seen since tracking began, their account's latest update
    const admins = found.map(({ updatedAt, ...a }) => ({ ...a, lastActiveAt: a.lastActiveAt ?? updatedAt ?? a.createdAt ?? null }));

    // Also fetch pending invites for this hub
    const now = new Date();
    await OTP.deleteMany({ hubId: String(req.admin.hub), expiresAt: { $lte: now } });
    const pendingInvites = await OTP.find({ hubId: String(req.admin.hub), expiresAt: { $gt: now } })
      .select("_id email role createdAt expiresAt")
      .lean();

    res.status(OK).json({ admins, pendingInvites });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching hub admins" });
  }
};

export const resendInvite = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { inviteId, clientUrl } = req.body;
    if (!inviteId) {
      res.status(BAD_REQUEST).json({ error: "inviteId is required" });
      return;
    }

    const existingOtp = await OTP.findById(inviteId);
    if (!existingOtp || String(existingOtp.hubId) !== String(req.admin.hub)) {
      res.status(NOT_FOUND).json({ error: "invite not found" });
      return;
    }

    // Generate a fresh code and reset expiry
    let newCode = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateOTP();
      const codeExists = await OTP.exists({ code: candidate, _id: { $ne: existingOtp._id } });
      if (!codeExists) {
        newCode = candidate;
        break;
      }
    }

    if (!newCode) {
      res.status(INTERNAL_SERVER_ERROR).json({ error: "Failed to generate invite code" });
      return;
    }

    const previousCode = existingOtp.code;
    const previousExpiresAt = existingOtp.expiresAt;
    existingOtp.code = newCode;
    existingOtp.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await existingOtp.save();

    const origin = clientUrl || CLIENT_URL;
    try {
      await addHubAdminEmail(existingOtp.email, newCode, origin);
    } catch (error) {
      existingOtp.code = previousCode;
      existingOtp.expiresAt = previousExpiresAt;
      await existingOtp.save();
      throw error;
    }

    res.status(OK).json({ message: "invite resent" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Failed to resend invite" });
  }
};

export const deleteInvite = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id } = req.query;
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "invite id is required" });
      return;
    }

    const invite = await OTP.findById(id);
    if (!invite || String(invite.hubId) !== String(req.admin.hub)) {
      res.status(NOT_FOUND).json({ error: "invite not found" });
      return;
    }

    await OTP.findByIdAndDelete(id);
    res.status(OK).json({ message: "invite deleted" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Failed to delete invite" });
  }
};

export const updateHubAdminRole = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { adminId, newRole } = req.body;
    if (!adminId || !newRole) {
      res.status(BAD_REQUEST).json({ error: "adminId and newRole are required" });
      return;
    }

    if (!["admin", "superadmin"].includes(newRole)) {
      res.status(BAD_REQUEST).json({ error: "role must be admin or superadmin" });
      return;
    }

    if (adminId === req.id) {
      res.status(BAD_REQUEST).json({ error: "you cannot change your own role" });
      return;
    }

    const target = await hubAdmin.findById(adminId).lean();
    if (!target || String(target.hub) !== String(req.admin.hub)) {
      res.status(NOT_FOUND).json({ error: "admin not found in your hub" });
      return;
    }

    await hubAdmin.findByIdAndUpdate(adminId, { role: newRole });

    res.status(OK).json({ message: `admin role updated to ${newRole}` });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error updating admin role" });
  }
};

class SubmissionDecisionError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/** Approves or rejects one submission and its task completion. Throws SubmissionDecisionError with the response status. */
async function applySubmissionDecision(submissionId: string, action: "accept" | "reject", adminName: string) {
  const userSubmission = await submission.findById(submissionId);
  if (!userSubmission) throw new SubmissionDecisionError(BAD_REQUEST, "submission not found");

  let model;
  let isSeasonalQuest = false;

  if (userSubmission.page === "quest" || userSubmission.page === "user") {
    isSeasonalQuest = true;
    model = await miniQuestCompleted.findOne({ _id: userSubmission.questCompleted, status: { $in: ["pending", "retry"] } });
    if (!model) throw new SubmissionDecisionError(NOT_FOUND, "mini quest already completed or id is invalid");
  } else {
    model = await campaignQuestCompleted.findOne({ _id: userSubmission.questCompleted, status: { $in: ["pending", "retry"] } });
    if (!model) throw new SubmissionDecisionError(NOT_FOUND, "campaign quest already completed or id is invalid");
  }

  if (action === "accept") {
    userSubmission.status = "done";
    userSubmission.validatedBy = adminName;
    if (isSeasonalQuest) {
      // Seasonal mini-tasks decouple approval from completion: the user must
      // still click "Claim XP" to finalize, so leave it claimable (not done).
      model.status = "approved";
      model.done = false;
    } else {
      model.done = true;
      model.status = "done";
    }
  } else if (action === "reject") {
    userSubmission.status = "retry";
    userSubmission.validatedBy = adminName;
    userSubmission.rejectedCount = (userSubmission.rejectedCount || 0) + 1;
    model.status = "retry";
  }

  await userSubmission.save();
  await model.save();
  if (action === "accept" && !isSeasonalQuest) {
    void refreshUserRetention(userSubmission.user);
    // Pays the stage XP if this approval finished a stage
    void payCompletedStageXp(userSubmission.user);
  }
}

export const validateCampaignSubmissions = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { submissionId, action }: { submissionId: string; action: "reject" | "accept" } = req.body;
    if (action !== "accept" && action !== "reject") {
      res.status(BAD_REQUEST).json({ error: "action must be accept or reject" });
      return;
    }
    // Only submissions on this hub's own campaigns and quests can be reviewed
    if (!(await submissionInHub(req, submissionId))) {
      res.status(NOT_FOUND).json({ error: "submission not found in your hub" });
      return;
    }
    await applySubmissionDecision(submissionId, action, req.adminName ?? "Admin");
    res.status(NO_CONTENT).send();
  } catch (error) {
    if (error instanceof SubmissionDecisionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: 'Failed to validate campaign submissions' });
  }
};

const BULK_DECISION_LIMIT = 200;

/**
 * POST /hub/validate-campaign-submissions-bulk { submissionIds, action }: one decision for many
 * campaign submissions. Only submissions on this hub's campaigns are touched; each is applied on
 * its own, so one failure doesn't stop the rest. Responds with what was applied and what failed.
 */
export const validateCampaignSubmissionsBulk = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { submissionIds, action } = req.body ?? {};
    if (action !== "accept" && action !== "reject") {
      res.status(BAD_REQUEST).json({ error: "action must be accept or reject" });
      return;
    }
    const ids: string[] = Array.isArray(submissionIds)
      ? [...new Set(submissionIds.map(String))].filter(id => mongoose.Types.ObjectId.isValid(id))
      : [];
    if (!ids.length) {
      res.status(BAD_REQUEST).json({ error: "select at least one submission" });
      return;
    }
    if (ids.length > BULK_DECISION_LIMIT) {
      res.status(BAD_REQUEST).json({ error: `select at most ${BULK_DECISION_LIMIT} submissions at a time` });
      return;
    }

    // Each submission must belong to a campaign of this hub (the system hub reviews every hub)
    const hubDoc = await hub.findById(req.admin.hub).select("systemKey").lean() as any;
    if (!hubDoc) {
      res.status(NOT_FOUND).json({ error: "hub not found" });
      return;
    }
    const isSystem = hubDoc.systemKey === "nexura-admin-campaigns";
    const subs = await submission.find({ _id: { $in: ids }, page: "campaign" }).select("_id miniQuestId").lean() as any[];
    const quests = await campaignQuest.find({ _id: { $in: subs.map(s => s.miniQuestId).filter((q: string) => mongoose.Types.ObjectId.isValid(q)) } }).select("_id campaign").lean() as any[];
    const campaigns = await campaign.find({ _id: { $in: quests.map(q => q.campaign) } }).select("_id hub").lean() as any[];
    const hubOfCampaign = new Map(campaigns.map(c => [String(c._id), String(c.hub)]));
    const campaignOfQuest = new Map(quests.map(q => [String(q._id), String(q.campaign)]));
    const allowed = new Set(subs
      .filter(s => {
        const campaignHub = hubOfCampaign.get(campaignOfQuest.get(String(s.miniQuestId)) ?? "");
        return campaignHub !== undefined && (isSystem || campaignHub === String(req.admin.hub));
      })
      .map(s => String(s._id)));

    const applied: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    for (const id of ids) {
      if (!allowed.has(id)) { failed.push({ id, error: "not a submission on your campaigns" }); continue; }
      try {
        await applySubmissionDecision(id, action, req.adminName ?? "Admin");
        applied.push(id);
      } catch (err: any) {
        failed.push({ id, error: err instanceof SubmissionDecisionError ? err.message : "could not be updated" });
        if (!(err instanceof SubmissionDecisionError)) logger.error(err);
      }
    }
    res.status(OK).json({ applied, failed });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Failed to validate submissions" });
  }
};

export const getCampaignSubmissions = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    // Return all submissions tied to this hub (studio campaigns only)
    const rawTasks = await submission.find({ hub: req.admin.hub }).lean().sort({ createdAt: 1 });
    const pendingTasks = await withSubmissionCategory(rawTasks);
    res.status(OK).json({ message: "submissions fetched", pendingTasks });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Failed to fetch campaign submissions" });
  }
};

export const getCampaign = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id } = req.query as { id: string };
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "send campaign id" });
      return;
    }

    const campaignFound = await campaign.findById(id).lean();
    if (!campaignFound) {
      res.status(NOT_FOUND).json({ error: "campaign not found" });
      return;
    }
    // Every admin needs a hub to read a campaign, and it must be theirs (platform admins see all)
    if (!req.isPlatformAdmin && !(await ownsHubRecord(req, campaignFound.hub))) {
      res.status(FORBIDDEN).json({ error: "you are not allowed to access this campaign" });
      return;
    }

    const campaignQuests = await campaignQuest.find({ campaign: id }).lean();

    res.status(OK).json({ campaignQuests, campaignFound: normalizeCampaignDatesForResponse(campaignFound) });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching campaign" });
  }
}

/**
 * Retention campaign builder fields (stages, reward settings, template) arrive as FormData strings.
 * Parse and sanitize them in place; anything malformed is dropped rather than stored.
 */
function parseRetentionBuilderFields(body: Record<string, any>) {
  const parse = (v: unknown) => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return undefined; } };
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };

  if (body.stages !== undefined) {
    const stages = parse(body.stages);
    if (Array.isArray(stages)) {
      body.stages = stages
        .filter((s: any) => s && typeof s.key === "string" && typeof s.name === "string")
        .slice(0, 50)
        .map((s: any, i: number) => ({
          key: String(s.key).slice(0, 64),
          name: String(s.name).trim().slice(0, 120) || `Stage ${i + 1}`,
          order: i,
          returnDays: Math.max(0, num(s.returnDays) ?? 0),
          allocationPct: s.allocationPct === null || s.allocationPct === undefined ? null : Math.min(100, Math.max(0, num(s.allocationPct) ?? 0)),
        }));
    } else delete body.stages;
  }

  if (body.rewardsEnabled !== undefined) body.rewardsEnabled = body.rewardsEnabled === true || body.rewardsEnabled === "true";

  if (body.rewardsConfig !== undefined) {
    const rc = parse(body.rewardsConfig);
    if (rc && typeof rc === "object") {
      body.rewardsConfig = {
        budget: num((rc as any).budget),
        token: typeof (rc as any).token === "string" ? (rc as any).token.slice(0, 16) : undefined,
        network: typeof (rc as any).network === "string" ? (rc as any).network.slice(0, 40) : undefined,
        recipients: num((rc as any).recipients),
        nexuraScoreRequirementPct: num((rc as any).nexuraScoreRequirementPct ?? (rc as any).retentionRequirementPct),
        participantPool: num((rc as any).participantPool),
        validationRewardsOn: Boolean((rc as any).validationRewardsOn),
        curatorRewardsOn: Boolean((rc as any).curatorRewardsOn),
        curatorAddress: typeof (rc as any).curatorAddress === "string" ? (rc as any).curatorAddress.slice(0, 64) : undefined,
        totalPaid: num((rc as any).totalPaid),
        paymentTxHash: typeof (rc as any).paymentTxHash === "string" ? (rc as any).paymentTxHash.slice(0, 120) : undefined,
      };
    } else delete body.rewardsConfig;
  }

  if (body.templateId !== undefined) body.templateId = typeof body.templateId === "string" && body.templateId ? body.templateId.slice(0, 64) : null;

  if (body.builderState !== undefined) {
    const raw = typeof body.builderState === "string" ? body.builderState : JSON.stringify(body.builderState ?? null);
    const state = raw.length <= 200_000 ? parse(raw) : undefined;
    if (state && typeof state === "object" && !Array.isArray(state)) body.builderState = state;
    else delete body.builderState;
  }
}

/** Parses a campaign save body in place (FormData sends JSON fields as strings) and validates it. Returns an error message or null. */
export function prepareCampaignSaveBody(body: Record<string, any>): string | null {
  if (typeof body.reward === "string") {
    try { body.reward = JSON.parse(body.reward); } catch { /* leave as-is */ }
  }
  parseRetentionBuilderFields(body);
  body.starts_at = normalizeCampaignDateInput(body.starts_at);
  body.ends_at = normalizeCampaignDateInput(body.ends_at);
  // The reward asset is worked out here from the reward settings, never taken from the request
  delete body.rewardAsset;
  const rc = body.rewardsConfig;
  if (rc && (rc.network !== undefined || rc.token !== undefined)) {
    const asset = rewardAsset(rc.network, rc.token);
    if (!asset) return "that reward token isn't offered on that network";
    body.rewardAsset = { network: asset.network, token: asset.token, chainId: asset.chainId, decimals: asset.decimals, native: asset.native, tokenAddress: asset.tokenAddress };
  }
  const { error } = validateSaveCampaignData(body);
  return error ? `Missing required fields: ${getMissingFields(error)}` : null;
}

const CAMPAIGN_SAVE_FIELDS = [
  "title", "description", "starts_at", "ends_at", "maxParticipants", "reward", "projectCoverImage",
  "stages", "rewardsEnabled", "rewardsConfig", "rewardAsset", "templateId", "builderState",
] as const;

export function pickCampaignSaveFields(body: Record<string, any>): Record<string, any> {
  const picked: Record<string, any> = {};
  for (const key of CAMPAIGN_SAVE_FIELDS) if (body[key] !== undefined) picked[key] = body[key];
  return picked;
}

const CAMPAIGN_SERVER_FIELDS = [
  "_id", "status", "hub", "creator", "contractAddress", "rewardsDeployment", "xpClaimed", "trustClaimed",
  "participants", "deletedAt", "discordLaunchGuildId", "endProposal", "publishSignature", "rewardAsset",
];

export function withoutServerCampaignFields(body: Record<string, any> | undefined): Record<string, any> {
  const copy: Record<string, any> = { ...(body ?? {}) };
  for (const key of CAMPAIGN_SERVER_FIELDS) delete copy[key];
  return copy;
}

/** A rejected campaign update, with the HTTP status to answer it with. */
export class CampaignUpdateError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/**
 * Applies a save to an existing campaign: fields, dates/status and quests (existing quest IDs and
 * submissions are kept). Used by the builder for drafts and by an approved "editCampaign" proposal.
 * Throws CampaignUpdateError when the change isn't allowed.
 */
export async function applyCampaignUpdate(id: string, hubFound: any, body: Record<string, any>, questsToSave: any[] | null) {
  const campaignFound = await campaign.findById(id).lean();
  if (!campaignFound) {
    throw new CampaignUpdateError(NOT_FOUND, "campaign not found");
  }

  const lockedDiscordGuildId = campaignFound.status !== "Save"
    ? await resolveCampaignDiscordLaunchGuildId(campaignFound)
    : "";

  const discordGuildIdForCampaign = lockedDiscordGuildId || String(hubFound.guildId ?? "").trim();

  const incomingNameOfProject = typeof body.nameOfProject === "string"
    ? body.nameOfProject.trim()
    : "";

  const newCoverImage = body.coverImage;
  const updateFields = pickCampaignSaveFields(body);

  // A cover uploaded after the first save replaces the stored one
  if (typeof newCoverImage === "string" && newCoverImage) updateFields.projectCoverImage = newCoverImage;

  if (updateFields.reward && typeof updateFields.reward === "object") {
    const rewardUpdate = updateFields.reward as Record<string, unknown>;
    const pool = Number(rewardUpdate.pool ?? 0);
    const xp = Number(rewardUpdate.xp ?? 0);
    const trustTokens = Number(rewardUpdate.trust ?? rewardUpdate.trustTokens ?? 0);
    updateFields.reward = {
      xp,
      pool,
      trustTokens,
    };
    updateFields.totalXpAvailable = xp;
    updateFields.totalTrustAvailable = pool;
  }

  if (updateFields.maxParticipants !== undefined) {
    updateFields.maxParticipants = Number(updateFields.maxParticipants ?? 0);
  }

  if (updateFields.description !== undefined) {
    updateFields.sub_title = String(updateFields.description ?? "").trim();
  }

  if (body.nameOfProject !== undefined || campaignFound.project_name) {
    updateFields.project_name = hubFound.name ?? incomingNameOfProject ?? campaignFound.project_name;
  }

  const existingPool = Number(campaignFound.reward?.pool ?? 0);
  const existingMaxParticipants = Number((campaignFound as any).maxParticipants ?? campaignFound.participants ?? 0);
  const existingStartsAt = parseDate(campaignFound.starts_at);
  const existingEndsAt = parseDate(campaignFound.ends_at);
  const incomingPool = updateFields.reward
    ? Number((updateFields.reward as Record<string, unknown>).pool ?? existingPool)
    : existingPool;
  const incomingMaxParticipants = updateFields.maxParticipants !== undefined
    ? Number(updateFields.maxParticipants ?? existingMaxParticipants)
    : existingMaxParticipants;
  const incomingEndsAt = updateFields.ends_at ? parseDate(updateFields.ends_at) : existingEndsAt;
  const rewardsContractSettled = Boolean((campaignFound as any).rewardsDeployment?.remainderWithdrawalTxHash);
  const campaignHasStarted = existingStartsAt ? existingStartsAt.getTime() <= Date.now() : false;

  // A live campaign only ends earlier through an approved "end campaign" proposal, and editing can't undo one
  if (campaignFound.status !== "Save" && existingEndsAt && incomingEndsAt) {
    // The date picker works in whole minutes, so allow up to a minute of rounding
    if (incomingEndsAt.getTime() < existingEndsAt.getTime() - 60_000) {
      throw new CampaignUpdateError(BAD_REQUEST, "a live campaign's end date can't be brought forward; propose ending it instead");
    }
    if ((campaignFound as any).endProposal?.endsAt && incomingEndsAt.getTime() > existingEndsAt.getTime() + 60_000) {
      throw new CampaignUpdateError(BAD_REQUEST, "this campaign is ending through an approved proposal, so its end date can't be extended");
    }
  }

  // A published campaign keeps the asset its pool was set up in (participants were promised it)
  if (campaignFound.status !== "Save" && body.rewardAsset && (campaignFound.contractAddress || existingPool > 0)) {
    const current = campaignRewardAsset(campaignFound);
    if (current.network !== body.rewardAsset.network || current.token !== body.rewardAsset.token) {
      throw new CampaignUpdateError(BAD_REQUEST, "the reward token can't be changed after the campaign is published");
    }
  }

  if (campaignFound.status !== "Save" && campaignFound.contractAddress && existingPool > 0) {
    if (
      rewardsContractSettled &&
      existingEndsAt &&
      incomingEndsAt &&
      incomingEndsAt.getTime() > existingEndsAt.getTime()
    ) {
      throw new CampaignUpdateError(BAD_REQUEST, "this rewards campaign cannot be extended because its remaining funds have already been withdrawn");
    }

    if (campaignHasStarted) {
      if (incomingPool < existingPool) {
        throw new CampaignUpdateError(BAD_REQUEST, "reward pool cannot be reduced after publishing");
      }
      if (incomingMaxParticipants < existingMaxParticipants) {
        throw new CampaignUpdateError(BAD_REQUEST, "participant limit cannot be reduced after publishing");
      }
    }

  }

  // Recalculate status atomically when dates change on a published campaign
  if (campaignFound.status !== "Save") {
    const now = new Date();
    const newStartsAt = updateFields.starts_at
      ? parseDate(updateFields.starts_at)
      : parseDate(campaignFound.starts_at);
    const newEndsAt = updateFields.ends_at
      ? parseDate(updateFields.ends_at)
      : parseDate(campaignFound.ends_at);

    if (newEndsAt && newEndsAt <= now) {
      updateFields.status = "Ended";
    } else if (newStartsAt && newStartsAt > now) {
      updateFields.status = "Scheduled";
    } else {
      updateFields.status = "Active";
    }
  }

  await campaign.findByIdAndUpdate(id, updateFields, { new: true });

  // Update quests without destroying existing IDs/submissions
  if (questsToSave !== null) {
    const existingQuests = await campaignQuest.find({ campaign: id }).select("_id").lean();
    const existingQuestIds = existingQuests.map((q: any) => q._id.toString());
    const incomingQuestIds = questsToSave
      .map((q: any) => q._id?.toString())
      .filter(Boolean);

    const questsToUpdate = questsToSave.filter((q: any) => q._id);
    const questsToInsert = questsToSave.filter((q: any) => !q._id);

    if (questsToUpdate.length > 0) {
      // Per-task Discord validation on the update path: refuse malformed
      // tag flips/channels on existing quests as well (e.g. swapping a "like"
      // task's tag to "send-message-discord" without channelId would have silently
      // persisted before this guard).
      for (let i = 0; i < questsToUpdate.length; i++) {
        const taskCheck = validateDiscordTaskConfig(questsToUpdate[i] as any);
        if (!taskCheck.success) {
          throw new CampaignUpdateError(BAD_REQUEST, `task #${i + 1}: ${taskCheck.error}`);
        }
      }
      await campaignQuest.bulkWrite(
        questsToUpdate.map((q: any) => {
          const { _id, ...rest } = q;
          const updatePayload = isDiscordCampaignTask(q)
            ? { ...rest, campaign: new mongoose.Types.ObjectId(id), guildId: discordGuildIdForCampaign }
            : { ...rest, campaign: new mongoose.Types.ObjectId(id) };

          return {
            updateOne: {
              filter: {
                _id: new mongoose.Types.ObjectId(_id),
                campaign: new mongoose.Types.ObjectId(id)
              },
              update: { $set: updatePayload },
            }
          };
        })
      );
    }

    if (questsToInsert.length > 0) {
      // Newly inserted rows also go through the per-task Discord validation to
      // keep behaviour consistent with the create-only branch above.
      for (let i = 0; i < questsToInsert.length; i++) {
        const taskCheck = validateDiscordTaskConfig(questsToInsert[i] as any);
        if (!taskCheck.success) {
          throw new CampaignUpdateError(BAD_REQUEST, `task #${i + 1}: ${taskCheck.error}`);
        }
      }
      await campaignQuest.insertMany(
        questsToInsert.map((q: any) => (
          isDiscordCampaignTask(q)
            ? { ...q, campaign: id, guildId: discordGuildIdForCampaign }
            : { ...q, campaign: id }
        ))
      );
    }

    const questIdsToDelete = existingQuestIds.filter((existingId) => !incomingQuestIds.includes(existingId));
    if (questIdsToDelete.length > 0) {
      await campaignQuest.deleteMany({ _id: { $in: questIdsToDelete }, campaign: id });
    }

    await campaign.findByIdAndUpdate(id, { noOfQuests: questsToSave.length });
  }
  // The fixed XP follows the campaign's stages (also covers approved edit proposals)
  await syncCampaignXp(id);
}

export const saveCampaign = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const bodyError = prepareCampaignSaveBody(req.body);

    const hubFound = await hub.findById(req.admin.hub).lean();
    if (!hubFound) {
      res.status(BAD_REQUEST).json({ error: "create a hub to continue" });
      return;
    }

    // Parse campaignQuests if provided
    let questsToSave: any[] | null = null;
    if (req.body.campaignQuests !== undefined) {
      try {
        questsToSave = typeof req.body.campaignQuests === "string"
          ? JSON.parse(req.body.campaignQuests)
          : req.body.campaignQuests;
      } catch { /* ignore */ }
    }

    if (bodyError) {
      res.status(BAD_REQUEST).json({ error: bodyError });
      return;
    }

    // A published campaign only changes through an approved "editCampaign" proposal in Admin Management
    const { id: existingId } = req.query as { id?: string };
    if (existingId && !req.isPlatformAdmin) {
      const existing = await campaign.findById(existingId).select("status").lean();
      if (existing && existing.status !== "Save") {
        res.status(FORBIDDEN).json({ error: "this campaign is published, so changes need an approved proposal in Admin Management" });
        return;
      }
    }

    const coverImageBuffer = req.file?.buffer;
    const { hubCoverImage } = req.body;

    if (hubCoverImage && coverImageBuffer) {
      // remove previous cover image
      req.body.coverImage = await uploadImg({
        file: coverImageBuffer,
        filename: req.file?.originalname,
        folder: "cover-images",
        maxSize: 2 * 1024 ** 2
      });
    } else if (coverImageBuffer && !hubCoverImage) {
      req.body.coverImage = await uploadImg({
        file: coverImageBuffer,
        filename: req.file?.originalname,
        folder: "cover-images",
        maxSize: 2 * 1024 ** 2
      });
    }

    const { id } = req.query as { id: string };
    if (!id) {
      // Fill in defaults for required model fields not yet provided in a draft
      const [campaignCount] = await Promise.all([
        campaign.countDocuments({ creator: req.id }),
      ]);
      const reward = req.body.reward ?? {};
      const body = {
        ...pickCampaignSaveFields(req.body),
        project_image: hubFound.logo ?? "pending",
        project_name: hubFound.name ?? req.body.nameOfProject ?? "",
        sub_title: req.body.description ?? "",
        totalXpAvailable: reward.xp ?? 0,
        totalTrustAvailable: reward.pool ?? 0,
        campaignNumber: campaignCount + 1,
        projectCoverImage: req.body.coverImage ?? "pending",
        creator: req.id,
        hub: req.admin.hub,
        reward: {
          xp: reward.xp ?? 0,
          pool: reward.pool ?? 0,
          trustTokens: reward.trust ?? 0,
        },
      };

      const savedCampaign = await campaign.create(body);
      const savedCampaignId = savedCampaign._id;

      // Save quests
      if (questsToSave !== null) {
        // Per-task Discord validation: refuse to persist quests that the
        // verifier will immediately reject with "missing discord channel/role".
        for (let i = 0; i < questsToSave.length; i++) {
          const taskCheck = validateDiscordTaskConfig(questsToSave[i] as any);
          if (!taskCheck.success) {
            res.status(BAD_REQUEST).json({
              error: `task #${i + 1}: ${taskCheck.error}`,
            });
            return;
          }
        }
        await campaignQuest.deleteMany({ campaign: savedCampaignId });
        if (questsToSave.length > 0) {
          await campaignQuest.insertMany(
            questsToSave.map((q: any) => (
              isDiscordCampaignTask(q) ? { ...q, campaign: savedCampaignId, guildId: hubFound.guildId } :
              { ...q, campaign: savedCampaignId }))
          );
        }
        await campaign.findByIdAndUpdate(savedCampaignId, { noOfQuests: questsToSave.length });
      }

      await syncCampaignXp(savedCampaignId);
      res.status(CREATED).json({ message: 'Campaign saved successfully', campaignId: savedCampaign._id });
      return;
    }

    await applyCampaignUpdate(id, hubFound, req.body, questsToSave);
    res.status(OK).json({ campaignId: id });
  } catch (error: any) {
    if (error instanceof CampaignUpdateError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: 'Failed to save campaign' });
  }
}

/** Uploads a new cover for a published campaign's edit proposal; the proposal carries the returned URL. */
export const uploadCampaignCover = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    if (!req.file?.buffer) {
      res.status(BAD_REQUEST).json({ error: "send a cover image" });
      return;
    }
    const url = await uploadImg({ file: req.file.buffer, filename: req.file.originalname, folder: "cover-images", maxSize: 2 * 1024 ** 2 });
    res.status(OK).json({ url });
  } catch (error: any) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Failed to upload the cover image" });
  }
};

export const saveCampaignWithQuests = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    if (typeof req.body.reward === "string") try { req.body.reward = JSON.parse(req.body.reward); } catch { /* leave */ }
    if (typeof req.body.campaignQuests === "string") try { req.body.campaignQuests = JSON.parse(req.body.campaignQuests); } catch { /* leave */ }

    const { error } = validateCampaignData(req.body);
    if (error) {
      const emptyFields = getMissingFields(error);
      res.status(BAD_REQUEST).json({ error: `Missing required fields: ${emptyFields}` });
      return;
    }

    const hubFound = await hub.findById(req.admin.hub).lean();
    if (!hubFound) {
      res.status(BAD_REQUEST).json({ error: "create a hub to continue" });
      return;
    }

    const { id } = req.query as { id: string };

    let campaignId = id;
    if (!campaignId) {
      const coverImageBuffer = req.file?.buffer;

      if (!coverImageBuffer) {
        res.status(BAD_REQUEST).json({ error: "cover image is required" });
        return;
      }

      req.body.projectCoverImage = await uploadImg({
        file: coverImageBuffer,
        filename: req.file?.originalname,
        folder: "cover-images",
        maxSize: 2 * 1024 ** 2
      });
      const savedCampaign = await campaign.create({ ...withoutServerCampaignFields(req.body), hub: req.admin.hub, creator: req.id });

      campaignId = savedCampaign._id.toString();
    } else {
      const campaignFound = await campaign.findById(campaignId).lean();
      if (!campaignFound) {
        res.status(NOT_FOUND).json({ error: "campaign not found" });
        return;
      }

      if (campaignFound.status !== "Save" && !req.isPlatformAdmin) {
        res.status(FORBIDDEN).json({ error: "this campaign is published, so changes need an approved proposal in Admin Management" });
        return;
      }

      await campaign.findByIdAndUpdate(id, withoutServerCampaignFields(req.body.campaignData), { new: true });
    }

    const { error: questError } = validateCampaignQuestData(req.body.questData);
    if (questError) {
      const emptyFields = getMissingFields(questError);
      res.status(BAD_REQUEST).json({ error: `Missing required fields: ${emptyFields}` });
      return;
    }

    const createdQuests = [];

    const newQuests = [];

    for (const qd of req.body.questData) {
      const taskCheck = validateDiscordTaskConfig(qd as Record<string, any>);
      if (!taskCheck.success) {
        res.status(BAD_REQUEST).json({ error: taskCheck.error });
        return;
      }
      const questData = isDiscordCampaignTask(qd)
        ? { ...qd, guildId: hubFound.guildId }
        : { ...qd };

      if (qd.campaign && qd._id) {
        // Only tasks of this campaign can be updated, and they can't be moved to another campaign
        questData.campaign = new mongoose.Types.ObjectId(campaignId);
        createdQuests.push({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(qd._id), campaign: new mongoose.Types.ObjectId(campaignId) },
            update: {
              $set: {
                ...questData,
              }
            }
          }
        });
      } else {
        qd.campaign = campaignId;
        qd.guildId = isDiscordCampaignTask(qd) ? hubFound.guildId : undefined;
        newQuests.push({ ...qd,  })
      }
    }

    if (createdQuests.length && !newQuests.length) {
      await campaignQuest.bulkWrite(createdQuests);
    } else if (!createdQuests.length && newQuests.length) {
      await campaignQuest.insertMany(newQuests);
    } else {
      await campaignQuest.bulkWrite(createdQuests);
      await campaignQuest.insertMany(newQuests);
    }

    await syncCampaignXp(campaignId);
    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: 'Failed to save campaign and quests' });
  }
}

export const deleteCampaignQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id } = req.query as { id: string };
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "send the quest id" });
      return;
    }

    const questToBeDeleted = await campaignQuest.findById(id).lean();
    if (!questToBeDeleted) {
      res.status(BAD_REQUEST).json({ error: "quest id is invalid" });
      return;
    }

    if (await taskOnPublishedCampaign(questToBeDeleted, req)) {
      res.status(FORBIDDEN).json({ error: "this campaign is published, so changes need an approved proposal in Admin Management" });
      return;
    }

    await campaignQuest.findByIdAndDelete(id);

    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error deleting campaign quest" });
  }
}

async function taskOnPublishedCampaign(task: any, req: GlobalRequest): Promise<boolean> {
  if (req.isPlatformAdmin) return false;
  const parent = await campaign.findById(task.campaign).select("status").lean() as any;
  return !!parent && parent.status !== "Save";
}

export const updateCamapaignQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id } = req.query as { id: string };
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "send quest id" });
      return;
    }

    const exists = await campaignQuest.findById(id);
    if (!exists) {
      res.status(NOT_FOUND).json({ error: "quest not found, id is invalid" });
      return;
    }

    if (await taskOnPublishedCampaign(exists, req)) {
      res.status(FORBIDDEN).json({ error: "this campaign is published, so changes need an approved proposal in Admin Management" });
      return;
    }

    const { _id: _ignoredId, campaign: _ignoredCampaign, guildId: _ignoredGuild, ...changes } = req.body ?? {};
    await campaignQuest.findByIdAndUpdate(id, changes);

    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error updating quest" });
  }
}

export const createUserHub = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    // Log received data for debugging
    console.log('[createUserHub] Received data:', {
      bodyKeys: Object.keys(req.body || {}),
      name: req.body?.name,
      description: req.body?.description,
      descriptionLength: req.body?.description?.length,
      reqId: req.id,
      hasAdmin: !!req.admin
    });

    // Handle both JSON body and FormData
    const bodyData = req.body || {};
    console.log('[createUserHub] Received request:', {
      userId: req.id,
      name: bodyData.name,
      description: bodyData.description,
      descriptionLength: bodyData.description?.length
    });
    const { error } = validateUserHubData(bodyData);
    
    if (error) {
      console.log('[createUserHub] Validation error:', error);
      const emptyFields = getMissingFields(error);

      res
        .status(BAD_REQUEST)
        .json({ error: `these field(s) are required: ${emptyFields}` });
      return;
    }

    const name = String(bodyData.name ?? "").trim().toUpperCase();

    const existingUserHubWithName = await userHub.findOne({ name });
    if (existingUserHubWithName) {
      if (String(existingUserHubWithName.superAdmin) === String(req.id)) {
        // Already their hub, just update description and return success
        await userHub.findByIdAndUpdate(existingUserHubWithName._id, {
          description: bodyData.description ?? existingUserHubWithName.description,
          xAccount: String(bodyData.xAccount ?? existingUserHubWithName.xAccount).trim(),
        });
        res.status(OK).json({ message: "user hub updated!" });
        return;
      }
      res.status(BAD_REQUEST).json({ error: "name is already in use" });
      return;
    }

    const xAccount = String(bodyData.xAccount ?? "").trim();

    const hubAdminDoc = await userHubAdmin.findById(req.id).lean();
    const adminName = (hubAdminDoc as any)?.name;
    let logoUrl = "";
    if (adminName) {
      const mainUser = await user.findOne({ username: adminName }).lean();
      logoUrl = (mainUser as any)?.profilePic || "";
    }
    const createdHub = await userHub.create({
      name,
      description: bodyData.description ?? "",
      xAccount,
      logo: logoUrl,
      userId: req.id,
      superAdmin: req.id,
    });

    await userHubAdmin.findByIdAndUpdate(req.id, { hub: createdHub._id, pendingTxHash: null });

    // Migrate any pending payment hash from user to hub (payment represents completed on-chain studio fee)
    if (hubAdminDoc?.pendingTxHash) {
      await userHub.findByIdAndUpdate(createdHub._id, { pendingTxHash: hubAdminDoc.pendingTxHash, $inc: { noOfPayments: 1 } });
    }

    console.log('[createUserHub] Hub created successfully:', {
      hubId: createdHub._id,
      name: createdHub.name,
      description: createdHub.description
    });

    res.status(CREATED).json({ message: "user hub created!" });
  } catch (error: any) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "Error creating user hub" });
  }
};

export const updateUserHub = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const hubId = req.admin.hub;
    if (!hubId) {
      res.status(BAD_REQUEST).json({ error: "no hub associated with this account" });
      return;
    }

    const { name, bio, xAccount } = req.body;
    const logoFile = req.file?.buffer;

    const updateFields: any = {};
    if (name) updateFields.name = String(name).trim().toUpperCase();
    if (bio) updateFields.description = bio;
    if (xAccount) updateFields.xAccount = xAccount;

    if (logoFile) {
      updateFields.logo = await uploadImg({
        file: logoFile,
        filename: req.file?.originalname as string,
        folder: "user-hub-logos",
        maxSize: 1 * 1024 ** 2,
      });
    }

    const updated = await userHub.findByIdAndUpdate(hubId, updateFields, { new: true });
    if (!updated) {
      res.status(NOT_FOUND).json({ error: "user hub not found" });
      return;
    }

    res.status(OK).json({ message: "user hub updated!", hub: updated });
  } catch (error: any) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error updating user hub" });
  }
};

export const getUserHub = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const hubId = req.admin.hub;
    const hubFound = await userHub.findById(hubId).lean() as any;
    const adminHash = (req.admin as any).pendingTxHash ?? null;
    const pendingTxHash = hubFound?.pendingTxHash ?? adminHash;
    const adminInfo = { _id: req.id, name: req.admin.name, email: req.admin.email, role: "admin" };
    res.status(OK).json({ hub: hubFound ? { ...hubFound, pendingTxHash } : { pendingTxHash }, admin: adminInfo });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error getting user hub" });
  }
};

export const deleteUserHub = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const hubId = req.admin.hub;
    if (!hubId) {
      res.status(BAD_REQUEST).json({ error: "no hub associated with this account" });
      return;
    }

    await userHub.findByIdAndDelete(hubId);
    await userHubAdmin.findByIdAndUpdate(req.id, { $unset: { hub: "" } });

    res.status(OK).json({ message: "user hub deleted successfully" });
  } catch (error: any) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error deleting user hub" });
  }
};



export const getUserProfileByWallet = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { address } = req.query as { address?: string };
    if (!address) {
      res.status(BAD_REQUEST).json({ error: "address query param is required" });
      return;
    }

    const userFound = await user.findOne({ address: address.toLowerCase() }, { username: 1, profilePic: 1 }).lean();
    if (!userFound) {
      res.status(NOT_FOUND).json({ error: "no user found for this wallet" });
      return;
    }

    res.status(OK).json({ username: userFound.username, profilePic: userFound.profilePic || "" });
  } catch (error: any) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error fetching user profile" });
  }
};

export const MAX_USERNAME_CHANGES = 2;

/** GET /hub/notifications: project settings notices for me, newest first. */
export const getHubNotifications = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const items = await hubNotification.find({ hub: req.admin?.hub, recipients: req.id })
      .sort({ createdAt: -1 }).limit(50).lean() as any[];
    res.status(OK).json({ items: items.map(n => noticeJson(n, req.id)) });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error loading notifications" });
  }
};

const noticeJson = (n: any, me?: string) => ({
  id: String(n._id), kind: n.kind, actorName: n.actorName, changes: n.changes ?? [], details: n.details ?? [],
  tab: n.tab ?? "project", createdAt: n.createdAt, readByMe: (n.readBy ?? []).some((r: unknown) => String(r) === String(me)),
});

export const getHubActivity = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const hubId = req.admin?.hub;
    const [items, launched] = await Promise.all([
      hubNotification.find({ hub: hubId, kind: { $ne: "campaign" } }).sort({ createdAt: -1 }).limit(200).lean() as Promise<any[]>,
      campaign.find({ hub: hubId, status: { $in: ["Active", "Scheduled", "Ended"] } }).select("title status publishSignature createdAt updatedAt").sort({ createdAt: -1 }).limit(100).lean() as Promise<any[]>,
    ]);
    const publisherIds = [...new Set(launched.map(c => c.publishSignature?.adminId).filter((id): id is string => mongoose.Types.ObjectId.isValid(id ?? "")))];
    const names = new Map((await hubAdmin.find({ _id: { $in: publisherIds } }).select("name").lean() as any[]).map(a => [String(a._id), String(a.name ?? "")]));
    const campaigns = launched.map(c => ({
      id: `campaign:${c._id}`, kind: "campaign", actorName: names.get(String(c.publishSignature?.adminId)) ?? "",
      changes: ["campaign"], details: [{ field: "campaign", from: c.status === "Scheduled" ? "Scheduled" : "Active", to: String(c.title ?? "") }],
      tab: "project", createdAt: c.publishSignature?.signedAt ?? c.createdAt, readByMe: true,
    }));
    res.status(OK).json({ items: [...items.map(n => noticeJson(n, req.id)), ...campaigns] });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error loading the change history" });
  }
};

/** POST /hub/notifications/read { ids?: string[] }: marks my notices read (all when ids is omitted). */
export const markHubNotificationsRead = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id)) : null;
    await hubNotification.updateMany(
      { hub: req.admin?.hub, recipients: req.id, ...(ids ? { _id: { $in: ids } } : {}) },
      { $addToSet: { readBy: req.id } },
    );
    res.status(OK).json({ ok: true });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error marking notifications read" });
  }
};

export const checkUsernameAvailable = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const username = String(req.query.username ?? "").trim();
    if (!USERNAME_RULE.test(username)) {
      res.status(OK).json({ available: false, reason: "Use 3 to 30 letters, numbers, dots or underscores." });
      return;
    }
    const taken = await usernameTaken(username, req.admin?.hub, req.id);
    res.status(OK).json({ available: !taken, reason: taken ? "That username is taken." : null });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error checking username" });
  }
};

export const changeUsername = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    if (!USERNAME_RULE.test(username)) {
      res.status(BAD_REQUEST).json({ error: "Use 3 to 30 letters, numbers, dots or underscores." });
      return;
    }
    if (await usernameTaken(username, req.admin?.hub, req.id)) {
      res.status(BAD_REQUEST).json({ error: "That username is taken." });
      return;
    }
    const updated = await hubAdmin.findOneAndUpdate(
      { _id: req.id, $or: [{ usernameChanges: { $lt: MAX_USERNAME_CHANGES } }, { usernameChanges: null }] },
      { $set: { name: username }, $inc: { usernameChanges: 1 } },
      { new: true }
    ).select("name usernameChanges").lean() as any;
    if (!updated) {
      res.status(FORBIDDEN).json({ error: `You can change your username only ${MAX_USERNAME_CHANGES} times.` });
      return;
    }
    void recordHubActivity(req, "username", [{ field: "username", from: String(req.admin?.name ?? ""), to: updated.name }]);
    res.status(OK).json({ name: updated.name, usernameChanges: updated.usernameChanges, changesLeft: Math.max(0, MAX_USERNAME_CHANGES - updated.usernameChanges) });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error changing username" });
  }
};
