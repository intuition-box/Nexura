import { BAD_REQUEST, OK, INTERNAL_SERVER_ERROR, CREATED, NOT_FOUND, FORBIDDEN, UNAUTHORIZED } from "@/utils/status.utils";
import {
	validateHubAdminData,
	getMissingFields,
	validateSuperAdminData,
	JWT,
	getRefreshToken,
	hashPassword,
	generateOTP
} from "@/utils/utils";
import logger from "@/config/logger";
import { server } from "@/models/server.model";
import { uploadImg } from "@/utils/img.utils";
import {
	CLIENT_URL,
	DISCORD_HUB_CLIENT_REDIRECT_URI,
	DISCORD_HUB_REDIRECT_URI,
	DISCORD_CLIENT_ID,
	DISCORD_CLIENT_SECRET,
	BOT_TOKEN,
} from "@/utils/env.utils";
import { hubAdmin, hub, userHubAdmin, userHub } from "@/models/hub.model";
import { user } from "@/models/user.model";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import axios from "axios";
import { resetEmail, sendOTPConfirmEmail, resetPasswordOTPEmail } from "@/utils/sendMail";
import { OTP } from "@/models/otp.model";
import { REDIS } from "@/utils/redis.utils";
import { verifiedEmail } from "@/models/verifiedEmail.model";
import { bannedUser } from "@/models/bannedUser.model";

const headers = {
	"Content-Type": "application/x-www-form-urlencoded",
	"Accept-encoding": "application/x-www-form-urlencoded",
};

export const signIn = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { email, password }: { email: string; password: string } = req.body;

		if (!email || !password) {
			res.status(BAD_REQUEST).json({ error: "send the required data: email and password" });
			return;
		}

		const adminExists = await hubAdmin.findOne({ email }).lean();
		if (!adminExists) {
			res.status(BAD_REQUEST).json({ error: "invalid signin credentials" });
			return;
		}

		const comparePassword = await bcrypt.compare(password, adminExists.password);
		if (!comparePassword) {
			res.status(BAD_REQUEST).json({ error: "invalid signin credentials" });
			return;
		}

		// Check if hub admin is banned
		const isBanned = await bannedUser.findOne({ userId: adminExists._id }).lean();
		if (isBanned) {
			res.status(FORBIDDEN).json({ error: "this hub has been banned" });
			return;
		}

		const id = adminExists._id.toString();

		const accessToken = JWT.sign(id);
		const refreshToken = getRefreshToken(id);

		res.cookie("hubRefreshToken", refreshToken, {
			httpOnly: true,
			secure: true,
			maxAge: 30 * 24 * 60 * 60,
		});

		res.status(OK).json({
			message: "signed in!",
			accessToken,
			admin: {
				_id: adminExists._id,
				name: adminExists.name,
				email: adminExists.email,
				role: adminExists.role,
				hub: adminExists.hub,
			},
		});
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "Error signing in" });
	}
};

export const superAdminSignUp = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { error } = validateSuperAdminData(req.body);
		if (error) {
			const missingFields = getMissingFields(error);
			res.status(BAD_REQUEST).json({ error: `these field(s) are/is required: ${missingFields}` });
			return;
    }

    const { name, email, password } = req.body;

    const strippedEmail = email.trim().toLowerCase();

    const verified = await verifiedEmail.exists({ email: strippedEmail }).lean().select("_id");
    if (!verified) {
      res.status(UNAUTHORIZED).json({ error: "email address has not been verified" });
      return;
    }

    const emailExists = await hubAdmin.exists({ email: strippedEmail });
    if (emailExists) {
      res.status(BAD_REQUEST).json({ error: "An account with this email already exists. Please sign in instead." });
      return;
    }

    const hashedPassword = await hashPassword(password);

		const ha = await hubAdmin.create({
      name: name.trim(),
      email: strippedEmail,
      password: hashedPassword,
      role: "superadmin",
    });

		await verifiedEmail.findByIdAndDelete(verified._id)

    const accessToken = JWT.sign(ha._id);
		const refreshToken = getRefreshToken(ha._id);

    res.cookie("hubRefreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      maxAge: 30 * 24 * 60 * 60,
    });

    res.status(CREATED).json({ message: "super admin created", accessToken });
	} catch (error: any) {
		logger.error(error);
		const isDuplicate = error?.code === 11000;
		res.status(isDuplicate ? BAD_REQUEST : INTERNAL_SERVER_ERROR).json({
      error: isDuplicate ? "An account with this email already exists. Please sign in instead." : "Error creating super admin",
    });
	}
}

export const hubDiscordCallback = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { code } = req.query as { code: string };

		if (!code) {
			res.send("Please sign-in/connect discord again");
			return;
		}

		const params = new URLSearchParams({
			client_id: DISCORD_CLIENT_ID,
			client_secret: DISCORD_CLIENT_SECRET,
			redirect_uri: DISCORD_HUB_REDIRECT_URI,
			code,
			grant_type: "authorization_code",
		});

		const { data: { access_token, refresh_token } } = await axios.post("https://discord.com/api/v10/oauth2/token", params, { headers });

		const { data } = await axios.get("https://discord.com/api/v10/users/@me/guilds", {
			headers: {
				...headers,
				Authorization: `Bearer ${access_token}`,
			}
		});

		const serversCreated = await server.create({ servers: data });

		res.redirect(DISCORD_HUB_CLIENT_REDIRECT_URI + `?id=${serversCreated._id}`);
	} catch (error: any) {
		console.error(error);
		console.error("DISCORD HUB TOKEN ERROR STATUS:", error.response?.status);
		console.error("DISCORD HUB TOKEN ERROR DATA:", error.response?.data);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "Error signing in with discord" });
	}
}

export const fetchServers = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { id } = req.query as { id: string };
		if (!id) {
			res.status(BAD_REQUEST).json({ error: "discord session id is required" });
			return;
		}

		const discordServers = await server.findById(id);
		if (!discordServers) {
			res.status(INTERNAL_SERVER_ERROR).json({ error: "kindly authenticate your discord" });
			return;
		}

		res.json({ message: "servers fetched", servers: discordServers.servers });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "Error fetching discord servers" });
	}
}

export const fetchRoles = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { id, serverId } = req.query as { id: string; serverId: string };
		if (!id || !serverId) {
			res.status(BAD_REQUEST).json({ error: "discord session id and server id are required" });
			return;
		}

		const discordServers = await server.findById(id);
		if (!discordServers) {
			res.status(INTERNAL_SERVER_ERROR).json({ error: "kindly authenticate your discord" });
			return;
		}

		const { data } = await axios.get(`https://discord.com/api/v10/guilds/${serverId}/roles`, {
			headers: {
				...headers,
				Authorization: `Bot ${BOT_TOKEN}`,
			}
		});

		res.json({ message: "roles fetched", roles: data });
	} catch (error: any) {
		console.error(error);
		console.error("DISCORD HUB TOKEN ERROR STATUS:", error.response?.status);
		console.error("DISCORD HUB TOKEN ERROR DATA:", error.response?.data);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "Error fetching discord roles" });
	}
}

export const fetchChannels = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { id, serverId } = req.query as { id: string; serverId: string };
		if (!id || !serverId) {
			res.status(BAD_REQUEST).json({ error: "discord session id and server id are required" });
			return;
		}

		const discordServers = await server.findById(id);
		if (!discordServers) {
			res.status(INTERNAL_SERVER_ERROR).json({ error: "kindly authenticate your discord" });
			return;
		}

		const { data } = await axios.get(`https://discord.com/api/v10/guilds/${serverId}/channels`, {
			headers: {
				...headers,
				Authorization: `Bot ${BOT_TOKEN}`,
			}
		});

		const channels = Array.isArray(data)
			? data
				.filter((channel: any) => channel && [0, 5].includes(Number(channel.type)))
				.map((channel: any) => ({ id: channel.id, name: channel.name, type: channel.type }))
			: [];

		res.json({ message: "channels fetched", channels });
	} catch (error: any) {
		console.error(error);
		console.error("DISCORD HUB CHANNELS ERROR STATUS:", error.response?.status);
		console.error("DISCORD HUB CHANNELS ERROR DATA:", error.response?.data);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "Error fetching discord channels" });
	}
}

export const hubAdminSignUp = async (req: GlobalRequest, res: GlobalResponse) => {
	try {

		const { email, code } = req.body;
		const { error } = validateHubAdminData(req.body);

		if (error) {
			const missingFields = getMissingFields(error);
			res.status(BAD_REQUEST).json({ error: `these field(s) are/is required: ${missingFields}` });
			return;
		}

		const otp = await OTP.findOne({ code, email }).lean();
		if (!otp) {
			res.status(BAD_REQUEST).json({ error: "otp has expired" });
			return;
		}

		const now = new Date();

		if (otp.expiresAt < now) {
			res.status(BAD_REQUEST).json({ error: "otp has expired" });
			return;
		};

		const strippedEmail = email.trim().toLowerCase();
		const trimmedName = String(req.body.name ?? "").trim();

		const adminExists = await hubAdmin.findOne({
			$or: [{ email: strippedEmail }, { name: trimmedName }]
		}).lean();

		if (adminExists) {
			const field = adminExists.email === strippedEmail ? "email" : "username";
			res.status(BAD_REQUEST).json({ error: `This ${field} account already has an existing hub` });
			return;
		}

		req.body.hub = otp.hubId;
		req.body.role = otp.role || "admin";
		req.body.name = trimmedName;
		req.body.email = strippedEmail;
		req.body.password = await hashPassword(req.body.password);

		const admin = await hubAdmin.create(req.body);

		const id = admin._id.toString();

		const accessToken = JWT.sign(id);
		const refreshToken = getRefreshToken(id);

		res.cookie("hubRefreshToken", refreshToken, {
			httpOnly: true,
			secure: true,
			maxAge: 30 * 24 * 60 * 60,
		});

		// Delete the OTP after successful signup
		await OTP.deleteOne({ _id: otp._id });

		res.status(OK).json({
			message: "hub admin signed up!",
			accessToken,
			admin: {
				_id: admin._id,
				name: admin.name,
				email: admin.email,
				role: admin.role,
				hub: admin.hub,
			},
		});
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "Error signing up hub admin" });
	}
};

export const forgotPassword = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { email } = req.body;

		if (!email) {
			res.status(BAD_REQUEST).json({ error: "email is required" });
			return;
    }

    const strippedEmail = email.trim().toLowerCase();

		const hubAdminExists = await hubAdmin.exists({ email: strippedEmail }).lean();
		if (!hubAdminExists) {
			res.status(NOT_FOUND).json({ error: "email associated with admin is invalid or does not exist" });
			return;
		}

		const code = generateOTP();

		await OTP.create({
			email: strippedEmail,
			code,
			expiresAt: new Date(Date.now() + 5 * 60 * 1000),
		});

		await resetPasswordOTPEmail(strippedEmail, code);

		res.status(OK).json({ message: "password reset code sent!" });
	} catch (error: any) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "Error sending password reset code" });
	}
};

export const resetPassword = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { email, code, password } = req.body;

		if (!email || !code || !password) {
			res.status(BAD_REQUEST).json({ error: "email, code, and password are required" });
			return;
		}

		const otp = await OTP.findOne({ email: email.trim().toLowerCase(), code }).lean();
		if (!otp) {
			res.status(BAD_REQUEST).json({ error: "invalid or expired code" });
			return;
		}

		const adminExists = await hubAdmin.findOne({ email: email.trim().toLowerCase() });
		if (!adminExists) {
			res.status(NOT_FOUND).json({ error: "admin not found" });
			return;
		}

		const hashedPassword = await hashPassword(password);

		adminExists.password = hashedPassword;
		await adminExists.save();

		await OTP.deleteOne({ _id: otp._id });

		const id = adminExists._id.toString();
		const accessToken = JWT.sign(id);
		const refreshToken = getRefreshToken(id);

		res.cookie("hubRefreshToken", refreshToken, {
			httpOnly: true,
			secure: true,
			maxAge: 30 * 24 * 60 * 60,
		});

		res.status(OK).json({
			message: "admin password reset successful!",
			accessToken,
			admin: {
				_id: adminExists._id,
				name: adminExists.name,
				email: adminExists.email,
				role: adminExists.role,
				hub: adminExists.hub,
			},
		});
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "Error resetting admin password" });
	}
};

export const logout = async (req: GlobalRequest, res: GlobalResponse) => {
	try {

		const { token } = req;

		await REDIS.set({ key: `logout:${token}`, data: { token }, ttl: 7 * 24 * 60 * 60 });

		res.clearCookie("hubRefreshToken");
		res.status(OK).json({ message: "admin logged out!" });
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "Error logging out admin" });
	}
};

export const userHubSignIn = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { email, password }: { email: string; password: string } = req.body;

		if (!email || !password) {
			res.status(BAD_REQUEST).json({ error: "send the required data: email and password" });
			return;
		}

		const adminExists = await userHubAdmin.findOne({ email }).lean();
		if (!adminExists) {
			res.status(BAD_REQUEST).json({ error: "invalid signin credentials" });
			return;
		}

		const comparePassword = await bcrypt.compare(password, adminExists.password);
		if (!comparePassword) {
			res.status(BAD_REQUEST).json({ error: "invalid signin credentials" });
			return;
		}

		// Check if hub admin is banned
		const isBanned = await bannedUser.findOne({ userId: adminExists._id }).lean();
		if (isBanned) {
			res.status(FORBIDDEN).json({ error: "this hub has been banned" });
			return;
		}

		const id = adminExists._id.toString();

    // Auto-create hub if admin has none
    let hubId = (adminExists as any).hub;
    if (!hubId) {
      let logoUrl = "";
      try {
        const mainUser = await user.findOne({ username: adminExists.name }).lean();
        logoUrl = (mainUser as any)?.profilePic || "";
      } catch {}
      try {
        const createdHub = await userHub.create({
          name: adminExists.name,
          description: "",
          website: "",
          xAccount: "",
          logo: logoUrl,
          superAdmin: adminExists._id,
        });
        hubId = createdHub._id;
      } catch (createErr: any) {
        // Name conflict - use a unique name
        if (createErr?.code === 11000) {
          const fallbackHub = await userHub.create({
            name: `${adminExists.name}-${adminExists._id.toString().slice(-6)}`,
            description: "",
            website: "",
            xAccount: "",
            logo: "",
            superAdmin: adminExists._id,
          });
          hubId = fallbackHub._id;
        } else {
          throw createErr;
        }
      }
      await userHubAdmin.findByIdAndUpdate(adminExists._id, { hub: hubId });
    }

		const accessToken = JWT.sign(id);
		const refreshToken = getRefreshToken(id);

		res.cookie("userHubRefreshToken", refreshToken, {
			httpOnly: true,
			secure: true,
			maxAge: 30 * 24 * 60 * 60,
		});

		res.status(OK).json({
			message: "signed in!",
			accessToken,
			admin: {
				_id: adminExists._id,
				name: adminExists.name,
				email: adminExists.email,
				hub: hubId || adminExists.hub,
			},
		});
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "Error signing in" });
	}
};

export const userHubAdminSignUp = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
    console.log('[userHubAdminSignUp] Received request body:', req.body);
		const { error } = validateSuperAdminData(req.body);
		if (error) {
			const missingFields = getMissingFields(error);
			res.status(BAD_REQUEST).json({ error: `these field(s) are/is required: ${missingFields}` });
			return;
    }

    const { name, email, password } = req.body;

    const strippedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    const verified = await verifiedEmail.exists({ email: strippedEmail }).lean().select("_id");
    if (!verified) {
      res.status(UNAUTHORIZED).json({ error: "email address has not been verified" });
      return;
    }

    const adminExists = await userHubAdmin.findOne({
      $or: [{ email: strippedEmail }, { name: trimmedName }]
    }).lean();

    if (adminExists) {
      const field = adminExists.email === strippedEmail ? "email" : "username";
      res.status(BAD_REQUEST).json({ error: `This ${field} account already has an existing hub` });
      return;
    }

    const hubNameExists = await userHub.exists({ name: trimmedName });
    if (hubNameExists) {
      res.status(BAD_REQUEST).json({ error: "This username account already has an existing hub" });
      return;
    }

    const emailExists = await userHubAdmin.exists({ email: strippedEmail });
    if (emailExists) {
      res.status(BAD_REQUEST).json({ error: "An account with this email already exists. Please sign in instead." });
      return;
    }

    const hashedPassword = await hashPassword(password);

    // Find the user from the main users collection
    const mainUser = await user.findOne({
      $or: [
        { email: strippedEmail },
        { username: trimmedName }
      ]
		}).lean().select("profilePic");

    const userId = req.id;

	  const superAdmin = await userHubAdmin.create({
      name: trimmedName,
      email: strippedEmail,
      password: hashedPassword,
      userId: new mongoose.Types.ObjectId(userId),
			emailVerified: true,
    });

    // Fetch main app profile picture for hub logo
		const logo = (mainUser as any)?.profilePic || "";

    // Create a hub for the new admin immediately
    const createdHub = await userHub.create({
      name: trimmedName,
      description: "",
      website: "",
      userId: new mongoose.Types.ObjectId(userId),
      xAccount: "",
      logo,
      superAdmin: superAdmin._id,
    });

    // Link the hub to the admin and delete verified email
    await Promise.all([
      userHubAdmin.findByIdAndUpdate(superAdmin._id, { hub: createdHub._id }),
      verifiedEmail.findByIdAndDelete(verified._id)
    ]);

		const accessToken = JWT.sign(superAdmin._id.toString());
    const refreshToken = getRefreshToken(superAdmin._id.toString());

    res.cookie("userHubRefreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      maxAge: 30 * 24 * 60 * 60,
    });

		res.status(CREATED).json({ message: "user hub admin created", accessToken, admin: { _id: superAdmin._id.toString(), name: superAdmin.name, email: superAdmin.email, role: "superadmin", hub: createdHub._id.toString() }, hub: { logo: createdHub.logo || "" } });
	} catch (error: any) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({
      error: "Error creating user hub account",
    });
	}
}

export const userHubLogout = async (req: GlobalRequest, res: GlobalResponse) => {
  try {

		const { token } = req;

		await REDIS.set({ key: `logout:${token}`, data: { token }, ttl: 7 * 24 * 60 * 60 });

		res.clearCookie("userHubRefreshToken");
		res.status(OK).json({ message: "user hub admin logged out!" });
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "Error logging out user hub admin" });
	}
}

export const userHubForgotPassword = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { email } = req.body;

		if (!email) {
			res.status(BAD_REQUEST).json({ error: "email is required" });
			return;
		}

		const hubAdminExists = await userHubAdmin.findOne({ email: email.trim().toLowerCase() }).lean();
		if (!hubAdminExists) {
			res.status(NOT_FOUND).json({ error: "email associated with admin is invalid or does not exist" });
			return;
		}

		const code = generateOTP();
		const hubId = hubAdminExists.hub?.toString();

		await OTP.findOneAndUpdate(
			{ email: hubAdminExists.email },
			{
				email: hubAdminExists.email,
				code,
				hubId,
				expiresAt: new Date(Date.now() + 5 * 60 * 1000),
			},
			{ upsert: true, new: true, setDefaultsOnInsert: true }
		);

		await resetPasswordOTPEmail(hubAdminExists.email, code);

		res.status(OK).json({ message: "password reset code sent!" });
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "Error sending password reset code" });
	}
};

export const userHubResetPassword = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { email, code, password } = req.body;

		if (!email || !code || !password) {
			res.status(BAD_REQUEST).json({ error: "email, code, and password are required" });
			return;
		}

		const otp = await OTP.findOne({ email: email.trim().toLowerCase(), code }).lean();
		if (!otp) {
			res.status(BAD_REQUEST).json({ error: "invalid or expired code" });
			return;
		}

		const adminExists = await userHubAdmin.findOne({ email: email.trim().toLowerCase() });
		if (!adminExists) {
			res.status(NOT_FOUND).json({ error: "admin not found" });
			return;
		}

		const hashedPassword = await hashPassword(password);

		adminExists.password = hashedPassword;
		await adminExists.save();

		await OTP.deleteOne({ _id: otp._id });

		const id = adminExists._id.toString();
		const accessToken = JWT.sign(id);
		const refreshToken = getRefreshToken(id);

		res.cookie("userHubRefreshToken", refreshToken, {
			httpOnly: true,
			secure: true,
			maxAge: 30 * 24 * 60 * 60,
		});

		res.status(OK).json({
			message: "admin password reset successful!",
			accessToken,
			admin: {
				_id: adminExists._id,
				name: adminExists.name,
				email: adminExists.email,
				hub: adminExists.hub,
			},
		});
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "Error resetting admin password" });
	}
};

export const validateHubEmail = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { email, page } = req.query as { page: string, email: string };

    if (!email) {
      res.status(BAD_REQUEST).json({ error: "send the email to validate" });
      return;
    }

    const strippedEmail = email.trim().toLowerCase();

    let emailExists: any | null = null;

    if (page === "user") {
      emailExists = await userHubAdmin.exists({ email: strippedEmail });
    } else {
      emailExists = await hubAdmin.exists({ email: strippedEmail });
    }

    if (emailExists) {
      res.status(BAD_REQUEST).json({ error: "This email account already has an existing hub" });
      return;
    }

    const code = generateOTP();

    await OTP.deleteMany({ email: strippedEmail });

    await Promise.all([
      OTP.create({ code, email: strippedEmail, page: page || "project", role: "admin" }),
      sendOTPConfirmEmail({ email: strippedEmail, code })
    ]);

    res.status(OK).json({ message: "otp for email confirmation sent!" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error sending otp for email confirmation" });
  }
}

export const confirmHubEmailValidation = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { code, email } = req.body;
    if (!code && !email) {
      res.status(BAD_REQUEST).json({ error: "send email and otp code" });
      return;
    }

    const strippedEmail = email.trim().toLowerCase();

    const otpFound = await OTP.findOne({ email: strippedEmail, code }).lean();
    if (!otpFound) {
      res.status(NOT_FOUND).json({ error: "otp does not exist, is invalid or has expired" });
      return;
    }

    const now = new Date();

		if (otpFound.expiresAt < now) {
			res.status(BAD_REQUEST).json({ error: "otp has expired" });
			return;
		};

    await OTP.deleteOne({ email: strippedEmail, code });

    const existingVerification = await verifiedEmail.findOne({ email: strippedEmail }).lean();
    if (!existingVerification) {
      await verifiedEmail.create({ email: strippedEmail });
    }

    res.status(OK).json({ message: "otp verified" });
  } catch (error) {
    logger.error("CONFIRM_HUB_EMAIL_ERROR:", error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error confirming otp for email validation", details: error instanceof Error ? error.message : String(error) });
  }
  }