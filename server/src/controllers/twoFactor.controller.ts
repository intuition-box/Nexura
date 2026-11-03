import QRCode from "qrcode";
import logger from "@/config/logger";
import { hubAdmin, touchHubAdminActivity } from "@/models/hub.model";
import { BAD_REQUEST, FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND, OK, UNAUTHORIZED } from "@/utils/status.utils";
import { JWT, getRefreshToken, hubSessionTtl } from "@/utils/utils";
import { matchTotp, newTotpSecret, otpauthUrl } from "@/utils/totp";
import { open, seal } from "@/utils/secretBox";

export const TWO_FACTOR_PURPOSE = "hub-2fa";

/** Checks a code against the stored secret and spends its time step, so it works only once. */
async function useCode(adminId: unknown, secretSealed: string | null | undefined, lastStep: number | undefined, code: unknown) {
  if (!secretSealed) return false;
  const step = matchTotp(open(secretSealed), code);
  if (step === null || step <= (lastStep ?? 0)) return false;
  const spent = await hubAdmin.updateOne({ _id: adminId, $or: [{ twoFactorLastStep: { $lt: step } }, { twoFactorLastStep: null }] }, { $set: { twoFactorLastStep: step } });
  return spent.modifiedCount > 0;
}

/** POST /hub/2fa/setup: a new secret to add to Google Authenticator (not active until /enable). */
export const setupTwoFactor = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const admin = await hubAdmin.findById(req.id).select("email twoFactorEnabled").lean() as any;
    if (!admin) { res.status(NOT_FOUND).json({ error: "admin not found" }); return; }
    if (admin.twoFactorEnabled) { res.status(BAD_REQUEST).json({ error: "2-step verification is already on" }); return; }
    const secret = newTotpSecret();
    await hubAdmin.updateOne({ _id: req.id }, { $set: { twoFactorPendingSecret: seal(secret) } });
    const url = otpauthUrl(secret, admin.email);
    const qrCodeDataUrl = await QRCode.toDataURL(url, { margin: 0, width: 320, color: { dark: "#1c2533", light: "#ffffff" } });
    res.status(OK).json({ secret, otpauthUrl: url, qrCodeDataUrl });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "couldn't start 2-step verification setup" });
  }
};

/** POST /hub/2fa/enable { code }: turns it on once a code from the new secret checks out. */
export const enableTwoFactor = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const admin = await hubAdmin.findById(req.id).select("twoFactorPendingSecret twoFactorLastStep twoFactorEnabled").lean() as any;
    if (!admin?.twoFactorPendingSecret) { res.status(BAD_REQUEST).json({ error: "start the setup again" }); return; }
    if (!(await useCode(req.id, admin.twoFactorPendingSecret, admin.twoFactorLastStep, req.body?.code))) {
      res.status(BAD_REQUEST).json({ error: "That code didn't work. Wait for a new one and try again." });
      return;
    }
    await hubAdmin.updateOne({ _id: req.id }, { $set: { twoFactorEnabled: true, twoFactorSecret: admin.twoFactorPendingSecret, twoFactorPendingSecret: null } });
    res.status(OK).json({ twoFactorEnabled: true });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "couldn't turn on 2-step verification" });
  }
};

/** POST /hub/2fa/disable { code }: needs a current code from the app. */
export const disableTwoFactor = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const admin = await hubAdmin.findById(req.id).select("twoFactorSecret twoFactorLastStep twoFactorEnabled").lean() as any;
    if (!admin?.twoFactorEnabled) { res.status(OK).json({ twoFactorEnabled: false }); return; }
    if (!(await useCode(req.id, admin.twoFactorSecret, admin.twoFactorLastStep, req.body?.code))) {
      res.status(BAD_REQUEST).json({ error: "That code didn't work. Wait for a new one and try again." });
      return;
    }
    await hubAdmin.updateOne({ _id: req.id }, { $set: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null } });
    res.status(OK).json({ twoFactorEnabled: false });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "couldn't turn off 2-step verification" });
  }
};

/** POST /hub/2fa/verify-login { twoFactorToken, code }: the second step of sign-in. */
export const verifyTwoFactorLogin = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { twoFactorToken, code } = req.body ?? {};
    let id: string;
    try {
      ({ id } = await JWT.verifyFor(String(twoFactorToken ?? ""), TWO_FACTOR_PURPOSE) as { id: string });
    } catch {
      res.status(UNAUTHORIZED).json({ error: "This sign-in has expired. Sign in again." });
      return;
    }
    const admin = await hubAdmin.findById(id).lean() as any;
    if (!admin?.twoFactorEnabled) { res.status(FORBIDDEN).json({ error: "Sign in again." }); return; }
    if (!(await useCode(admin._id, admin.twoFactorSecret, admin.twoFactorLastStep, code))) {
      res.status(BAD_REQUEST).json({ error: "That code didn't work. Wait for a new one and try again." });
      return;
    }
    touchHubAdminActivity(String(admin._id));
    res.cookie("hubRefreshToken", getRefreshToken(String(admin._id)), { httpOnly: true, secure: true, maxAge: 30 * 24 * 60 * 60 });
    res.status(OK).json({
      message: "signed in!",
      accessToken: JWT.sign(String(admin._id), hubSessionTtl(req.body?.remember)),
      admin: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role, hub: admin.hub },
    });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error signing in" });
  }
};
