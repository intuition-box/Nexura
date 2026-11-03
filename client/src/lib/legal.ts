// Bump to re-ask everyone
export const LEGAL_VERSION = "2026-10-29.2";
export const MIN_AGE = 18;
export const TERMS_URL = "/docs/legal#terms-of-use";
export const PRIVACY_URL = "/docs/legal#privacy-policy";

export const LEGAL_UPDATED = new Date(`${LEGAL_VERSION.slice(0, 10)}T00:00:00Z`)
  .toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });

export type LegalConsent = { version: string; ageConfirmed: true };
export type ConsentReason = "connect" | "updated";

const STORAGE_KEY = "nexura:legal-consent";

export function storedConsent(): LegalConsent | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return parsed?.version === LEGAL_VERSION && parsed?.ageConfirmed === true ? parsed : null;
  } catch { return null; }
}

export function saveConsent(): LegalConsent {
  const consent: LegalConsent = { version: LEGAL_VERSION, ageConfirmed: true };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch {}
  return consent;
}

type Ask = (reason: ConsentReason) => Promise<boolean>;
let ask: Ask | null = null;
let pending: Promise<boolean> | null = null;

export const registerConsentPrompt = (fn: Ask | null) => { ask = fn; };

export function requestLegalConsent(reason: ConsentReason = "connect"): Promise<boolean> {
  if (storedConsent()) return Promise.resolve(true);
  if (!ask) return Promise.resolve(false);
  return pending ??= ask(reason).finally(() => { pending = null; });
}
