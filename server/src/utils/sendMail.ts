import nodemailer from "nodemailer";
import hbs, {
  type NodemailerExpressHandlebarsOptions,
} from "nodemailer-express-handlebars";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import logger from "@/config/logger";
import { randomUUID } from "crypto";
import { withRetry, fetchWithRetry } from "@/utils/resilience";
import {
  EMAIL_USER,
  EMAIL_PASSWORD,
  ADMIN_URL,
  CLIENT_URL,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  RESEND_API_KEY,
  RESEND_FROM,
  trustedOrigin,
} from "./env.utils";

const __dirname = dirname(fileURLToPath(import.meta.url));

const smtpHost = SMTP_HOST?.trim() || "smtp.gmail.com";
const smtpPort = Number(SMTP_PORT || "587");
const smtpSecure = SMTP_SECURE?.trim().toLowerCase() === "true" || smtpPort === 465;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  requireTLS: !smtpSecure,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD,
  },
  tls: {
    servername: smtpHost,
  },
});

// Invite delivery tries each route in turn. Some hosts block one SMTP port but not the other,
// and short timeouts keep a blocked port from hanging the request for minutes.
const inviteSmtpRoutes = (() => {
  const routes = [
    { host: smtpHost, port: smtpPort, secure: smtpSecure },
    { host: "smtp.gmail.com", port: 465, secure: true },
    { host: "smtp.gmail.com", port: 587, secure: false },
  ];
  const seen = new Set<string>();
  return routes.filter(r => {
    const key = `${r.host}:${r.port}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(r => ({
    label: `${r.host}:${r.port}`,
    transporter: nodemailer.createTransport({
      ...r,
      requireTLS: !r.secure,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
      auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
      tls: { servername: r.host },
    }),
  }));
})();

const isConnectionError = (error: any) =>
  ["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ECONNREFUSED", "ECONNRESET", "EDNS", "ENETUNREACH", "EHOSTUNREACH"].includes(error?.code)
  || /timeout|timed out|connect/i.test(error?.message ?? "");

/** Sends through the main SMTP route, retrying brief connection failures with backoff. */
const sendMailWithRetry = (mail: Parameters<typeof transporter.sendMail>[0]) =>
  withRetry(() => transporter.sendMail(mail), { label: "email (SMTP)", shouldRetry: isConnectionError });

async function sendViaResend(mail: { to: string; subject: string; html: string; text: string }) {
  // The idempotency key makes a retried send deliver one email, never two
  const res = await fetchWithRetry("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
    body: JSON.stringify({ from: RESEND_FROM || EMAIL_USER, ...mail }),
  }, { timeoutMs: 15000, retries: 2, label: "email (Resend)" });
  if (!res.ok) throw new Error(`Resend refused the email (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

/** Sends an invite: Resend's HTTPS API when configured, otherwise each SMTP route until one connects. */
async function deliverInvite(mail: { to: string; subject: string; html: string; text: string }) {
  if (RESEND_API_KEY) {
    await sendViaResend(mail);
    return;
  }
  let lastError: any;
  for (const route of inviteSmtpRoutes) {
    try {
      // One quick retry on this route before moving to the next
      await withRetry(() => route.transporter.sendMail({ from: EMAIL_USER, ...mail } as MailOptions), { retries: 1, label: `invite email via ${route.label}`, shouldRetry: isConnectionError });
      return;
    } catch (error: any) {
      lastError = error;
      logger.error(`Invite email via ${route.label} failed: ${error?.code ?? ""} ${error?.message}`);
      if (!isConnectionError(error)) break; // wrong password etc. won't be fixed by another port
    }
  }
  throw lastError ?? new Error("no email route is configured");
}

const options: NodemailerExpressHandlebarsOptions = {
  viewEngine: {
    partialsDir: path.resolve(__dirname, "../utils/templates"),
    defaultLayout: false,
  },
  viewPath: path.resolve(__dirname, "../utils/templates"),
};

transporter.use("compile", hbs(options));

export const sendEmailToAdmin = async (email: string, code: string, origin?: string) => {
  try {
    const baseUrl = trustedOrigin(origin, ADMIN_URL);
    const signUpUrl = `${baseUrl.replace(/\/$/, "")}/?email=${encodeURIComponent(email)}`;
    await sendMailWithRetry({
      from: EMAIL_USER,
      to: email,
      subject: "Complete Nexura Admin Setup",
      template: "admin",
      context: {
        url: signUpUrl,
        code
      },
    } as MailOptions);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const resetEmail = async (email: string, link: string) => {
  try {
    await sendMailWithRetry({
      from: EMAIL_USER,
      to: email,
      subject: "Reset Password",
      template: "reset",
      context: {
        link
      },
    } as MailOptions);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const resetPasswordOTPEmail = async (email: string, code: string) => {
  try {
    await sendMailWithRetry({
      from: EMAIL_USER,
      to: email,
      subject: "Password Reset Code",
      template: "reset-otp",
      context: {
        code
      },
    } as MailOptions);
  } catch (error: any) {
    logger.error(error);
    throw new Error(error.message);
  }
};

export const sendAdminResetEmail = async (email: string, token: string, origin?: string) => {
  try {
    const baseUrl = trustedOrigin(origin, ADMIN_URL).replace(/\/$/, "");
    const link = `${baseUrl}/?reset=1&token=${encodeURIComponent(token)}`;

    await sendMailWithRetry({
      from: EMAIL_USER,
      to: email,
      subject: "Reset Admin Password",
      template: "reset",
      context: {
        link,
      },
    } as MailOptions);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const addHubAdminEmail = async (email: string, code: string, origin?: string) => {
  try {
    const baseUrl = trustedOrigin(origin, CLIENT_URL);
    const signUpUrl = `${baseUrl}/studio/register?email=${encodeURIComponent(email)}`;
    logger.info(`Sending admin invite to ${email} with link ${signUpUrl}`);
    await deliverInvite({
      to: email,
      subject: "Hub admin setup",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 640px; margin: 0 auto; padding: 24px;">
          <h2 style="margin: 0 0 16px;">You have been invited to Nexura Studio</h2>
          <p style="margin: 0 0 12px;">You have been invited to join a hub on Nexura Studio as an admin.</p>
          <p style="margin: 0 0 12px;">Your access code is <strong>${code}</strong>.</p>
          <p style="margin: 0 0 20px;">Use the button below to complete your setup and create your password.</p>
          <p style="margin: 0 0 24px;">
            <a href="${signUpUrl}" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 600;">Complete Admin Setup</a>
          </p>
          <p style="margin: 0 0 8px; font-size: 14px; color: #4b5563;">If the button does not work, use this link:</p>
          <p style="margin: 0; font-size: 14px; word-break: break-all; color: #2563eb;">${signUpUrl}</p>
        </div>
      `,
      text: `You have been invited to join a hub on Nexura Studio as an admin.\n\nYour access code is: ${code}\n\nComplete your setup here: ${signUpUrl}`,
    });
    logger.info(`Admin invite email sent successfully to ${email}`);
  } catch (error: any) {
    logger.error(`Failed to send admin invite email to ${email}:`, error.message);
    throw new Error(error.message);
  }
};

export const sendOTPConfirmEmail = async ({ email, code }: { email: string, code: string }) => {
  try {
    await sendMailWithRetry({
      from: EMAIL_USER,
      to: email,
      subject: "Your Nexura Verification Code",
      template: "confirm-email",
      context: {
        code,
      },
    } as MailOptions);
  } catch (error: any) {
    throw new Error(error.message);
  }
};