import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/shared/brand";
import { LEGAL } from "@/lib/shared/legal";
import { Fill, LegalShell } from "@/components/legal/LegalShell";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <LegalShell title="Contact">
      <h2>Who runs {BRAND.name}</h2>
      <p>
        <Fill value={LEGAL.operatorName} label="operator's legal name" />
        <br />
        <Fill value={LEGAL.operatorAddress} label="postal address" />
        {LEGAL.businessRegistration && (
          <>
            <br />
            {LEGAL.businessRegistration}
          </>
        )}
      </p>
      <h2>Help, complaints and account problems</h2>
      <p>
        <Fill value={LEGAL.supportEmail} label="support email" /> — including lost access to your account (we can send you a password reset link after confirming it&apos;s you).
      </p>
      <h2>Privacy requests</h2>
      <p>
        <Fill value={LEGAL.privacyEmail} label="privacy email" />
        {LEGAL.dpoName ? ` — Data Protection Officer: ${LEGAL.dpoName}` : ""}. See the <Link href="/privacy">Privacy notice</Link> for what you can ask.
      </p>
      <h2>Something wrong with an app?</h2>
      <p>
        Apps built with {BRAND.name} are run by their makers — contact them first about orders, bookings or your data. To report an app that is illegal, a scam or harmful, use{" "}
        <Link href="/report">Report a problem</Link>.
      </p>
    </LegalShell>
  );
}
