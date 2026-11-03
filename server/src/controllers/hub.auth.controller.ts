import { BAD_REQUEST, OK, INTERNAL_SERVER_ERROR, CREATED, NOT_FOUND, FORBIDDEN, UNAUTHORIZED } from "@/utils/status.utils";
import {
	validateHubAdminData,
	getMissingFields,
	validateSuperAdminData,
	JWT,
	getRefreshToken,
	hashPassword,
	generateOTP,
	passwordChangeMark,
	hubSessionTtl
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
  DISCORD_ADMIN_HUB_CLIENT_REDIRECT_URI,
  DISCORD_ADMIN_HUB_REDIRECT_URI,
  ADMIN_DISCORD_REDIRECT_URI,
  ADMIN_DISCORD_CLIENT_REDIRECT_URI,
} from "@/utils/env.utils";
import { hubAdmin, hub, userHubAdmin, userHub, touchHubAdminActivity } from "@/models/hub.model";
import { user } from "@/models/user.model";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import axios from "axios";
import { resetEmail, sendOTPConfirmEmail, resetPasswordOTPEmail } from "@/utils/sendMail";
import { OTP } from "@/models/otp.model";
import { REDIS } from "@/utils/redis.utils";
import { revokeToken } from "@/models/revokedToken.model";
import { linkedHubWallet } from "@/utils/hubWallet";
import { walletLoginProblem } from "@/utils/walletLogin";
import { isAddress } from "viem";
import { issueWalletToken, walletFromToken } from "@/utils/walletToken";
import { TWO_FACTOR_PURPOSE } from "@/controllers/twoFactor.controller";
import { verifiedEmail } from "@/models/verifiedEmail.model";
import { bannedUser } from "@/models/bannedUser.model";
import { USERNAME_RULE, accountsForEmail, accountsForLogin, hubChoices, inAnotherStudio, usernameTaken } from "@/utils/hubAccounts";

const WRONG_WALLET = "Switch to the wallet linked to this account to sign in.";

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

		// The password picks the account. When it opens several studios, the person picks the project
		const matches = await accountsForLogin(String(email), String(password));
		if (matches.length === 0) {
			res.status(BAD_REQUEST).json({ error: "Incorrect email or password." });
			return;
		}
		const chosenId = typeof req.body.accountId === "string" ? req.body.accountId : "";
		let adminExists: any = matches.length === 1 ? matches[0] : matches.find(a => String(a._id) === chosenId);
		// Several studios on this password: only those this wallet can open count; one is picked for them
		if (!adminExists) {
			const wallet = (await walletFromToken(req.body?.walletToken)) ?? "";
			const usable = wallet ? await accountsForWallet(matches, wallet) : [];
			if (usable.length === 1) adminExists = usable[0];
			else if (usable.length > 1) { res.status(OK).json({ hubChoiceRequired: true, hubs: await hubChoices(usable) }); return; }
			else {
				res.status(FORBIDDEN).json({ error: wallet ? WRONG_WALLET : "Connect your wallet to sign in.", wrongWallet: !!wallet, walletRequired: !wallet });
				return;
			}
		}

		// Check if hub admin is banned
		const isBanned = await bannedUser.findOne({ userId: adminExists._id }).lean();
		if (isBanned) {
			res.status(FORBIDDEN).json({ error: "this hub has been banned" });
			return;
		}

		// Every sign-in needs the connected wallet to be the one linked to the account (no signature asked).
		// An account with no linked wallet yet takes the first wallet it signs in with
		const linked = await linkedHubWallet(adminExists);
		// The wallet is the one proven by its token (signed once when it connected)
		const walletAddress = await walletFromToken(req.body?.walletToken);
		if (!walletAddress || !isAddress(walletAddress)) {
			res.status(FORBIDDEN).json({ error: linked ? "Connect the wallet linked to this account to sign in." : "Connect your wallet to sign in.", walletRequired: true });
			return;
		}
		if (linked && String(walletAddress).toLowerCase() !== linked.toLowerCase()) {
			res.status(FORBIDDEN).json({ error: WRONG_WALLET, wrongWallet: true });
			return;
		}
		if (!linked) {
			const claimed = await hubAdmin.updateOne(
				{ _id: adminExists._id, $or: [{ linkedWallet: null }, { linkedWallet: { $exists: false } }] },
				{ $set: { linkedWallet: String(walletAddress) } },
			);
			if (!claimed.modifiedCount) {
				res.status(FORBIDDEN).json({ error: "Your studio's wallet was just set. Sign in again.", walletRequired: true });
				return;
			}
		}

		// 2-step verification: the session is only issued after a code from Google Authenticator
		if (adminExists.twoFactorEnabled) {
			res.status(OK).json({ twoFactorRequired: true, twoFactorToken: JWT.signFor(adminExists._id.toString(), TWO_FACTOR_PURPOSE, "10m") });
			return;
		}

		const id = adminExists._id.toString();
		touchHubAdminActivity(id);

		const accessToken = JWT.sign(id, hubSessionTtl(req.body?.remember));
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

/** The accounts (of these) this wallet can open: linked to it, or with no wallet linked yet. */
async function accountsForWallet(accounts: any[], wallet: string) {
	const linked = await Promise.all(accounts.map(a => linkedHubWallet(a)));
	return accounts.filter((_, i) => !linked[i] || linked[i]!.toLowerCase() === wallet.toLowerCase());
}

/**
 * POST /hub/sign-in/check { email, password, walletAddress }: before Sign in, whether the connected
 * wallet can open the account. Answers only for a correct password (wrong ones count as attempts).
 */
export const checkSignInWallet = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { email, password, walletAddress } = req.body ?? {};
		const matches = await accountsForLogin(String(email ?? ""), String(password ?? ""));
		if (matches.length === 0) { res.status(BAD_REQUEST).json({ status: "unknown" }); return; }
		if (!walletAddress) { res.status(OK).json({ status: "walletRequired" }); return; }
		const linked = await Promise.all(matches.map(a => linkedHubWallet(a)));
		const usable = matches.filter((_, i) => !linked[i] || linked[i]!.toLowerCase() === String(walletAddress).toLowerCase());
		if (usable.length) { res.status(OK).json({ status: "ok" }); return; }
		res.status(OK).json({ status: "wrongWallet", error: WRONG_WALLET });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "couldn't check the wallet" });
	}
};

/** POST /hub/wallet-proof { walletAddress, message, signature }: one signature, a 30-day wallet token. */
export const proveWallet = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { walletAddress, message, signature } = req.body ?? {};
		const problem = await walletLoginProblem(walletAddress, message, signature);
		if (problem) { res.status(UNAUTHORIZED).json({ error: problem }); return; }
		res.status(OK).json({ walletToken: issueWalletToken(String(walletAddress)), address: String(walletAddress).toLowerCase() });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "couldn't verify the wallet" });
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

    const username = String(name).trim();
    if (!USERNAME_RULE.test(username)) {
      res.status(BAD_REQUEST).json({ error: "Use 3 to 30 letters, numbers, dots or underscores for your username." });
      return;
    }

    // The wallet that signs here is the only one that can sign in to this account
    const walletAddress = await walletFromToken(req.body?.walletToken);
    if (!walletAddress) {
      res.status(UNAUTHORIZED).json({ error: "Connect and verify your wallet to create your studio.", walletRequired: true });
      return;
    }

    const hashedPassword = await hashPassword(password);

		const ha = await hubAdmin.create({
      name: name.trim(),
      email: strippedEmail,
      password: hashedPassword,
      role: "superadmin",
      linkedWallet: String(walletAddress),
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
      error: isDuplicate ? "That username or email can't be used. Try another username." : "Error creating super admin",
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

export const adminConnectDiscord = async (_req: GlobalRequest, res: GlobalResponse) => {
	const redirectUri = DISCORD_ADMIN_HUB_REDIRECT_URI || ADMIN_DISCORD_REDIRECT_URI;
	const url = "https://discord.com/oauth2/authorize"
		+ "?client_id=" + DISCORD_CLIENT_ID
		+ "&redirect_uri=" + encodeURIComponent(redirectUri)
		+ "&response_type=code"
		+ "&scope=identify+guilds+bot+applications.commands";
	res.redirect(url);
};

export const discordAdminCallback = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { code } = req.query as { code: string };

		if (!code) {
			res.send("Please sign-in/connect discord again");
			return;
		}

		const params = new URLSearchParams({
			client_id: DISCORD_CLIENT_ID,
			client_secret: DISCORD_CLIENT_SECRET,
			redirect_uri: DISCORD_ADMIN_HUB_REDIRECT_URI || ADMIN_DISCORD_REDIRECT_URI,
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

		const clientBase = ((process.env.DISCORD_ADMIN_HUB_CLIENT_REDIRECT_URI || process.env.AUTH_URL) as string || "").replace(/\/$/, "");
		const redirectTo = clientBase
			? (clientBase.endsWith("/discord-connected") ? clientBase : `${clientBase}/discord-connected`)
			: "";
		res.redirect(`${redirectTo}?id=${serversCreated._id}`);
	} catch (error: any) {
		console.error(error);
		console.error("DISCORD ADMIN HUB TOKEN ERROR STATUS:", error.response?.status);
		console.error("DISCORD ADMIN HUB TOKEN ERROR DATA:", error.response?.data);
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

async function connectedGuild(sessionId: unknown, serverId: unknown): Promise<string | null> {
	if (typeof sessionId !== "string" || !mongoose.Types.ObjectId.isValid(sessionId)) return null;
	if (typeof serverId !== "string" || !/^\d{5,25}$/.test(serverId)) return null;
	const session = await server.findById(sessionId).select("servers").lean() as any;
	const listed = session?.servers?.some((s: any) => String(s?.id) === serverId);
	return listed ? serverId : null;
}

export const fetchRoles = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { id, serverId } = req.query as { id: string; serverId: string };
		if (!id || !serverId) {
			res.status(BAD_REQUEST).json({ error: "discord session id and server id are required" });
			return;
		}

		const guildId = await connectedGuild(id, serverId);
		if (!guildId) {
			res.status(NOT_FOUND).json({ error: "that server isn't one of your connected Discord servers" });
			return;
		}

		const { data } = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
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

		const guildId = await connectedGuild(id, serverId);
		if (!guildId) {
			res.status(NOT_FOUND).json({ error: "that server isn't one of your connected Discord servers" });
			return;
		}

		const { data } = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
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

		if (await hubAdmin.exists({ email: strippedEmail, hub: otp.hubId })) {
			res.status(BAD_REQUEST).json({ error: "This email already has an account in this studio. Sign in instead." });
			return;
		}
		if (await inAnotherStudio(strippedEmail, otp.hubId)) {
			res.status(BAD_REQUEST).json({ error: "This email is already on another studio's team." });
			return;
		}
		if (!USERNAME_RULE.test(trimmedName)) {
			res.status(BAD_REQUEST).json({ error: "Use 3 to 30 letters, numbers, dots or underscores for your username." });
			return;
		}
		if (await usernameTaken(trimmedName, otp.hubId)) {
			res.status(BAD_REQUEST).json({ error: "That username is already used in this studio.", usernameTaken: true });
			return;
		}

		req.body.hub = otp.hubId;
		req.body.role = otp.role || "admin";
		req.body.name = trimmedName;
		req.body.email = strippedEmail;
		req.body.password = await hashPassword(req.body.password);

		const admin = await hubAdmin.create(req.body);

		const id = admin._id.toString();
		touchHubAdminActivity(id);

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

		// Only the newest reset code works (invite codes carry a hubId and are left alone)
		await OTP.deleteMany({ email: strippedEmail, page: "project", hubId: null });
		await OTP.create({
			email: strippedEmail,
			code,
			page: "project",
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
		const { email, code, password, accountId } = req.body;

		if (!email || !code || !password) {
			res.status(BAD_REQUEST).json({ error: "email, code, and password are required" });
			return;
		}

		const otp = await OTP.findOne({ email: email.trim().toLowerCase(), code: String(code), page: "project", hubId: null }).lean();
		if (!otp || new Date(otp.expiresAt).getTime() <= Date.now()) {
			res.status(BAD_REQUEST).json({ error: "invalid or expired code" });
			return;
		}

		// An email in several studios picks which account to reset (the code already proved the email)
		const accounts = await accountsForEmail(String(email));
		const adminExists = accounts.length === 1 ? accounts[0] : accounts.find(a => String(a._id) === String(accountId ?? ""));
		if (!adminExists) {
			if (accounts.length > 1) { res.status(OK).json({ hubChoiceRequired: true, hubs: await hubChoices(accounts) }); return; }
			res.status(NOT_FOUND).json({ error: "admin not found" });
			return;
		}

		const hashedPassword = await hashPassword(password);

		adminExists.password = hashedPassword;
		// Signs out every other session
		(adminExists as any).passwordChangedAt = passwordChangeMark();
		await adminExists.save();

		// Each code works once; any other reset code for this email is spent too
		await OTP.deleteMany({ email: email.trim().toLowerCase(), page: "project", hubId: null });

		// With a linked wallet, an email code alone never opens a session: sign in with the wallet
		if (await linkedHubWallet(adminExists)) {
			res.status(OK).json({ message: "admin password reset successful!", signInRequired: true });
			return;
		}

		const id = adminExists._id.toString();
		touchHubAdminActivity(id);
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

		await revokeToken(token!);

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

		// Matches the account however the email was typed (case, surrounding spaces)
		const adminExists = await userHubAdmin.findOne({ email: String(email).trim().toLowerCase() }).collation({ locale: "en", strength: 2 }).lean();
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
		touchHubAdminActivity(id);

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
    console.log('[userHubAdminSignUp] sign-up request for', String(req.body?.email ?? ''));
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

		await revokeToken(token!);

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

		// Replaces only an earlier reset code, never an invite for the same email
		await OTP.findOneAndUpdate(
			{ email: hubAdminExists.email, page: "user" },
			{
				email: hubAdminExists.email,
				code,
				hubId,
				page: "user",
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

		const otp = await OTP.findOne({ email: email.trim().toLowerCase(), code: String(code), page: "user" }).lean();
		if (!otp || new Date(otp.expiresAt).getTime() <= Date.now()) {
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

		// Each code works once
		await OTP.deleteMany({ email: email.trim().toLowerCase(), page: "user" });

		const id = adminExists._id.toString();
		touchHubAdminActivity(id);
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

    // Studio (project) emails can hold accounts in many hubs; user hubs still allow one per email
    const emailExists = page === "user" ? await userHubAdmin.exists({ email: strippedEmail }) : null;

    if (emailExists) {
      res.status(BAD_REQUEST).json({ error: "This email account already has an existing hub" });
      return;
    }

    const code = generateOTP();

    await OTP.deleteMany({ email: strippedEmail, hubId: null });

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
    if (typeof code !== "string" || typeof email !== "string" || !code.trim() || !email.trim()) {
      res.status(BAD_REQUEST).json({ error: "send email and otp code" });
      return;
    }

    const strippedEmail = email.trim().toLowerCase();

    const otpFound = await OTP.findOne({ email: strippedEmail, code: code.trim(), hubId: null }).lean();
    if (!otpFound) {
      res.status(NOT_FOUND).json({ error: "otp does not exist, is invalid or has expired" });
      return;
    }

    const now = new Date();

		if (otpFound.expiresAt < now) {
			res.status(BAD_REQUEST).json({ error: "otp has expired" });
			return;
		};

    await OTP.deleteOne({ _id: otpFound._id });

    const existingVerification = await verifiedEmail.findOne({ email: strippedEmail }).lean();
    if (!existingVerification) {
      await verifiedEmail.create({ email: strippedEmail });
    }

    res.status(OK).json({ message: "otp verified" });
  } catch (error) {
    logger.error("CONFIRM_HUB_EMAIL_ERROR:", error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error confirming otp for email validation" });
  }
  }