import { updateAdminLastActivity } from "@/utils/adminActivityCron";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import logger from "@/config/logger";
import { quest, miniQuest } from "@/models/quests.model";
import { lesson, lessonCompleted, miniLesson, question, questionCompleted, videoLesson } from "@/models/lesson.model";
import { admin } from "@/models/admin.model";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND, NO_CONTENT, OK, UNAUTHORIZED, FORBIDDEN } from "@/utils/status.utils";
import { campaign as campaignModel, campaignCompleted } from "@/models/campaign.model";
import { generateOTP, getRefreshToken, hashPassword, JWT, validateQuestData } from "@/utils/utils";
import { sendAdminResetEmail, sendEmailToAdmin } from "@/utils/sendMail";
import { campaignQuestCompleted, miniQuestCompleted, questCompleted } from "@/models/questsCompleted.models";
import { submission } from "@/models/submission.model";
import { user } from "@/models/user.model";
import { hub, hubAdmin, userHub, userHubAdmin } from "@/models/hub.model";
import { bannedUser } from "@/models/bannedUser.model";
import { REDIS } from "@/utils/redis.utils";
import { xpLog } from "@/models/xpLog.model";
import { ADMIN_CAMPAIGN_SYSTEM_KEY } from "@/utils/adminCampaignHub";

const MAX_ADMIN_LEADERBOARD_LIMIT = 500;
const DEFAULT_ADMIN_LEADERBOARD_LIMIT = 500;

const parsePositiveInt = (value: unknown, fallback: number) => {
	if (typeof value !== "string") return fallback;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeLeaderboardLimit = (value: unknown) =>
	Math.min(parsePositiveInt(value, DEFAULT_ADMIN_LEADERBOARD_LIMIT), MAX_ADMIN_LEADERBOARD_LIMIT);

const normalizeAdminRole = (role: unknown): "superadmin" | "admin" =>
	role === "superadmin" ? "superadmin" : "admin";

const buildAdminInviteCode = () => generateOTP();
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const formatAdminRecord = (record: {
	_id: unknown;
	username?: string | null;
	email: string;
	role: "superadmin" | "admin";
	createdAt?: Date;
	lastActivity?: Date | null;
	isOnline?: boolean;
}) => ({
	_id: record._id,
	name: record.username?.trim() || record.email.split("@")[0],
	username: record.username ?? undefined,
	email: record.email,
	role: record.role,
	createdAt: record.createdAt,
	lastActivity: record.lastActivity ?? null,
	isOnline: Boolean(record.isOnline),
});

const deriveBanTimestamp = (record: { _id: unknown; createdAt?: Date | string }) => {
  if (record.createdAt) {
    return record.createdAt;
  }

  const id = typeof record._id === "string" ? record._id : String(record._id);
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id).getTimestamp();
  }

  return null;
};

const buildAdminAuthPayload = (record: {
  _id: unknown;
  username?: string | null;
  email: string;
  role: "superadmin" | "admin";
  createdAt?: Date;
  lastActivity?: Date | null;
  isOnline?: boolean;
}) => {
  const id = String(record._id);
  const accessToken = JWT.sign(id);
  const refreshToken = getRefreshToken(id);

  return {
    id,
    accessToken,
    refreshToken,
    admin: formatAdminRecord(record),
  };
};

export const deleteQuestAdmin = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
      return;
    }
    
    const exists = await quest.exists({ _id: id }).select("_id creator creatorModel").lean();
    if (!exists) {
      res.status(NOT_FOUND).json({ error: "quest not found" });
      return;
    }

    if (exists.creatorModel === "user") {
      const userHubFound = await userHub.findById(exists.creator).select("name").lean();

      if (!userHubFound) {
        res.status(NOT_FOUND).json({ error: "hub id attached to quest does not exist" });
        return;
      }

      await user.findByIdAndUpdate(userHubFound.userId, { $inc: { xp: -2000 } });
    }

    await Promise.all([
      quest.findByIdAndDelete(id),
      miniQuest.deleteMany({ quest: id }),
      miniQuestCompleted.deleteMany({ quest: id }),
      questCompleted.deleteMany({ quest: id }),
    ]);

    res.status(OK).json({ message: "quest deleted successfully" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error deleting quest" });
  }
}

export const deleteLessonAdmin = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id: lessonId } = req.query as { id: string };

    if (!lessonId) {
      res.status(BAD_REQUEST).json({ error: "lesson id is required" });
      return;
    }

    const lessonCreator = await lesson.findById(lessonId).select("creator creatorModel").lean();
    if (!lessonCreator) {
      res.status(NOT_FOUND).json({ error: "lesson to be deleted does not exists" });
      return;
    }

    if (lessonCreator.creatorModel === "user-hubs") {
      const userHubFound = await userHub.findById(lessonCreator.creator);

      if (!userHubFound) {
        res.status(NOT_FOUND).json({ error: "hub id attached to lesson does not exist" });
        return;
      }

      await user.updateOne({ username: userHubFound.name }, { $inc: { xp: -3500 } });
    }

    await Promise.all([
      lesson.deleteOne({ _id: lessonId }),
      miniLesson.deleteMany({ lesson: lessonId }),
      question.deleteMany({ lesson: lessonId }),
      videoLesson.deleteMany({ lesson: lessonId }),
      lessonCompleted.deleteMany({ lesson: lessonId }),
      questionCompleted.deleteMany({ lesson: lessonId }),
    ]);

    res.status(OK).json({ message: "lesson deleted" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error deleting lesson" });
  }
};

export const createQuest = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { success } = validateQuestData(req.body);
		if (!success) {
			res
				.status(BAD_REQUEST)
				.json({ error: "send the correct data required to create a quest" });
			return;
		}

		const hubUserId = req.admin.hub;

		const createdHub = await hub.findById(hubUserId);
		if (!createdHub) {
			res
				.status(NOT_FOUND)
				.json({ error: "id associated with hub is invalid" });
			return;
    }

    await quest.create({ ...req.body, hub: createdHub._id });

		res.status(OK).json({ message: "quest created!" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error creating quest" });
	}
};

export const rewardXp = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { address, xp }: { address: string, xp: string } = req.body;

		if (!address || !xp) {
			res.status(BAD_REQUEST).json({ error: "address and xp are required" });
			return;
    }

    const lowerAddress = address.toLowerCase();

		const xpAmount = parseInt(xp, 10);
		const userExists = await user.findOne({ address: lowerAddress });

		if (userExists) {
			await user.updateOne({ address: lowerAddress }, { $inc: { xp: xpAmount, eventsWon: 1 } });
			await xpLog.create({
				address: lowerAddress,
				amount: xpAmount,
				status: "success",
        type: "single",
				username: userExists.username,
				adminId: req.id ? new mongoose.Types.ObjectId(req.id) : undefined
			});
		} else {
			await xpLog.create({
				address: lowerAddress,
        amount: xpAmount,
				status: "failed",
				type: "single",
				adminId: req.id ? new mongoose.Types.ObjectId(req.id) : undefined
			});
			res.status(NOT_FOUND).json({ error: "user not found" });
			return;
		}

		res.status(OK).json({ message: "xp rewarded" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" });
	}
};

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const MAX_BATCH_WALLETS = 500;

export const rewardXpBatch = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { addresses, xp }: { addresses: unknown; xp: unknown } = req.body;

		if (!Array.isArray(addresses) || addresses.length === 0) {
			res.status(BAD_REQUEST).json({ error: "addresses must be a non-empty array" });
			return;
		}

		if (addresses.length > MAX_BATCH_WALLETS) {
			res.status(BAD_REQUEST).json({ error: `max ${MAX_BATCH_WALLETS} wallets per batch` });
			return;
		}

		const xpAmount = typeof xp === "number" ? xp : typeof xp === "string" ? parseInt(xp, 10) : NaN;
		if (!Number.isFinite(xpAmount) || xpAmount <= 0) {
			res.status(BAD_REQUEST).json({ error: "xp must be a positive number" });
			return;
		}

		const invalid: string[] = [];
		const seen = new Set<string>();
		const normalized: string[] = [];
		for (const raw of addresses) {
			if (typeof raw !== "string") continue;
			const trimmed = raw.trim();
			if (!trimmed) continue;
			if (!EVM_ADDRESS_RE.test(trimmed)) {
				invalid.push(trimmed);
				continue;
			}
			const lower = trimmed.toLowerCase();
			if (seen.has(lower)) continue;
			seen.add(lower);
			normalized.push(lower);
		}

		if (normalized.length === 0) {
			res.status(OK).json({
				message: "no valid addresses",
				rewarded: 0,
				notFound: 0,
				invalid,
				xp: xpAmount,
			});
			return;
		}

		const existing = await user.find({ address: { $in: normalized } }, { address: 1, username: 1 }).lean();
		const matched = normalized.filter((addr) => existing.some((u) => (u.address).toLowerCase() === addr)) as unknown as { address: string, username: string }[];
		const notFound = normalized.filter((addr) => !existing.some((u) => (u.address).toLowerCase() === addr)) as unknown as { address: string, username: string }[];;

		const logs: any[] = [];
		const adminObjId = req.id ? new mongoose.Types.ObjectId(req.id) : undefined;

		for (const match of matched) {
			logs.push({
        address: match.address,
				username: match.username,
				amount: xpAmount,
				status: "success",
				type: "batch",
				adminId: adminObjId
			});
		}

		for (const nf of notFound) {
			logs.push({
        address: nf.address,
				username: nf.username,
				amount: xpAmount,
				status: "failed",
				type: "batch",
				adminId: adminObjId
			});
		}

		if (logs.length > 0) {
			await xpLog.insertMany(logs);
		}

		if (matched.length > 0) {
			await user.updateMany(
				{ address: { $in: matched } },
				{ $inc: { xp: xpAmount, eventsWon: 1 } },
			);
		}

		res.status(OK).json({
			message: "batch xp rewarded",
			rewarded: matched.length,
			notFound: notFound.length,
			notFoundAddresses: notFound,
			invalid,
			xp: xpAmount,
		});
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error performing batch xp reward" });
	}
};

export const banUser = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { userId }: { userId: string } = req.body;

		const userExists = await user.findById(userId).lean();
		if (!userExists) {
			res.status(NOT_FOUND).json({ error: "user does not exist" });
			return;
		}

		await submission.updateMany({ user: userId }, { status: "banned" });
		await bannedUser.create({ userId, walletAddress: userExists.address });

		res.status(OK).json({ message: "user banned" });
	} catch (error) {
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error banning user" });
	}
}

export const getAdmins = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const records = await admin.find().sort({ createdAt: -1 }).lean();
    const admins = records.filter((record) => record.verified).map(formatAdminRecord);
    const pendingInvites = records
      .filter((record) => !record.verified)
      .map((record) => ({
        _id: record._id,
        email: record.email,
        role: record.role,
        createdAt: record.createdAt,
      }));
    const currentAdmin = records.find((record) => record._id.toString() === req.id);

    res.status(OK).json({
      message: "admins fetched",
      admins,
      pendingInvites,
      currentAdmin: currentAdmin ? formatAdminRecord(currentAdmin) : null,
    });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching admins" });
  }
};

export const adminLogout = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { token } = req;

    await REDIS.set({ key: `logout:${token}`, data: { token }, ttl: 7 * 24 * 60 * 60 });

    res.clearCookie("refreshToken");

    res.status(OK).json({ message: "admin logged out" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error logging out admin" });
  }
};

export const removeAdmin = async (req: GlobalRequest, res: GlobalResponse) => {
  try {

    if (req.role !== "superadmin") {
      res.status(UNAUTHORIZED).json({ error: "only superadmin can remove admins" });
      return;
    }

		const { email }: { email: string } = req.body;
		if (!email) {
			res.status(BAD_REQUEST).json({ error: "send admin email" });
			return;
    }

		const adminExists = await admin.exists({ email });
		if (!adminExists) {
			res.status(NOT_FOUND).json({ error: "admin does not exist" });
			return;
		}

		if (adminExists._id.toString() === req.id) {
			res.status(BAD_REQUEST).json({ error: "you cannot remove your own account" });
			return;
		}

		await admin.findOneAndDelete({ email });

		res.status(OK).json({ message: "admin removed" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error removing admin" });
	}
}

export const addAdmin = async (req: GlobalRequest, res: GlobalResponse) => {
  try {

    if (req.role !== "superadmin") {
      res.status(UNAUTHORIZED).json({ error: "only superadmin can add admins" });
      return;
    }

		const { email, role, clientUrl }: { email: string, role: "superadmin" | "admin", clientUrl?: string } = req.body;
		if (!email) {
			res.status(BAD_REQUEST).json({ error: "send admin email" });
			return;
		}

		const normalizedEmail = email.trim().toLowerCase();
		if (!isValidEmail(normalizedEmail)) {
			res.status(BAD_REQUEST).json({ error: "send a valid admin email" });
			return;
		}

		const normalizedRole = normalizeAdminRole(role);
		const existingAdmin = await admin.findOne({ email: normalizedEmail });
		if (existingAdmin?.verified) {
			res.status(BAD_REQUEST).json({ error: "admin with email exists" });
			return;
		}

		const code = buildAdminInviteCode();
		if (existingAdmin) {
			existingAdmin.role = normalizedRole;
			existingAdmin.code = code;
			await existingAdmin.save();
		} else {
			const newAdmin = new admin({
				email: normalizedEmail,
				role: normalizedRole,
				code,
				verified: false,
			});
			await newAdmin.save();
		}

		await sendEmailToAdmin(normalizedEmail, code, clientUrl);

		res.status(OK).json({ message: "otp sent" });
	} catch (error) {
		console.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error adding admin" });
	}
}

export const resendAdminInvite = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    if (req.role !== "superadmin") {
      res.status(UNAUTHORIZED).json({ error: "only superadmin can resend admin invites" });
      return;
    }

    const { inviteId, clientUrl }: { inviteId?: string; clientUrl?: string } = req.body;
    if (!inviteId) {
      res.status(BAD_REQUEST).json({ error: "inviteId is required" });
      return;
    }

    const pendingAdmin = await admin.findOne({ _id: inviteId, verified: false });
    if (!pendingAdmin) {
      res.status(NOT_FOUND).json({ error: "pending invite does not exist" });
      return;
    }

    pendingAdmin.code = buildAdminInviteCode();
    await pendingAdmin.save();
    await sendEmailToAdmin(pendingAdmin.email, pendingAdmin.code, clientUrl);

    res.status(OK).json({ message: "admin invite resent" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error resending admin invite" });
  }
};

export const deleteAdminInvite = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    if (req.role !== "superadmin") {
      res.status(UNAUTHORIZED).json({ error: "only superadmin can delete admin invites" });
      return;
    }

    const inviteId = typeof req.query.id === "string" ? req.query.id : "";
    if (!inviteId) {
      res.status(BAD_REQUEST).json({ error: "invite id is required" });
      return;
    }

    const pendingAdmin = await admin.findOneAndDelete({ _id: inviteId, verified: false });
    if (!pendingAdmin) {
      res.status(NOT_FOUND).json({ error: "pending invite does not exist" });
      return;
    }

    res.status(OK).json({ message: "admin invite deleted" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error deleting admin invite" });
  }
};

export const adminLogin = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { email, password }: { email: string; password: string } = req.body;

		const adminExists = await admin.findOne({ email });
		if (!adminExists) {
			res.status(BAD_REQUEST).json({ error: "invalid credentials" });
			return;
		}

		const passwordCorrect = await bcrypt.compare(password, adminExists.password ?? "");
		if (!passwordCorrect) {
			res.status(BAD_REQUEST).json({ error: "invalid credentials" });
			return;
    }
		
    const { id, accessToken, refreshToken, admin: authAdmin } = buildAdminAuthPayload(adminExists.toObject());

		req.id = id;

		res.cookie("refreshToken", refreshToken, {
			httpOnly: true,
			secure: true,
			maxAge: 30 * 24 * 60 * 60,
		});

    // Update admin activity on login
    updateAdminLastActivity(id);
		res.status(OK).json({
      message: "admin logged in",
      accessToken,
      admin: authAdmin,
    });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching tasks" });
	}
};

export const createAdmin = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { password, email, code, username, name }: {
      username?: string;
      name?: string;
      password: string;
      code: string;
      email: string;
    } = req.body;
    const resolvedUsername = (username || name || "").trim();

		if (!password || !email || !resolvedUsername || !code) {
			res.status(BAD_REQUEST).json({ error: "send the required details" });
			return;
		}

		const semiAdmin = await admin.findOne({ email, verified: false });
		if (!semiAdmin) {
			res.status(NOT_FOUND).json({ error: "email is invalid or admin has been verified. contact master admin if issue persists" });
			return;
		}

		if (code !== semiAdmin.code) {
			res.status(UNAUTHORIZED).json({ error: "code sent is invalid" });
			return;
		}

		const hashedPassword = await hashPassword(password);

		semiAdmin.verified = true;
		semiAdmin.password = hashedPassword;
		semiAdmin.username = resolvedUsername;
		semiAdmin.code = "";

    await semiAdmin.save();

    const { id, accessToken, refreshToken, admin: authAdmin } = buildAdminAuthPayload(semiAdmin.toObject());

		req.id = id;

		res.cookie("refreshToken", refreshToken, {
			httpOnly: true,
			secure: true,
			maxAge: 30 * 24 * 60 * 60,
		});

		res.status(OK).json({
      message: "admin verified",
      accessToken,
      admin: authAdmin,
    });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching tasks" });
	}
};

export const getAdminQuestDetail = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
      return;
    }

    const found = await quest.findById(id).lean();
    if (!found) {
      res.status(NOT_FOUND).json({ error: "quest not found" });
      return;
    }

    const now = new Date();
    const parseDate = (val: unknown): Date | null => {
      if (!val) return null;
      const d = new Date(val as string | Date);
      return isNaN(d.getTime()) ? null : d;
    };

    const s = parseDate(found.starts_at);
    const e = parseDate(found.ends_at);
    let temporalStatus = found.status ?? "Active";
    if (e && e <= now) temporalStatus = "Ended";
    else if (s && s > now) temporalStatus = "Scheduled";
    else if (found.status !== "Save") temporalStatus = "Active";

    const questTasks = ((found as any).campaignQuests || (found as any).quests || []).map((t: any) => ({
      type: t.type || t.taskType || "",
      platform: t.platform || "",
      handleOrUrl: t.handleOrUrl || t.handle || "",
      description: t.description || "",
      evidence: t.evidence || "",
      validation: t.validation || "Manual Validation",
      verificationMode: t.verificationMode || "",
      roleId: t.roleId || "",
      channelId: t.channelId || "",
      guildId: t.guildId || "",
    }));

    res.status(OK).json({
      quest: {
        _id: String(found._id),
        title: found.title || "",
        description: found.description || found.project_name || "",
        status: temporalStatus,
        starts_at: found.starts_at ?? null,
        ends_at: found.ends_at ?? null,
        reward: found.reward ?? 0,
        page: (found as any).page ?? "",
        projectCoverImage: found.projectCoverImage || found.project_image || "",
        tasks: questTasks,
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching quest detail" });
  }
};

export const getAdminHubQuests = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const adminHub = req.admin?.hub ? String(req.admin.hub) : null;
    if (!adminHub) {
      res.status(BAD_REQUEST).json({ error: "admin has no associated hub" });
      return;
    }

    const quests = await quest
      .find({ hub: adminHub, status: { $ne: "Deleted" } })
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();
    const parseDate = (val: unknown): Date | null => {
      if (!val) return null;
      const d = new Date(val as string | Date);
      return isNaN(d.getTime()) ? null : d;
    };

    const getStatus = (q: any) => {
      if (q.status === "Save") return "Save";
      if (q.status === "Deleted") return "Deleted";
      if (q.status === "Ended") return "Ended";
      const s = parseDate(q.starts_at);
      const e = parseDate(q.ends_at);
      if (e && e <= now) return "Ended";
      if (s && s > now) return "Scheduled";
      return "Active";
    };

    const normalized = quests.map((q: any) => ({
      _id: String(q._id),
      title: q.title || "",
      description: q.description || q.project_name || "",
      projectCoverImage: q.projectCoverImage || "",
      status: getStatus(q),
      starts_at: q.starts_at ?? null,
      ends_at: q.ends_at ?? null,
      reward: q.reward ?? 0,
      page: q.page ?? "",
    }));

    res.status(OK).json({ quests: normalized });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching admin hub quests" });
  }
};

export const getTasks = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    // Submissions persist `hub` as a string (the hub's ObjectId stringified)
    // â€” see quest.controller.ts:793. Match the admin's resolved hub instead
    // of the historical "nexura-hub" placeholder so multi-hub campaigns'
    // submissions actually surface in the dashboard.
    const adminHub = req.admin?.hub ? String(req.admin.hub) : null;
    if (!adminHub) {
      res.status(BAD_REQUEST).json({ error: "admin has no associated hub" });
      return;
    }

    const pendingTasks = await submission
      .find({ hub: adminHub })
      .lean()
      .sort({ createdAt: 1 });

    res.status(OK).json({ message: "submitted tasks fetched", pendingTasks });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching tasks" });
  }
};

export const getXpHistory = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const history = await xpLog.find().sort({ timestamp: -1 }).limit(1000).lean();
		res.status(OK).json({ history });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching xp history" });
	}
};

export const searchUserXpHistory = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { address, username } = req.query;
    if (!address && !username) {
      res.status(BAD_REQUEST).json({ error: "address or username query parameter is required" });
      return;
    }

    let query: any = {};
    if (address) {
      query.address = String(address).trim().toLowerCase();
    }
    if (username) {
      query.username = { $regex: String(username).trim(), $options: "i" };
    }

    const history = await xpLog.find(query).sort({ timestamp: -1 }).limit(100).lean();

    res.status(OK).json({ history });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error searching user xp history" });
  }
}

export const getBannedUsers = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const bannedUsers = (await bannedUser.find().sort({ createdAt: -1 }).lean()).map((entry) => ({
      ...entry,
      bannedAt: deriveBanTimestamp(entry),
    }));

		res.status(OK).json({ message: "banned users fetched", bannedUsers });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching tasks" });
	}
};

export const forgotAdminPassword = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { email, clientUrl }: { email?: string; clientUrl?: string } = req.body;
    if (!email) {
      res.status(BAD_REQUEST).json({ error: "email is required" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      res.status(BAD_REQUEST).json({ error: "send a valid admin email" });
      return;
    }

    const adminExists = await admin.findOne({ email: normalizedEmail, verified: true }).lean();
    if (!adminExists) {
      res.status(NOT_FOUND).json({ error: "email associated with admin is invalid or does not exist" });
      return;
    }

    const token = JWT.sign(adminExists._id.toString(), "10m");
    await sendAdminResetEmail(normalizedEmail, token, clientUrl);

    res.status(OK).json({ message: "password reset email sent!" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error sending admin password reset email" });
  }
};

export const resetAdminPassword = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };

    if (!token || !password) {
      res.status(BAD_REQUEST).json({ error: "send token and password" });
      return;
    }

    const accessTokenUsed = await REDIS.get(`admin-reset-access-token:${token}`);
    if (accessTokenUsed) {
      res.status(BAD_REQUEST).json({ error: "access token already used, request a new one to change your password" });
      return;
    }

    const { id } = await JWT.verify(token) as { id: string };
    const adminExists = await admin.findOne({ _id: id, verified: true });

    if (!adminExists) {
      res.status(BAD_REQUEST).json({ error: "id associated with admin is invalid" });
      return;
    }

    adminExists.password = await hashPassword(password);
    await adminExists.save();

    await REDIS.set({ key: `admin-reset-access-token:${token}`, data: { token }, ttl: 10 * 60 });

    const { accessToken, refreshToken, admin: authAdmin } = buildAdminAuthPayload(adminExists.toObject());

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      maxAge: 30 * 24 * 60 * 60,
    });

    res.status(OK).json({
      message: "admin password reset successful!",
      accessToken,
      admin: authAdmin,
    });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error resetting admin password" });
  }
};

export const getUserSummary = async (_req: GlobalRequest, res: GlobalResponse) => {
	try {
		const totalUsers = await user.countDocuments();
		res.status(OK).json({ message: "user summary fetched", totalUsers });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching user summary" });
	}
};

export const getAdminLeaderboard = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const page = parsePositiveInt(req.query.page, 1);
		const limit = normalizeLeaderboardLimit(req.query.limit);
		const skip = (page - 1) * limit;

		const totalUsers = await user.countDocuments();
		const totalPages = totalUsers === 0 ? 1 : Math.ceil(totalUsers / limit);

		const items = await user
			.find()
			.sort({ xp: -1, trustClaimed: -1, _id: 1 })
			.select("_id address username profilePic eventsWon lessonsCompleted xp level questsCompleted campaignsCompleted noOfMints")
			.lean();

		const leaderboardItems = items.map((entry, index) => ({
			...entry,
			rank: index + 1,
		}));

		res.status(OK).json({
			message: "admin leaderboard fetched",
			items: leaderboardItems,
			totalUsers,
			totalPages,
			page,
			limit,
		});
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching admin leaderboard" });
	}
};

export const banCreator = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { creatorId }: { creatorId: string } = req.body;

		if (!creatorId) {
			res.status(BAD_REQUEST).json({ error: "creator id is required" });
			return;
		}

		// Try to find the creator as a user-hub first, then as a project hub
		let ownerId: string | null = null;
		let ownerAddress: string | null = null;

		// Check user-hubs
		const userHubDoc = await userHub.findById(creatorId).lean();
		if (userHubDoc) {
			// Find the user-hub admin
			const uha = await userHubAdmin.findOne({ hub: creatorId }).lean();
			if (uha) {
				ownerId = uha._id.toString();
				ownerAddress = uha.email; // use email as identifier for non-wallet accounts
			}
		}

		// Check project hubs
		if (!ownerId) {
			const hubDoc = await hub.findById(creatorId).lean();
			if (hubDoc) {
				// Find the hub admin
				const ha = await hubAdmin.findOne({ hub: creatorId }).lean();
				if (ha) {
					ownerId = ha._id.toString();
					ownerAddress = ha.email || "";
				}
			}
		}

		if (!ownerId) {
			res.status(NOT_FOUND).json({ error: "creator not found" });
			return;
		}

		// Skip if already banned
		const alreadyBanned = await bannedUser.findOne({ userId: ownerId }).lean();
		if (alreadyBanned) {
			res.status(BAD_REQUEST).json({ error: "creator is already banned" });
			return;
		}

		await bannedUser.create({ userId: ownerId, walletAddress: ownerAddress });
		res.status(OK).json({ message: "creator banned" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error banning creator" });
	}
};

export const unbanCreator = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { creatorId }: { creatorId: string } = req.body;

		if (!creatorId) {
			res.status(BAD_REQUEST).json({ error: "creator id is required" });
			return;
		}

		// Resolve creator to ownerId (same logic as banCreator)
		let ownerId: string | null = null;

		const userHubDoc = await userHub.findById(creatorId).lean();
		if (userHubDoc) {
			const uha = await userHubAdmin.findOne({ hub: creatorId }).lean();
			if (uha) ownerId = uha._id.toString();
		}

		if (!ownerId) {
			const hubDoc = await hub.findById(creatorId).lean();
			if (hubDoc) {
				const ha = await hubAdmin.findOne({ hub: creatorId }).lean();
				if (ha) ownerId = ha._id.toString();
			}
		}

		if (!ownerId) {
			// Try direct lookup in bannedUser
			ownerId = creatorId;
		}

		const banned = await bannedUser.findOne({ userId: ownerId }).lean();
		if (!banned) {
			res.status(BAD_REQUEST).json({ error: "creator is not banned" });
			return;
		}

		await bannedUser.findOneAndDelete({ userId: ownerId });
		res.status(OK).json({ message: "creator unbanned" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error unbanning creator" });
	}
};

export const getBannedCreators = async (_req: GlobalRequest, res: GlobalResponse) => {
	try {
		const banned = await bannedUser.find({}).sort({ createdAt: -1 }).lean();
		const adminIds = banned.map(b => b.userId);

		// Resolve admin IDs to hub IDs for frontend comparison
		const [userHubAdmins, projectHubAdmins] = await Promise.all([
			userHubAdmin.find({ _id: { $in: adminIds } }).select("hub").lean(),
			hubAdmin.find({ _id: { $in: adminIds } }).select("hub").lean(),
		]);

		const hubIds = new Set<string>();
		for (const a of userHubAdmins) { if (a.hub) hubIds.add(String(a.hub)); }
		for (const a of projectHubAdmins) { if (a.hub) hubIds.add(String(a.hub)); }

		res.status(OK).json({ bannedCreatorIds: [...hubIds] });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching banned creators" });
	}
};

export const unBanUser = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { userId }: { userId: string } = req.body;

		const bannedUserExists = await bannedUser.findById(userId).lean();
		if (!bannedUserExists) {
			res.status(BAD_REQUEST).json({ error: "banned user does not exist" });
			return;
		}

		await bannedUser.findByIdAndDelete(userId);
		await submission.updateMany({ user: bannedUserExists.userId }, { status: "pending" });

		res.status(OK).json({ message: "user unbanned" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching tasks" });
	}
};

export const manageAdmin = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    if (req.role !== "superadmin") {
      res.status(UNAUTHORIZED).json({ error: "only superadmin can manage other admins" });
      return;
    }

    const { action, adminId, adminName, newRole }: {
      action: "update_role" | "demote" | "revoke";
      adminId?: string;
      adminName?: string;
      newRole?: string;
    } = req.body;

    if (!action) {
      res.status(BAD_REQUEST).json({ error: "action is required" });
      return;
    }

    // Find target admin by ID or username
    const targetAdmin = adminId
      ? await admin.findById(adminId)
      : adminName
      ? await admin.findOne({ username: adminName })
      : null;

    if (!targetAdmin) {
      res.status(NOT_FOUND).json({ error: "admin not found" });
      return;
    }

    // Prevent acting on yourself regardless of how the target was identified
    if (targetAdmin._id.toString() === req.id) {
      res.status(BAD_REQUEST).json({ error: "you cannot manage your own account" });
      return;
    }

    if (action === "update_role") {
      const allowed = ["superadmin", "admin"];
      if (!newRole || !allowed.includes(newRole)) {
        res.status(BAD_REQUEST).json({ error: `newRole must be one of: ${allowed.join(", ")}` });
        return;
      }

      targetAdmin.role = newRole as "superadmin" | "admin";
      await targetAdmin.save();

      res.status(OK).json({ message: `admin role updated to ${newRole}` });
      return;
    }

    if (action === "demote") {
      targetAdmin.role = "admin";
      await targetAdmin.save();

      res.status(OK).json({ message: "admin demoted to admin role" });
      return;
    }

    if (action === "revoke") {
      await admin.findByIdAndDelete(targetAdmin._id);

      res.status(OK).json({ message: "admin access revoked" });
      return;
    }

    res.status(BAD_REQUEST).json({ error: "unknown action" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error managing admin" });
  }
};

export const markTask = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { id, action }: { id: string; action: string } = req.body;

		const adminExists = await admin.findById(req.id);
		if (!adminExists) {
			res.status(BAD_REQUEST).json({ error: "id associated with admin is invalid" });
			return;
		}

		const submissionToBeVerified = await submission.findById(id);

		if (!submissionToBeVerified) {
			res.status(NOT_FOUND).json({ error: "task does not exist" });
			return
		}

		let model;

		if (submissionToBeVerified.page === "quest") {
			model = await miniQuestCompleted.findOne({ _id: submissionToBeVerified.questCompleted, status: { $in: ["pending", "retry"] } });
			if (!model) {
				res.status(NOT_FOUND).json({ error: "mini quest already completed or is invalid" });
				return
			}

		} else {
			model = await campaignQuestCompleted.findOne({ _id: submissionToBeVerified.questCompleted, status: { $in: ["pending", "retry"] } });
			if (!model) {
				res.status(NOT_FOUND).json({ error: "campaign quest already completed or is invalid" });
				return
			}
		}

		if (action !== "accept") {
			submissionToBeVerified.status = "retry";
			submissionToBeVerified.validatedBy = adminExists.username;
			model.status = "retry";
		} else {
			submissionToBeVerified.status = "done";
			submissionToBeVerified.validatedBy = adminExists.username;
			model.status = "done";
			model.done = true;
		}

		await submissionToBeVerified.save();
		await model.save();

		res.status(OK).json({ message: "submission marked" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error marking submission" });
	}
}

const getSystemHubIds = async () => {
  const [sysHubs, sysUserHubs, platformAdmins] = await Promise.all([
    hub.find({ systemKey: ADMIN_CAMPAIGN_SYSTEM_KEY }).select("_id").lean(),
    userHub.find({ systemKey: ADMIN_CAMPAIGN_SYSTEM_KEY }).select("_id").lean(),
    admin.find({}).select("email username").lean(),
  ]);
  const adminEmails = platformAdmins.map(a => a.email).filter(Boolean);
  const adminUsernames = platformAdmins.map(a => a.username).filter(Boolean);

  // Find hub admins whose email matches a platform admin
  const adminHubAdmins = await hubAdmin.find({ email: { $in: adminEmails } }).select("hub").lean();
  const adminUserHubAdmins = await userHubAdmin.find({ email: { $in: adminEmails } }).select("hub").lean();

  return {
    systemHubIds: sysHubs.map(h => h._id),
    systemUserHubIds: sysUserHubs.map(h => h._id),
    adminManagedHubIds: adminHubAdmins.map(h => h.hub).filter(Boolean),
    adminManagedUserHubIds: adminUserHubAdmins.map(h => h.hub).filter(Boolean),
    adminEmails,
    adminUsernames,
  };
};

export const getStudioCampaigns = async (_req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { systemHubIds, adminManagedHubIds } = await getSystemHubIds();
    const excludeHubs = [...systemHubIds, ...adminManagedHubIds];

    const campaigns = await campaignModel
      .find({ status: { $ne: "Deleted" }, deletedAt: null, hub: { $nin: excludeHubs } })
      .populate({ path: "hub", select: "name logo" })
      .sort({ createdAt: -1 })
      .lean();

    const normalized = campaigns.map((c: any) => ({
      _id: String(c._id),
      title: c.title || c.description || "",
      projectName: c.project_name || "",
      status: c.status || "â€”",
      starts_at: c.starts_at ?? null,
      ends_at: c.ends_at ?? null,
      reward: {
        xp: Number(c.reward?.xp ?? 0),
        pool: Number(c.reward?.pool ?? 0),
        trustTokens: Number(c.reward?.trustTokens ?? 0),
      },
      participants: Number(c.participants ?? 0),
      creator: {
        id: c.hub?._id ? String(c.hub._id) : "",
        name: c.hub?.name || c.project_name || "Unknown",
        logo: c.hub?.logo || c.project_image || "",
      },
      createdAt: c.createdAt ?? null,
    }));

    res.status(OK).json({ studioCampaigns: normalized });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching studio campaigns" });
  }
};

export const deleteStudioCampaign = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "campaign id is required" });
      return;
    }

    const updated = await campaignModel.findByIdAndUpdate(
      id,
      { status: "Deleted", deletedAt: new Date() },
      { new: true }
    );

    if (!updated) {
      res.status(NOT_FOUND).json({ error: "campaign not found" });
      return;
    }

    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error deleting studio campaign" });
  }
};

export const getDeletedStudioCampaigns = async (_req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { systemHubIds, adminManagedHubIds } = await getSystemHubIds();
    const excludeHubs = [...systemHubIds, ...adminManagedHubIds];

    const campaigns = await campaignModel
      .find({ status: "Deleted", hub: { $nin: excludeHubs } })
      .populate({ path: "hub", select: "name logo" })
      .sort({ deletedAt: -1, createdAt: -1 })
      .lean();

    const normalized = campaigns.map((c: any) => ({
      _id: String(c._id),
      title: c.title || c.description || "",
      projectName: c.project_name || "",
      status: c.status || "â€”",
      starts_at: c.starts_at ?? null,
      ends_at: c.ends_at ?? null,
      reward: {
        xp: Number(c.reward?.xp ?? 0),
        pool: Number(c.reward?.pool ?? 0),
        trustTokens: Number(c.reward?.trustTokens ?? 0),
      },
      participants: Number(c.participants ?? 0),
      creator: {
        id: c.hub?._id ? String(c.hub._id) : "",
        name: c.hub?.name || c.project_name || "Unknown",
        logo: c.hub?.logo || c.project_image || "",
      },
      createdAt: c.createdAt ?? null,
      deletedAt: c.deletedAt ?? null,
    }));

    res.status(OK).json({ deletedCampaigns: normalized });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching deleted campaigns" });
  }
};

export const restoreStudioCampaign = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "campaign id is required" });
      return;
    }

    const campaignToRestore = await campaignModel.findById(id);
    if (!campaignToRestore) {
      res.status(NOT_FOUND).json({ error: "campaign not found" });
      return;
    }

    const now = new Date();
    const startsAtStr = String(campaignToRestore.starts_at || "");
    const endsAtStr = String(campaignToRestore.ends_at || "");
    const startsAt = startsAtStr ? new Date(startsAtStr) : null;
    const endsAt = endsAtStr ? new Date(endsAtStr) : null;

    let targetStatus = "Active";
    if (endsAt && !isNaN(endsAt.getTime()) && endsAt <= now) {
      targetStatus = "Ended";
    } else if (startsAt && !isNaN(startsAt.getTime()) && startsAt > now) {
      targetStatus = "Scheduled";
    }

    // Use findByIdAndUpdate to avoid validation errors on existing invalid documents
    const updated = await campaignModel.findByIdAndUpdate(
      id,
      { 
        status: targetStatus, 
        $unset: { deletedAt: "" } 
      },
      { new: true }
    );

    if (!updated) {
      res.status(NOT_FOUND).json({ error: "campaign not found" });
      return;
    }

    res.status(OK).json({ message: "campaign restored successfully" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error restoring campaign" });
  }
};

export const permanentlyDeleteStudioCampaign = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "campaign id is required" });
      return;
    }

    const result = await campaignModel.findByIdAndDelete(id);
    if (!result) {
      res.status(NOT_FOUND).json({ error: "campaign not found" });
      return;
    }

    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error permanently deleting campaign" });
  }
};

export const getStudioQuests = async (_req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { systemUserHubIds, adminManagedUserHubIds } = await getSystemHubIds();
    const excludeHubs = [...systemUserHubIds, ...adminManagedUserHubIds];

    const quests = await quest
      .find({ creatorModel: { $in: ["project", "user"] }, status: { $ne: "Deleted" }, hub: { $nin: excludeHubs } })
      .populate({ path: "hub", select: "name logo" })
      .sort({ createdAt: -1 })
      .lean();

    const normalized = quests.map((q: any) => ({
      _id: String(q._id),
      title: q.title || "",
      projectName: q.project_name || q.hub?.name || "",
      status: q.status || "â€”",
      starts_at: q.starts_at ?? null,
      ends_at: q.ends_at ?? null,
      reward: { xp: Number(q.reward ?? 0) },
      creator: {
        id: q.creator?._id ? String(q.creator._id) : (q.hub?._id ? String(q.hub._id) : ""),
        name: q.hub?.name || q.creator?.name || q.project_name || "Unknown",
        logo: q.hub?.logo || q.creator?.logo || q.project_image || "",
      },
      createdAt: q.createdAt ?? null,
    }));

    res.status(OK).json({ studioQuests: normalized });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching studio quests" });
  }
};

export const getStudioLessons = async (_req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { systemHubIds, systemUserHubIds, adminManagedHubIds, adminManagedUserHubIds } = await getSystemHubIds();
    const allSystemHubIds = [...systemHubIds, ...adminManagedHubIds];
    const allSystemUserHubIds = [...systemUserHubIds, ...adminManagedUserHubIds];
    const adminNames = (await admin.find({}).select("email username").lean()).map(a => [a.email, a.username].filter(Boolean) as string[]).flat();

    const lessonsList = await lesson
      .find({
        deletedAt: null,
        creatorModel: { $nin: ["admin"] },
      })
      .populate({ path: "creator", select: "name logo" })
      .sort({ createdAt: -1 })
      .lean();

    // Post-filter to remove system hub lessons and admin-created content
    const filtered = lessonsList.filter((l: any) => {
      const creatorId = l.creator?._id ? String(l.creator._id) : String(l.creator || "");
      if (l.creatorModel === "admin") return false;
      if (l.creatorModel === "project" && allSystemHubIds.some(id => String(id) === creatorId)) return false;
      if (l.creatorModel === "user-hubs" && allSystemUserHubIds.some(id => String(id) === creatorId)) return false;
      if (adminNames.some(name => name === l.creatorName || name === l.creator?.name)) return false;
      // Exclude orphaned lessons with no creator info (likely admin test leftovers)
      if (!l.creatorName && !l.creator?._id) return false;
      return true;
    });

    const normalized = filtered.map((l: any) => ({
      _id: String(l._id),
      title: l.title || "",
      projectName: l.creator?.name || (l.creatorModel === "user-hubs" ? "User Hub" : l.creatorModel === "users" ? "User" : "Hub"),
      status: l.status === "published" ? "Active" : "Save",
      reward: { xp: Number(l.reward ?? 0) },
      creator: {
        id: l.creator?._id ? String(l.creator._id) : (l.creator || ""),
        name: l.creator?.name || l.creatorName || "Unknown",
        logo: l.creator?.logo || l.profileImage || "",
      },
      createdAt: l.createdAt ?? null,
    }));

    res.status(OK).json({ studioLessons: normalized });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching studio lessons" });
  }
};

// ── Studio Quests: Delete / Restore / Permanent Delete ──

export const deleteStudioQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "quest id is required" });
      return;
    }

    const updated = await quest.findByIdAndUpdate(
      id,
      { status: "Deleted", deletedAt: new Date() },
      { new: true }
    );

    if (!updated) {
      res.status(NOT_FOUND).json({ error: "quest not found" });
      return;
    }

    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error deleting studio quest" });
  }
};

export const getDeletedStudioQuests = async (_req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { systemUserHubIds, adminManagedUserHubIds } = await getSystemHubIds();
    const excludeHubs = [...systemUserHubIds, ...adminManagedUserHubIds];

    const quests = await quest
      .find({ status: "Deleted", hub: { $nin: excludeHubs } })
      .populate({ path: "hub", select: "name logo" })
      .sort({ deletedAt: -1, createdAt: -1 })
      .lean();

    const normalized = quests.map((q: any) => ({
      _id: String(q._id),
      title: q.title || "",
      projectName: q.project_name || q.hub?.name || "",
      status: q.status || "—",
      starts_at: q.starts_at ?? null,
      ends_at: q.ends_at ?? null,
      reward: { xp: Number(q.reward ?? 0) },
      creator: {
        id: q.creator?._id ? String(q.creator._id) : (q.hub?._id ? String(q.hub._id) : ""),
        name: q.hub?.name || q.creator?.name || q.project_name || "Unknown",
        logo: q.hub?.logo || q.creator?.logo || q.project_image || "",
      },
      createdAt: q.createdAt ?? null,
      deletedAt: q.deletedAt ?? null,
    }));

    res.status(OK).json({ deletedQuests: normalized });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching deleted quests" });
  }
};

export const restoreStudioQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "quest id is required" });
      return;
    }

    const questToRestore = await quest.findById(id);
    if (!questToRestore) {
      res.status(NOT_FOUND).json({ error: "quest not found" });
      return;
    }

    const now = new Date();
    const startsAt = questToRestore.starts_at ? new Date(questToRestore.starts_at) : null;
    const endsAt = questToRestore.ends_at ? new Date(questToRestore.ends_at) : null;

    let targetStatus = "Active";
    if (endsAt && !isNaN(endsAt.getTime()) && endsAt <= now) {
      targetStatus = "Ended";
    } else if (startsAt && !isNaN(startsAt.getTime()) && startsAt > now) {
      targetStatus = "Scheduled";
    }

    const updated = await quest.findByIdAndUpdate(
      id,
      { status: targetStatus, deletedAt: null },
      { new: true }
    );

    if (!updated) {
      res.status(NOT_FOUND).json({ error: "quest not found" });
      return;
    }

    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error restoring quest" });
  }
};

export const permanentlyDeleteStudioQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "quest id is required" });
      return;
    }

    const result = await quest.findByIdAndDelete(id);
    if (!result) {
      res.status(NOT_FOUND).json({ error: "quest not found" });
      return;
    }

    // Also remove associated mini-quests
    await miniQuest.deleteMany({ quest: id });

    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error permanently deleting quest" });
  }
};

// ── Studio Lessons: Delete / Restore / Permanent Delete ──

export const deleteStudioLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "lesson id is required" });
      return;
    }

    const updated = await lesson.findByIdAndUpdate(
      id,
      { deletedAt: new Date() },
      { new: true }
    );

    if (!updated) {
      res.status(NOT_FOUND).json({ error: "lesson not found" });
      return;
    }

    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error deleting studio lesson" });
  }
};

export const getDeletedStudioLessons = async (_req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { systemHubIds, systemUserHubIds, adminManagedHubIds, adminManagedUserHubIds } = await getSystemHubIds();
    const allSystemHubIds = [...systemHubIds, ...adminManagedHubIds];
    const allSystemUserHubIds = [...systemUserHubIds, ...adminManagedUserHubIds];
    const adminNames = (await admin.find({}).select("email username").lean()).map(a => [a.email, a.username].filter(Boolean) as string[]).flat();

    const lessonsList = await lesson
      .find({ deletedAt: { $ne: null } })
      .populate({ path: "creator", select: "name logo" })
      .sort({ deletedAt: -1, createdAt: -1 })
      .lean();

    // Post-filter to remove system hub and admin lessons
    const filtered = lessonsList.filter((l: any) => {
      const creatorId = l.creator?._id ? String(l.creator._id) : String(l.creator || "");
      if (l.creatorModel === "admin") return false;
      if (l.creatorModel === "project" && allSystemHubIds.some(id => String(id) === creatorId)) return false;
      if (l.creatorModel === "user-hubs" && allSystemUserHubIds.some(id => String(id) === creatorId)) return false;
      if (adminNames.some(name => name === l.creatorName || name === l.creator?.name)) return false;
      if (!l.creatorName && !l.creator?._id) return false;
      return true;
    });

    const normalized = filtered.map((l: any) => ({
      _id: String(l._id),
      title: l.title || "",
      projectName: l.creator?.name || "Unknown",
      status: "Deleted",
      reward: { xp: Number(l.reward ?? 0) },
      creator: {
        id: l.creator?._id ? String(l.creator._id) : (l.creator || ""),
        name: l.creator?.name || l.creatorName || "Unknown",
        logo: l.creator?.logo || l.profileImage || "",
      },
      createdAt: l.createdAt ?? null,
      deletedAt: l.deletedAt ?? null,
    }));

    res.status(OK).json({ deletedLessons: normalized });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching deleted lessons" });
  }
};

export const restoreStudioLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "lesson id is required" });
      return;
    }

    const updated = await lesson.findByIdAndUpdate(
      id,
      { deletedAt: null },
      { new: true }
    );

    if (!updated) {
      res.status(NOT_FOUND).json({ error: "lesson not found" });
      return;
    }

    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error restoring lesson" });
  }
};

export const permanentlyDeleteStudioLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "lesson id is required" });
      return;
    }

    const result = await lesson.findByIdAndDelete(id);
    if (!result) {
      res.status(NOT_FOUND).json({ error: "lesson not found" });
      return;
    }

    // Also remove associated mini-lessons
    await miniLesson.deleteMany({ lesson: id });

    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error permanently deleting lesson" });
  }
};

export const publishAdminQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
      return;
    }

    const adminHub = req.admin?.hub ? String(req.admin.hub) : null;
    if (!adminHub) {
      res.status(BAD_REQUEST).json({ error: "Admin has no associated hub" });
      return;
    }

    const questDoc = await quest.findById(id);
    if (!questDoc) {
      res.status(NOT_FOUND).json({ error: "Quest not found" });
      return;
    }

    if (String(questDoc.creator) !== adminHub) {
      res.status(FORBIDDEN).json({ error: "You are not allowed to publish this quest" });
      return;
    }

    const { status } = req.body;
    if (status === "Ended") {
      questDoc.status = "Ended";
      await questDoc.save();
      res.status(OK).json({ message: "Quest closed successfully!" });
      return;
    }

    if (questDoc.status !== "Save") {
      res.status(BAD_REQUEST).json({ error: "Quest is not in draft status" });
      return;
    }

    const now = new Date();
    let newStatus: "Active" | "Scheduled";

    if (!questDoc.starts_at || new Date(questDoc.starts_at) <= now) {
      newStatus = "Active";
    } else {
      newStatus = "Scheduled";
    }

    if (questDoc.ends_at && new Date(questDoc.ends_at) <= now) {
      res.status(BAD_REQUEST).json({ error: "Cannot publish a quest that has already ended" });
      return;
    }

    questDoc.status = newStatus;
    await questDoc.save();

    res.status(OK).json({ message: "Quest published successfully!" });
  } catch (error: any) {
    logger.error("Error publishing quest: " + error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: error?.message || "Error publishing quest" });
  }
};

// export const getXpHistory
