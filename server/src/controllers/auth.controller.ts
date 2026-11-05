import cryptoRandomString from "crypto-random-string";
import logger from "@/config/logger";
import {
	BAD_REQUEST,
	CREATED,
	INTERNAL_SERVER_ERROR,
	NOT_FOUND,
	OK,
	UNAUTHORIZED,
} from "@/utils/status.utils";
import {
	DISCORD_CLIENT_ID,
	DISCORD_REDIRECT_URI,
	DISCORD_CLIENT_SECRET, 
	X_CLIENT_REDIRECT_URI,
	DISCORD_CLIENT_REDIRECT_URI,
	X_REDIRECT_URI, 
	X_API_CLIENT_ID,
	X_API_KEY,
	X_API_KEY_SECRET
} from "@/utils/env.utils";
import { formatDate } from "date-fns";
import { user } from "@/models/user.model";
import { getLocation, getRefreshToken, JWT } from "@/utils/utils";
import { referredUsers } from "@/models/referrer.model";
import axios from "axios";
import { cvModel } from "@/models/cv.models";
import { token } from "@/models/tokens.model";
import { bannedUser } from "@/models/bannedUser.model";
import { REDIS } from "@/utils/redis.utils";
import { fetchWithRetry } from "@/utils/resilience";
import { walletLoginProblem } from "@/utils/walletLogin";
// The same signature also proves the wallet to Nexura Studio: one wallet login for both apps
import { issueWalletToken } from "@/utils/walletToken";
import { issueLinkTicket } from "@/models/linkTicket.model";

const buildWalletUsernameBase = (address: string) =>
	`${address.slice(0, 4)}...${address.slice(-4)}`;

const buildUniqueWalletUsername = async (address: string) => {
	const baseUsername = buildWalletUsernameBase(address);
	const exactMatch = await user.exists({ username: baseUsername });
	if (!exactMatch) return baseUsername;

	let attempt = 1;
	while (attempt < 100) {
		const candidate = `${baseUsername}-${attempt}`;
		const candidateExists = await user.exists({ username: candidate });
		if (!candidateExists) return candidate;
		attempt += 1;
	}

	return `${baseUsername}-${cryptoRandomString({ length: 4, type: "alphanumeric" }).toLowerCase()}`;
};

export const discordCallback = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { code } = req.query as { code: string };

		if (!code) {
			res.send("Please sign-in/connect discord again");
			return;
		}

		const params = new URLSearchParams({
			client_id: DISCORD_CLIENT_ID,
			client_secret: DISCORD_CLIENT_SECRET,
			redirect_uri: DISCORD_REDIRECT_URI,
			code,
			grant_type: "authorization_code",
		});

		const headers = {
			"Content-Type": "application/x-www-form-urlencoded",
			"Accept-encoding": "application/x-www-form-urlencoded",
		};

		const { data: { access_token, refresh_token } } = await axios.post("https://discord.com/api/v10/oauth2/token", params, { headers });

		const { data: { id, username } } = await axios.get("https://discord.com/api/v10/users/@me", {
			headers: {
				...headers,
				Authorization: `Bearer ${access_token}`,
			}
		});

		const ticket = await issueLinkTicket("discord", id, username);
		res.redirect(DISCORD_CLIENT_REDIRECT_URI + `?ticket=${ticket}&username=${encodeURIComponent(username)}`);
	} catch (error: any) {
		logger.error(error);
		console.error("DISCORD TOKEN ERROR STATUS:", error.response?.status)
		console.error("DISCORD TOKEN ERROR DATA:", error.response?.data)
		res.status(INTERNAL_SERVER_ERROR).json({ error: "Error signing in with discord" });
	}
};

export const xCallback = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { code, state } = req.query as { code: string; state: string };

		if (!code) {
			res.status(BAD_REQUEST).json({ error: "auth code from x is required" });
			return;
		}

		const fetchState = await cvModel.findOne({ state });
		if (!fetchState) {
			res.status(NOT_FOUND).json({ error: "state var is needed" });
			return;
		}

		const { data: { access_token, refresh_token } } = await axios.post(
			`https://api.x.com/2/oauth2/token?grant_type=authorization_code&client_id=${X_API_CLIENT_ID}&redirect_uri=${X_REDIRECT_URI}&code=${code}&code_verifier=${fetchState.cv}`, 
			{ headers: 
			{
				"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
				Authorization:
						"Basic " +
						Buffer.from(`${X_API_KEY}:${X_API_KEY_SECRET}`)
						.toString("base64"),
				},
			}
		);

		const { data: { data: { id, username } } } = await axios.get("https://api.x.com/2/users/me",
			{ headers: 
				{ "Authorization": `Bearer ${access_token}` }
			}
		);

		const userExists = await token.findOne({ userId: id });
		if (!userExists) {
			await token.create({ userId: id, accessToken: access_token, refreshToken: refresh_token });
		} else {
			userExists.accessToken = access_token;
			userExists.refreshToken = refresh_token;

			await userExists.save();
		}

		const ticket = await issueLinkTicket("x", id, username);
		res.redirect(X_CLIENT_REDIRECT_URI + `?ticket=${ticket}&username=${encodeURIComponent(username)}`);
	} catch (error: any) {
		logger.error(error);
		console.error("X TOKEN ERROR STATUS:", error.response?.status)
		console.error("X TOKEN ERROR DATA:", error.response?.data)
		res.status(INTERNAL_SERVER_ERROR).json({ error: "Error signing in with x" });
	}
}

export const updateRefreshToken = async (req: GlobalRequest, res: GlobalResponse) => {
	try {

	} catch (error) {
		logger.error(error);
		// send email to me (beardless)
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error updating users access tokens" });
	}
};

export const disconnectX = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const userId = req.id;

		const userToBeLoggedOut = await user.findById(userId);
		if (!userToBeLoggedOut) {
			res.status(BAD_REQUEST).json({ error: "user not found/doesn't exist" });
			return;
		}

		const xId = userToBeLoggedOut.socialProfiles?.x?.id;

		const userToken = await token.findOne({ userId: xId });
		if (!userToken) {
			res.status(BAD_REQUEST).json({ error: "user not logged into x" });
			return;
		}

		// Revoking twice is harmless, so a brief failure is retried
		await fetchWithRetry("https://api.x.com/2/oauth2/revoke", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				token: userToken.refreshToken,
				clientId: X_API_CLIENT_ID,
			}),
		}, { retries: 2, label: "X token revoke" });

		await token.deleteOne({ userId: xId });

		userToBeLoggedOut!.socialProfiles!.x!.connected = false;
		userToBeLoggedOut!.socialProfiles!.x!.disconnectedAt = new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000); // set date to 3 days from now

		await userToBeLoggedOut.save();

		res.status(OK).json({ message: "user logged out of x" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error disconnecting x" });
	}
}

export const disconnectDiscord = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const userToBeLoggedOut = await user.findById(req.id);
		if (!userToBeLoggedOut) {
			res.status(BAD_REQUEST).json({ error: "user does not exist or id is invalid" });
			return;
		}

		if (!userToBeLoggedOut!.socialProfiles?.discord) {
			res.status(BAD_REQUEST).json({ error: "user has not logged in to discord" });
			return
		}

		userToBeLoggedOut!.socialProfiles!.discord!.connected = false;
		userToBeLoggedOut!.socialProfiles!.discord!.disconnectedAt = new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000); // set date to 3 days from now
		await userToBeLoggedOut.save();

		res.status(OK).json({ message: "user logged out of discord" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error disconnecting discord" });
	}
}

export const signIn = async (req: GlobalRequest, res: GlobalResponse) => {
	const { address, referrer, message, signature }: { address: string; referrer?: string; message?: string; signature?: string } =
		req.body;

	if (!address) {
		res
			.status(BAD_REQUEST)
			.json({ error: "address cannot be empty" });
		return;
  }

	// Proof that the person controls this wallet: without it anyone could sign in as any address
	try {
		const problem = await walletLoginProblem(address, message, signature);
		if (problem) {
			res.status(UNAUTHORIZED).json({ error: problem });
			return;
		}
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "couldn't check your wallet signature just now, try again" });
		return;
	}

  const lowerCaseAddress = address.toLowerCase();

	const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
    req.socket.remoteAddress || req.ip;

  let location = undefined;

  if (ip) {
    try {
      location = await getLocation(ip!);
    } catch (error) {
      console.log("error fetching loation data");
		}
  }

	try {

		const userBanned = await bannedUser.findOne({ walletAddress: lowerCaseAddress });
		if (userBanned) {
			res.status(BAD_REQUEST).json({ error: "user is banned" });
			return;
		}

		const userExists = await user.findOne({ address: lowerCaseAddress });
		if (!userExists) {

			const referrerCode = cryptoRandomString({
				length: 8,
				type: "alphanumeric",
			});

			const dateJoined = formatDate(new Date(), "MMM, y");
			const username = await buildUniqueWalletUsername(lowerCaseAddress);

			const referral = {
				code: referrerCode,
      };

			const userReferrer = await user.findOne({ "referral.code": referrer });

			const newUser = new user({ address: lowerCaseAddress, username, referral, dateJoined, location });

			const id = newUser._id;

			if (userReferrer) {
				const signedUp = formatDate(new Date(), "MMM dd, y");

				await referredUsers.create({ user: userReferrer._id, newUser: id, signedUp, username });
			}

			await newUser.save();

      const accessToken = JWT.sign(id);
      const refreshToken = getRefreshToken(id);

			req.id = id as unknown as string;

			res.cookie("refreshToken", refreshToken, {
				httpOnly: true,
				secure: true,
				maxAge: 30 * 24 * 60 * 60,
			});

			res.status(CREATED).json({ message: "user created!", accessToken, user: newUser, walletToken: issueWalletToken(address) });
			return;
		}

		const accessToken = JWT.sign(userExists._id);
		const refreshToken = getRefreshToken(userExists._id);

    req.id = userExists._id as unknown as string;

		userExists.location = location;
		await userExists.save();

		res.cookie("refreshToken", refreshToken, {
			httpOnly: true,
			secure: true,
			maxAge: 30 * 24 * 60 * 60,
		});

		res.status(200).json({ message: "signed in", accessToken, user: userExists, walletToken: issueWalletToken(address) });
	} catch (error: any) {
		logger.error(error);

		// Duplicate key — either address already exists (sign them in) or username collision (retry)
		if (error?.code === 11000) {
			try {
			 const existingUser = await user.findOne({ address: lowerCaseAddress });
				if (existingUser) {
					// Address already registered — treat as sign-in
					const accessToken = JWT.sign(existingUser._id);
					const refreshToken = getRefreshToken(existingUser._id);
					req.id = existingUser._id as unknown as string;
					res.cookie("refreshToken", refreshToken, {
						httpOnly: true,
						secure: true,
						maxAge: 30 * 24 * 60 * 60,
					});
					res.status(200).json({ message: "signed in", accessToken, user: existingUser, walletToken: issueWalletToken(address) });
					return;
				}
			} catch (innerError) {
				logger.error(innerError);
			}
		}

		res.status(INTERNAL_SERVER_ERROR).json({ error: "Error signing user in" });
	}
};

export const logout = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { id, token } = req;

    res.clearCookie("refreshToken");

    // await REDIS.del(`user:${id}`);
    await REDIS.set({ key: `access-token:${token}`, data: { token }, ttl: 7 * 24 * 60 * 60});

		res.status(200).json({ message: "logged out" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "Error logging out" });
	}
};
