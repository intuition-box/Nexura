import { OTP } from "@/models/otp.model";
import { hubAdmin } from "@/models/hub.model";
import { addHubAdminEmail } from "@/utils/sendMail";
import { generateOTP } from "@/utils/utils";
import { CLIENT_URL } from "@/utils/env.utils";
import { IN_ANOTHER_STUDIO, inAnotherStudio } from "@/utils/hubAccounts";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR } from "@/utils/status.utils";

/** Error with the HTTP status the caller should respond with. */
export class InviteError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type InviteResult =
  | { emailed: true }
  | { emailed: false; link: string; code: string; emailError: string };

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Creates (or refreshes) a hub admin invitation and emails it.
 * If the email can't be sent: with keepIfEmailFails the invitation stays and the caller gets the
 * link and code to pass on themselves; otherwise it's rolled back and the error is rethrown.
 */
export async function createHubInvite({ hubId, email, role, clientUrl, keepIfEmailFails = false }: {
  hubId: string;
  email: string;
  role?: string;
  clientUrl?: string;
  keepIfEmailFails?: boolean;
}): Promise<InviteResult> {
  if (!email) throw new InviteError(BAD_REQUEST, "admin email is required");
  if (!hubId) throw new InviteError(BAD_REQUEST, "create a hub to continue");

  const validRole = role === "superadmin" ? "superadmin" : "admin";
  const normalizedEmail = String(email).trim().toLowerCase();

  const existingAdmin = await hubAdmin.findOne({ email: normalizedEmail, hub: hubId }).lean();
  if (existingAdmin) throw new InviteError(BAD_REQUEST, "this email is already in your studio");
  if (await inAnotherStudio(normalizedEmail, hubId)) throw new InviteError(BAD_REQUEST, IN_ANOTHER_STUDIO);

  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateOTP();
    const codeExists = await OTP.exists({ code: candidate });
    if (!codeExists) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new InviteError(INTERNAL_SERVER_ERROR, "Failed to generate invite code");

  const existingInvite = await OTP.findOne({ email: normalizedEmail, hubId }).lean();

  await OTP.findOneAndUpdate(
    { email: normalizedEmail, hubId },
    {
      email: normalizedEmail,
      code,
      hubId,
      role: validRole,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Use the client's origin for the invite link so it works in dev/prod
  const origin = clientUrl || CLIENT_URL;
  try {
    await addHubAdminEmail(normalizedEmail, code, origin);
    return { emailed: true };
  } catch (error: any) {
    if (keepIfEmailFails) {
      const link = `${origin.replace(/\/$/, "")}/studio/register?email=${encodeURIComponent(normalizedEmail)}&code=${encodeURIComponent(code)}`;
      return { emailed: false, link, code, emailError: error?.message || "the email could not be sent" };
    }
    if (existingInvite) {
      await OTP.findOneAndUpdate(
        { email: normalizedEmail, hubId },
        { code: existingInvite.code, role: existingInvite.role, expiresAt: existingInvite.expiresAt }
      );
    } else {
      await OTP.deleteOne({ email: normalizedEmail, hubId });
    }
    throw error;
  }
}
