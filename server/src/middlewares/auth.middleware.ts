import logger from "@/config/logger";
import { admin } from "@/models/admin.model";
import mongoose from "mongoose";
import { bannedUser } from "@/models/bannedUser.model";
import { hubAdmin, touchHubAdminActivity, userHubAdmin } from "@/models/hub.model";
import { user } from "@/models/user.model";
import { resolveAdminCampaignHub } from "@/utils/adminCampaignHub";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, UNAUTHORIZED, FORBIDDEN } from "@/utils/status.utils";
import { JWT, issuedBeforePasswordChange } from "@/utils/utils";
import { REDIS } from "@/utils/redis.utils";
import { isTokenRevoked } from "@/models/revokedToken.model";
import { stripOperators } from "./stripOperators";
import multer from "multer";
import { updateAdminLastActivity } from "@/utils/adminActivityCron";

type decodedDataType = {
	id: string;
	iat?: number;
};

// The studio signs the person out when it sees these (they match its "kindly re-login" check)
const ACCESS_REMOVED = "your access to this hub has been removed, kindly re-login";
const PASSWORD_CHANGED = "your password was changed, kindly re-login";

const fileSize = 5 * (1024 ** 2); // 5 MB


/**
 * JWT.verify rejects with jsonwebtoken's message (a string), so only those mean the session is bad.
 * Anything else (a database hiccup, a lookup error) is a server fault: asking to re-login wouldn't help.
 */
const sendAuthError = (res: GlobalResponse, error: unknown) => {
	logger.error(error);
	const msg = typeof error === "string" ? error.trim() : "";
	if (msg === "jwt expired") {
		res.status(BAD_REQUEST).json({ error: "Token has expired, kindly re-login" });
	} else if (msg) {
		res.status(UNAUTHORIZED).json({ error: "Invalid authentication token, kindly re-login." });
	} else {
		res.status(INTERNAL_SERVER_ERROR).json({ error: "couldn't verify your session right now, please try again" });
	}
};

const multerUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize }
});

export const upload = {
	single: (name: string) => [multerUpload.single(name), stripOperators],
	fields: (fields: multer.Field[]) => [multerUpload.fields(fields), stripOperators],
	array: (name: string, max?: number) => [multerUpload.array(name, max), stripOperators],
	none: () => [multerUpload.none(), stripOperators],
};

async function hubIsBanned(adminDoc: any): Promise<boolean> {
  const ids = new Set<string>([String(adminDoc._id)]);
  if (adminDoc.hub) {
    const teammates = await hubAdmin.find({ hub: adminDoc.hub }).select("_id").lean();
    for (const t of teammates) ids.add(String(t._id));
  }
  return !!(await bannedUser.exists({ userId: { $in: [...ids] } }));
}

export const authenticateHubAdmin = async (req: GlobalRequest, res: GlobalResponse, next: GlobalNextFunction) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader?.startsWith("Bearer ")) {
			res.status(401).json({
				error: "authorization token is missing or invalid",
			});
			return;
    }

		const token = authHeader.split(" ")[1]!;
		if (await isTokenRevoked(token)) {
			res.status(BAD_REQUEST).json({ error: "admin is logged out, kindly login again" });
			return;
		}

		const decoded = await JWT.verify(token) as decodedDataType;
		const { id } = decoded;

    const superAdminExists = await hubAdmin.findById(id);
    // Removed from the hub (e.g. an approved revoke): the old token stops working at once
    if (!superAdminExists) {
      res.status(UNAUTHORIZED).json({ error: ACCESS_REMOVED });
      return;
    }
    if (issuedBeforePasswordChange(decoded, superAdminExists as any)) {
      res.status(UNAUTHORIZED).json({ error: PASSWORD_CHANGED });
      return;
    }
    if (superAdminExists.role !== "superadmin") {
      res.status(UNAUTHORIZED).json({ error: "route is available only to super admins" });
      return;
    }

    if (await hubIsBanned(superAdminExists)) {
      res.status(FORBIDDEN).json({ error: "this hub has been banned" });
      return;
    }

    req.id = id as string;
    req.adminName = superAdminExists.name;
  	req.admin = superAdminExists;
    touchHubAdminActivity(String(superAdminExists._id), (superAdminExists as any).lastActiveAt);

		next();
	} catch (error: any) {
		sendAuthError(res, error);
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
  
      if (await isTokenRevoked(token)) {
        res.status(BAD_REQUEST).json({ error: "admin is logged out, kindly login again" });
        return;
      }

      const { id } = await JWT.verify(token) as decodedDataType;

      const exists = await userHubAdmin.findById(id).lean();
      if (!exists) {
        res.status(UNAUTHORIZED).json({ error: "route is available only to user hub admin" });
        return;
      }

      // Check if hub is banned
      const isBanned = await bannedUser.findOne({ userId: exists._id }).lean();
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
		sendAuthError(res, error);
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

    if (await isTokenRevoked(token)) {
      res.status(BAD_REQUEST).json({ error: "admin is logged out, kindly login again" });
      return;
    }

    const decoded = await JWT.verify(token) as decodedDataType;
    const { id } = decoded;

    let exists = await hubAdmin.findById(id).lean();
    if (!exists) {
      exists = await userHubAdmin.findOne({ userId: new mongoose.Types.ObjectId(id) }).lean() as any;
    }
    // Removed from the hub (e.g. an approved revoke): the old token stops working at once
    if (!exists) {
      res.status(UNAUTHORIZED).json({ error: ACCESS_REMOVED });
      return;
    }
    if (issuedBeforePasswordChange(decoded, exists as any)) {
      res.status(UNAUTHORIZED).json({ error: PASSWORD_CHANGED });
      return;
    }
    if (await hubIsBanned(exists)) {
      res.status(FORBIDDEN).json({ error: "this hub has been banned" });
      return;
    }

    req.id = id as string;
    req.adminName = exists.name;
    req.admin = exists;
    req.token = token;
    touchHubAdminActivity(String(exists._id), (exists as any).lastActiveAt);

		next();
	} catch (error: any) {
		sendAuthError(res, error);
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

    if (await isTokenRevoked(token)) {
      res.status(BAD_REQUEST).json({ error: "user is logged out, kindly login again" });
      return;
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
		sendAuthError(res, error);
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
				// Not a valid session: carry on signed out
			}
		}

		// No session = signed out. (A wallet address sent in a header used to count as that person,
		// which let anyone act as anyone by sending their address.)
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

    if (await isTokenRevoked(token)) {
      res.status(BAD_REQUEST).json({ error: "admin is logged out, kindly login again" });
      return;
    }

    const decoded = await JWT.verify(token) as decodedDataType;
    const id = decoded.id;

    // Platform admins only. Studio hub admins have their own routes (/hub); letting their tokens in
    // here gave a hub Super Admin platform powers (rewarding XP, banning users, other hubs' content).
    const isAdmin = await admin.findById(id).lean();
    if (!isAdmin) {
      res.status(UNAUTHORIZED).json({ error: "only admins can use this route" });
      return;
    }
    if (issuedBeforePasswordChange(decoded, isAdmin as any)) {
      res.status(UNAUTHORIZED).json({ error: PASSWORD_CHANGED });
      return;
    }

    const adminUser: any = isAdmin;
    const adminName =
      adminUser.username?.trim() ||
      adminUser.name?.trim() ||
      adminUser.email.split("@")[0] ||
      "Administrator";

    req.id = id;
    req.token = token;
    req.role = adminUser.role;
    req.isPlatformAdmin = true;
    req.adminName = adminName;
    req.admin = {
      ...adminUser,
      name: adminName,
    };

    // Update admin last activity and online status
    updateAdminLastActivity(id);

    next();
  } catch (error: any) {
		sendAuthError(res, error);
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
