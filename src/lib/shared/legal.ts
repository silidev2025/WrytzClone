/*
 * Who runs this Craftbase and how to reach them. Set these in .env.local before going live;
 * they appear on the Terms, Privacy, contact and report pages and in footers.
 */

const env = (v: string | undefined) => (v || "").trim();

export const LEGAL = {
  /** the legal name of the business or person running the service */
  operatorName: env(process.env.NEXT_PUBLIC_OPERATOR_NAME),
  /** a postal address for notices */
  operatorAddress: env(process.env.NEXT_PUBLIC_OPERATOR_ADDRESS),
  /** business registration details (e.g. DTI/SEC and BIR numbers), if any */
  businessRegistration: env(process.env.NEXT_PUBLIC_BUSINESS_REGISTRATION),
  /** where people get help and send complaints */
  supportEmail: env(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
  /** where people send privacy requests (access, correction, deletion…) */
  privacyEmail: env(process.env.NEXT_PUBLIC_PRIVACY_EMAIL) || env(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
  /** the Data Protection Officer's name, if one is appointed */
  dpoName: env(process.env.NEXT_PUBLIC_DPO_NAME),
  /** the youngest age allowed to create an account */
  minimumAge: Number(process.env.NEXT_PUBLIC_MINIMUM_AGE) || 18,
  /** change this date whenever the Terms or Privacy notice change, so people accept them again */
  termsVersion: "2026-09-28",
};

/** True when the details needed for real users are filled in. */
export function legalReady(): boolean {
  return !!(LEGAL.operatorName && LEGAL.supportEmail && LEGAL.privacyEmail);
}

export function contactLine(): string {
  return LEGAL.supportEmail || "the operator of this service";
}
