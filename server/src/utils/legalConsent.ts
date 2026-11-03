const VERSION = /^\d{4}-\d{2}-\d{2}(\.\d+)?$/;

export type LegalConsent = { version: string; ageConfirmed: true; acceptedAt: Date };

export function readLegalConsent(consent: unknown): LegalConsent | null {
  const c = consent as { version?: unknown; ageConfirmed?: unknown } | null | undefined;
  if (typeof c?.version !== "string" || !VERSION.test(c.version) || c.ageConfirmed !== true) return null;
  return { version: c.version, ageConfirmed: true, acceptedAt: new Date() };
}

export const CONSENT_REQUIRED = "agree to the Terms of Use and Privacy Policy to continue";
