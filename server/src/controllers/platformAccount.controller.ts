import QRCode from "qrcode";
import axios from "axios";
import { hub } from "@/models/hub.model";
import { BOT_TOKEN } from "@/utils/env.utils";
import { resolveAdminCampaignHub } from "@/utils/adminCampaignHub";
import logger from "@/config/logger";
import { admin } from "@/models/admin.model";
import { OTP } from "@/models/otp.model";
import { resetPasswordOTPEmail } from "@/utils/sendMail";
import { BAD_REQUEST, FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND, OK, UNAUTHORIZED } from "@/utils/status.utils";
import { JWT, generateOTP, getRefreshToken, hashPassword, hubSessionTtl, passwordChangeMark } from "@/utils/utils";
import { matchTotp, newTotpSecret, otpauthUrl } from "@/utils/totp";
import { open, seal } from "@/utils/secretBox";

/*
 * My Profile security for dashboard admins, the same as Studio admins have
 * (controllers/twoFactor.controller.ts and the code-based password change in hub.auth.controller.ts).
 */

export const ADMIN_TWO_FACTOR_PURPOSE = "admin-2fa";
const CODE_TTL_MS = 5 * 60 * 1000;

/** Checks a code against the stored secret and spends its time step, so it works only once. */
async function useCode(adminId: unknown, secretSealed: string | null | undefined, lastStep: number | undefined, code: unknown) {
  if (!secretSealed) return false;
  const step = matchTotp(open(secretSealed), code);
  if (step === null || step <= (lastStep ?? 0)) return false;
  const spent = await admin.updateOne({ _id: adminId, $or: [{ twoFactorLastStep: { $lt: step } }, { twoFactorLastStep: null }] }, { $set: { twoFactorLastStep: step } });
  return spent.modifiedCount > 0;
}

/** POST /admin/account/2fa/setup: a new secret to add to Google Authenticator (not active until /enable). */
export const setupAdminTwoFactor = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const me = await admin.findById(req.id).select("email twoFactorEnabled").lean() as any;
    if (!me) { res.status(NOT_FOUND).json({ error: "admin not found" }); return; }
    if (me.twoFactorEnabled) { res.status(BAD_REQUEST).json({ error: "2-step verification is already on" }); return; }
    const secret = newTotpSecret();
    await admin.updateOne({ _id: req.id }, { $set: { twoFactorPendingSecret: seal(secret) } });
    const url = otpauthUrl(secret, me.email);
    const qrCodeDataUrl = await QRCode.toDataURL(url, { margin: 0, width: 320, color: { dark: "#1c2533", light: "#ffffff" } });
    res.status(OK).json({ secret, otpauthUrl: url, qrCodeDataUrl });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "couldn't start 2-step verification setup" });
  }
};

/** POST /admin/account/2fa/enable { code }: turns it on once a code from the new secret checks out. */
export const enableAdminTwoFactor = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const me = await admin.findById(req.id).select("twoFactorPendingSecret twoFactorLastStep").lean() as any;
    if (!me?.twoFactorPendingSecret) { res.status(BAD_REQUEST).json({ error: "start the setup again" }); return; }
    if (!(await useCode(req.id, me.twoFactorPendingSecret, me.twoFactorLastStep, req.body?.code))) {
      res.status(BAD_REQUEST).json({ error: "That code didn't work. Wait for a new one and try again." });
      return;
    }
    await admin.updateOne({ _id: req.id }, { $set: { twoFactorEnabled: true, twoFactorSecret: me.twoFactorPendingSecret, twoFactorPendingSecret: null } });
    res.status(OK).json({ twoFactorEnabled: true });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "couldn't turn on 2-step verification" });
  }
};

/** POST /admin/account/2fa/disable { code }: needs a current code from the app. */
export const disableAdminTwoFactor = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const me = await admin.findById(req.id).select("twoFactorSecret twoFactorLastStep twoFactorEnabled").lean() as any;
    if (!me?.twoFactorEnabled) { res.status(OK).json({ twoFactorEnabled: false }); return; }
    if (!(await useCode(req.id, me.twoFactorSecret, me.twoFactorLastStep, req.body?.code))) {
      res.status(BAD_REQUEST).json({ error: "That code didn't work. Wait for a new one and try again." });
      return;
    }
    await admin.updateOne({ _id: req.id }, { $set: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null } });
    res.status(OK).json({ twoFactorEnabled: false });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "couldn't turn off 2-step verification" });
  }
};

/** POST /admin/2fa/verify-login { twoFactorToken, code }: the second step of sign-in. */
export const verifyAdminTwoFactorLogin = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { twoFactorToken, code } = req.body ?? {};
    let id: string;
    try {
      ({ id } = await JWT.verifyFor(String(twoFactorToken ?? ""), ADMIN_TWO_FACTOR_PURPOSE) as { id: string });
    } catch {
      res.status(UNAUTHORIZED).json({ error: "This sign-in has expired. Sign in again." });
      return;
    }
    const me = await admin.findById(id).lean() as any;
    if (!me?.twoFactorEnabled) { res.status(FORBIDDEN).json({ error: "Sign in again." }); return; }
    if (!(await useCode(me._id, me.twoFactorSecret, me.twoFactorLastStep, code))) {
      res.status(BAD_REQUEST).json({ error: "That code didn't work. Wait for a new one and try again." });
      return;
    }
    const adminId = String(me._id);
    await admin.updateOne({ _id: adminId }, { $set: { lastActivity: new Date() } });
    res.cookie("refreshToken", getRefreshToken(adminId), { httpOnly: true, secure: true, maxAge: 30 * 24 * 60 * 60 });
    res.status(OK).json({
      message: "admin logged in",
      accessToken: JWT.sign(adminId, hubSessionTtl(req.body?.remember)),
      admin: { _id: me._id, name: me.username?.trim() || String(me.email).split("@")[0], username: me.username, email: me.email, role: me.role, linkedWallet: me.linkedWallet ?? null },
    });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error signing in" });
  }
};

/** POST /admin/account/password-code: emails me a 6-digit code to change my password (as Studio's Change password). */
export const sendAdminPasswordCode = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const me = await admin.findById(req.id).select("email").lean() as any;
    if (!me?.email) { res.status(NOT_FOUND).json({ error: "admin not found" }); return; }
    const email = String(me.email).trim().toLowerCase();
    const code = generateOTP();
    // Only the newest code works
    await OTP.deleteMany({ email, page: "platform" });
    await OTP.create({ email, code, page: "platform", expiresAt: new Date(Date.now() + CODE_TTL_MS) });
    await resetPasswordOTPEmail(email, code);
    res.status(OK).json({ message: "password reset code sent!" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error sending password reset code" });
  }
};

/** POST /admin/account/password { code, password }: sets a new password with the emailed code. */
export const changeAdminPassword = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { code, password } = req.body ?? {};
    if (!code || !password) { res.status(BAD_REQUEST).json({ error: "code and password are required" }); return; }
    const me = await admin.findById(req.id);
    if (!me) { res.status(NOT_FOUND).json({ error: "admin not found" }); return; }
    const email = String(me.email).trim().toLowerCase();
    const otp = await OTP.findOne({ email, code: String(code), page: "platform" }).lean();
    if (!otp || new Date(otp.expiresAt).getTime() <= Date.now()) { res.status(BAD_REQUEST).json({ error: "invalid or expired code" }); return; }
    me.password = await hashPassword(String(password));
    // Signs out every other session
    (me as any).passwordChangedAt = passwordChangeMark();
    await me.save();
    await OTP.deleteMany({ email, page: "platform" });
    res.status(OK).json({ message: "admin password reset successful!", signInRequired: true });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error resetting password" });
  }
};

// ─── Nexura's own Discord ─────────────────────────────────────────────────────
// Nexura owns its Discord and the bot is already in it, so the dashboard links it straight from the
// servers the bot belongs to, without the OAuth flow projects use.

type BotGuild = { id: string; name: string; icon: string | null };

async function botGuilds(): Promise<BotGuild[]> {
  if (!BOT_TOKEN) throw new Error("BOT_TOKEN isn't set on this server");
  const { data } = await axios.get("https://discord.com/api/v10/users/@me/guilds", { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 10_000 });
  return (data as BotGuild[]).map(g => ({ id: String(g.id), name: String(g.name), icon: g.icon ?? null }));
}

/** GET /admin/account/discord-servers: the Discord servers the Nexura bot is in. */
export const listNexuraDiscordServers = async (_req: GlobalRequest, res: GlobalResponse) => {
  try {
    res.status(OK).json({ servers: await botGuilds() });
  } catch (error: any) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: error?.message?.includes("BOT_TOKEN") ? error.message : "couldn't load the bot's Discord servers" });
  }
};

/** POST /admin/account/discord-link { guildId }: links one of the bot's servers to the Nexura hub. */
export const linkNexuraDiscord = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const guildId = String(req.body?.guildId ?? "").trim();
    const guild = (await botGuilds()).find(g => g.id === guildId);
    if (!guild) { res.status(BAD_REQUEST).json({ error: "the Nexura bot isn't in that Discord server" }); return; }
    const nexura = await resolveAdminCampaignHub(req.id);
    await hub.findByIdAndUpdate(nexura._id, { guildId: guild.id, discordServer: guild.name, discordConnected: true });
    res.status(OK).json({ message: "Discord connected", discordServer: guild.name });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "couldn't connect Discord" });
  }
};

// Nexura's Discord server. If the Nexura hub ever loses its link (e.g. a Disconnect), it is restored here.
export const NEXURA_DISCORD_GUILD_ID = process.env.NEXURA_DISCORD_GUILD_ID || "1419336727302111367";
let discordChecked = false;

/** Relinks Nexura's Discord once per server start when the Nexura hub has none (no OAuth: the bot is already in it). */
export async function ensureNexuraDiscord(nexuraHub: { _id: unknown; guildId?: string | null; discordConnected?: boolean }) {
  if (discordChecked) return;
  discordChecked = true;
  if (nexuraHub.guildId && nexuraHub.discordConnected) return;
  try {
    let name = "";
    if (BOT_TOKEN) {
      const { data } = await axios.get(`https://discord.com/api/v10/guilds/${NEXURA_DISCORD_GUILD_ID}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` }, timeout: 10_000 });
      name = String(data?.name ?? "");
    }
    await hub.findByIdAndUpdate(nexuraHub._id, { guildId: NEXURA_DISCORD_GUILD_ID, discordServer: name || "Nexura", discordConnected: true });
    logger.info(`Relinked Nexura's Discord server ${NEXURA_DISCORD_GUILD_ID}`);
  } catch (error) {
    discordChecked = false; // try again on a later request
    logger.error(error);
  }
}
