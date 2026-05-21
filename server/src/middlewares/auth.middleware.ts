import logger from "@/config/logger";
import { admin } from "@/models/admin.model";
import { bannedUser } from "@/models/bannedUser.model";
import { hubAdmin, userHubAdmin } from "@/models/hub.model";
import { user } from "@/models/user.model";
import { resolveAdminCampaignHub } from "@/utils/adminCampaignHub";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, UNAUTHORIZED, FORBIDDEN } from "@/utils/status.utils";
import { JWT } from "@/utils/utils";
import { REDIS } from "@/utils/redis.utils";
import multer from "multer";
import { updateAdminLastActivity } from "@/utils/adminActivityCron";

type decodedDataType = {
	id: string;
};

const fileSize = 5 * (1024 ** 2); // 5 MB

const resolveUserIdFromWalletHeader = async (req: GlobalRequest): Promise<string | null> => {
	const walletHeader = req.headers["x-wallet-address"];
	if (typeof walletHeader !== "string") return null;

	const normalized = walletHeader.trim().toLowerCase();
	if (!/^0x[a-f0-9]{40}$/.test(normalized)) return null;

	const userFound = await user.findOne({
		address: { $regex: `^${normalized}$`, $options: "i" },
	}).select("_id").lean();

	return userFound?._id ? userFound._id.toString() : null;
};

export const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize }
});

export const authenticateHubAdmin = async (req: GlobalRequest, res: GlobalResponse, next: GlobalNextFunction) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader?.startsWith("Bearer ")) {
			res.status(401).json({
				error: "authorization token is missing or invalid",
			});
			return;
    }

		const { id } = await JWT.verify(authHeader.split(" ")[1]!) as decodedDataType;

    const superAdminExists = await hubAdmin.findOne({ _id: id, role: "superadmin" });
    if (!superAdminExists) {
      res.status(UNAUTHORIZED).json({ error: "route is available only to super admins" });
      return;
    }

    // Check if hub is banned
    const isBanned = await bannedUser.findById(superAdminExists._id).lean();
    if (isBanned) {
      res.status(FORBIDDEN).json({ error: "this hub has been banned" });
      return;
    }

    req.id = id as string;
    req.adminName = superAdminExists.name;
  	req.admin = superAdminExists;

		next();
	} catch (error: any) {
		logger.error(error);
		if (error?.trim() === "jwt expired") {
			res.status(BAD_REQUEST).json({ error: "Token has expired, kindly re-login" });
			return
		}

		res.status(INTERNAL_SERVER_ERROR).json({ error: "Invalid authentication token, kindly re-login." });
	}
}

export const authenticateUserHub = async (req: GlobalRequest, res: GlobalResponse, next: GlobalNextFunction) => {
  try {
   	const authHeader = req.headers.authorization;
		if (!authHeader?.startsWith("Bearer ")) {
			res.status(401).json({
				error: "authorization token is missing or invalid",
			});
			return;
      }
  
      const token = authHeader.split(" ")[1]!;
  
      // Redis logout check — non-fatal if Redis is unreachable
      try {
        const loggedOut = await REDIS.get(`logout:${token}`);
        if (loggedOut) {
          res.status(BAD_REQUEST).json({ error: "admin is logged out, kindly login again" });
          return;
        }
      } catch (redisErr) {
        logger.warn("Redis unavailable in authenticateUserHub, skipping logout check");
      }

      const { id } = await JWT.verify(token) as decodedDataType;

      const exists = await userHubAdmin.findById(id).lean();
      if (!exists) {
        res.status(UNAUTHORIZED).json({ error: "route is available only to user hub admin" });
        return;
      }

      // Check if hub is banned
      const isBanned = await bannedUser.findById(exists._id).lean();
      if (isBanned) {
        res.status(FORBIDDEN).json({ error: "this hub has been banned" });
        return;
      }

      req.id = id as string;
      req.adminName = exists.name;
      req.admin = exists;
      req.token = token;

		next();
  } catch (error: any) {
    logger.error(error);
		if (error?.trim() === "jwt expired") {
			res.status(BAD_REQUEST).json({ error: "Token has expired, kindly re-login" });
			return
		}

		res.status(INTERNAL_SERVER_ERROR).json({ error: "Invalid authentication token, kindly re-login." });
  }
}

export const authenticateHubAdmin2 = async (req: GlobalRequest, res: GlobalResponse, next: GlobalNextFunction) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader?.startsWith("Bearer ")) {
			res.status(401).json({
				error: "authorization token is missing or invalid",
			});
			return;
    }

    const token = authHeader.split(" ")[1]!;

    // Redis logout check — non-fatal if Redis is unreachable
    try {
      const loggedOut = await REDIS.get(`logout:${token}`);
      if (loggedOut) {
        res.status(BAD_REQUEST).json({ error: "admin is logged out, kindly login again" });
        return;
      }
    } catch (redisErr) {
      logger.warn("Redis unavailable in authenticateHubAdmin2, skipping logout check");
    }

    const { id } = await JWT.verify(token) as decodedDataType;

    const exists = await hubAdmin.findById(id).lean();
    if (!exists) {
      res.status(UNAUTHORIZED).json({ error: "route is available only to admins" });
      return;
    }

    req.id = id as string;
    req.adminName = exists.name;
    req.admin = exists;
    req.token = token;

		next();
	} catch (error: any) {
		logger.error(error);
		const msg = typeof error === "string" ? error.trim() : error?.message ?? "";
		if (msg === "jwt expired") {
			res.status(BAD_REQUEST).json({ error: "Token has expired, kindly re-login" });
			return
		}

		res.status(INTERNAL_SERVER_ERROR).json({ error: "Invalid authentication token, kindly re-login." });
	}
}

export const authenticateUser = async (req: GlobalRequest, res: GlobalResponse, next: GlobalNextFunction) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader?.startsWith("Bearer ")) {
			res.status(401).json({
				error: "authorization token is missing or invalid",
			});
			return;
    }

    const token = authHeader.split(" ")[1]!;

    // Redis logout check — non-fatal if Redis is unreachable
    try {
      const userLoggedOut = await REDIS.get(`logout:${token}`);
      if (userLoggedOut) {
        res.status(BAD_REQUEST).json({ error: "user is logged out, kindly login again" });
        return;
      }
    } catch (redisErr) {
      logger.warn("Redis unavailable in authenticateUser, skipping logout check");
    }

		const { id } = await JWT.verify(token) as decodedDataType;

		const userExists = await user.findById(id);
		if (!userExists) {
			res.status(BAD_REQUEST).json({ error: "id associated with user is invalid" });
			return;
		}

		const userBanned = await bannedUser.findOne({ userId: id });
		if (userBanned) {
			res.status(BAD_REQUEST).json({ error: "user is banned" });
			return;
    }

    req.id = id as string;
    req.token = token;
		req.user = userExists;

		next();
	} catch (error: any) {
		logger.error(error);
		const msg = typeof error === "string" ? error.trim() : error?.message ?? "";
		if (msg === "jwt expired") {
			res.status(BAD_REQUEST).json({ error: "Token has expired, kindly re-login" });
			return
		}

		res.status(INTERNAL_SERVER_ERROR).json({ error: "Invalid authentication token, kindly re-login." });
	}
}

export const authenticateUser2 = async (req: GlobalRequest, res: GlobalResponse, next: GlobalNextFunction) => {
	try {
		const authHeader = req.headers.authorization;
		const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;

		if (token && token !== "null" && token !== "undefined") {
			try {
				const { id } = await JWT.verify(token) as decodedDataType;
				req.id = id as string;
				next();
				return;
			} catch {
				// Fall through to wallet-header fallback.
			}
		}

		const walletUserId = await resolveUserIdFromWalletHeader(req);
		if (walletUserId) req.id = walletUserId;

		next();
	} catch {
		next();
	}
}

export const authenticateAdmin = async (req: GlobalRequest, res: GlobalResponse, next: GlobalNextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(UNAUTHORIZED).json({
        error: "authorization token is missing or invalid",
      });
      return;
    }

    const token = authHeader.split(" ")[1]!;

    const adminLoggedOut = await REDIS.get(`logout:${token}`);
    if (adminLoggedOut) {
      res.status(BAD_REQUEST).json({ error: "admin is logged out, kindly login again" });
      return;
    }

    const id = (await JWT.verify(token) as decodedDataType).id;

    let isAdmin = await admin.findById(id).lean();
    let isHubAdmin: any = null;

    if (!isAdmin) {
      isHubAdmin = await hubAdmin.findById(id).lean();
    }

    if (!isAdmin && !isHubAdmin) {
      res.status(UNAUTHORIZED).json({ error: "only admins can use this route" });
      return;
    }

    const adminUser = isAdmin || isHubAdmin;
    const adminName =
      adminUser.username?.trim() ||
      adminUser.name?.trim() ||
      adminUser.email.split("@")[0] ||
      "Administrator";

    req.id = id;
    req.token = token;
    req.role = adminUser.role;
    req.adminName = adminName;
    req.admin = {
      ...adminUser,
      name: adminName,
    };

    // Update admin last activity and online status
    updateAdminLastActivity(id);

    next();
  } catch (error: any) {
    logger.error(error);
    if (error?.trim() === "jwt expired") {
      res.status(BAD_REQUEST).json({ error: "Token has expired, kindly re-login, kindly login again" });
      return
    }

    res.status(INTERNAL_SERVER_ERROR).json({ error: "Invalid authentication token, kindly re-login." });
  }
}

export const requireAdminSuperadmin = async (req: GlobalRequest, res: GlobalResponse, next: GlobalNextFunction) => {
  if (req.role !== "superadmin") {
    res.status(UNAUTHORIZED).json({ error: "only superadmin can manage admin campaigns" });
    return;
  }

  next();
};

export const attachAdminCampaignHub = async (req: GlobalRequest, res: GlobalResponse, next: GlobalNextFunction) => {
  try {
    const nexuraHub = await resolveAdminCampaignHub(req.id);
    const currentAdmin = typeof req.admin === "object" && req.admin ? req.admin : {};
    const adminName =
      typeof currentAdmin.name === "string" && currentAdmin.name.trim()
        ? currentAdmin.name.trim()
        : typeof currentAdmin.username === "string" && currentAdmin.username.trim()
          ? currentAdmin.username.trim()
          : typeof currentAdmin.email === "string" && currentAdmin.email.includes("@")
            ? currentAdmin.email.split("@")[0]
            : "Administrator";

    req.adminName = adminName;
    req.admin = {
      ...currentAdmin,
      name: adminName,
      role: req.role,
      hub: nexuraHub._id,
      pendingTxHash: nexuraHub.pendingTxHash ?? null,
    };

    next();
  } catch (error: any) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({
      error: error?.message || "Unable to prepare the Nexura campaigns hub.",
    });
  }
};
