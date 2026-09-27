import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/shared/brand";
import { LEGAL } from "@/lib/shared/legal";
import { RETENTION } from "@/lib/server/maintenance";
import { Fill, LegalShell } from "@/components/legal/LegalShell";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  const name = BRAND.name;
  return (
    <LegalShell title="Privacy notice" updated={LEGAL.termsVersion}>
      <p>
        This notice explains what personal information {name} handles, why, how long we keep it, and your rights under the Data Privacy Act of 2012 (Republic Act No. 10173).
      </p>

      <h2>1. Who is responsible</h2>
      <p>
        For your {name} account: <Fill value={LEGAL.operatorName} label="operator's legal name" />, <Fill value={LEGAL.operatorAddress} label="postal address" />. Privacy questions and
        requests: <Fill value={LEGAL.privacyEmail} label="privacy email" />. Data Protection Officer: <Fill value={LEGAL.dpoName} label="DPO name" />.
      </p>
      <p>
        <strong>Apps built with {name} are run by the people who made them.</strong> When you use such an app, its maker decides what it collects and is responsible for it; we store
        that data on their behalf. Ask the app&apos;s maker first about data you gave an app. If you can&apos;t reach them, contact us.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> name, email address, a scrambled (hashed) version of your password, an optional short bio, and when you accepted these terms.
        </li>
        <li>
          <strong>Sign-ins and security:</strong> your active sessions (with a rough device description such as “Chrome on Windows”), and a security log of sign-ins, password changes
          and admin or access changes. IP addresses in the log are stored only as a scrambled code.
        </li>
        <li>
          <strong>What you make:</strong> your apps, their designs, databases and uploaded files.
        </li>
        <li>
          <strong>Apps you use:</strong> when you choose “Continue” in someone&apos;s app, we record that choice. That app then sees your name and email address and an ID that exists only
          in that app. Until you choose to continue, apps can&apos;t tell who you are.
        </li>
        <li>
          <strong>What visitors send to apps:</strong> form answers and files, stored for the app&apos;s maker.
        </li>
      </ul>
      <p>We don&apos;t sell personal information and we don&apos;t use it for advertising.</p>

      <h2>3. Why, and on what basis</h2>
      <ul>
        <li>To provide the service you signed up for — our contract with you.</li>
        <li>To keep the service and its users safe (preventing abuse, investigating reports, keeping a security log) — our legitimate interest, and our legal obligations.</li>
        <li>To share your name and email with an app — only with your consent, which you can withdraw in Settings.</li>
      </ul>
      <p>
        {name} doesn&apos;t need sensitive personal information about you. App makers who collect sensitive information (for example health or religious details) must have a lawful basis
        for it, usually your explicit consent.
      </p>

      <h2>4. Who else sees it</h2>
      <ul>
        <li>App makers — only what you send to their app, and your name and email only if you chose to share them.</li>
        <li>
          Our service providers, who work under contract and only on our instructions: <Fill value="" label="hosting provider and where data is stored" />
          {process.env.RESEND_API_KEY ? "; Resend, which sends our emails" : ""}.
        </li>
        <li>Authorities, when the law requires it.</li>
      </ul>
      <p>
        Some apps show content from other services. Your browser then connects to them directly and they can see your IP address: Google Fonts (lettering in apps), Google Maps (maps),
        YouTube and Vimeo (videos), image hosts such as Picsum (sample photos), and any website an app embeds. Maps, videos and embedded websites load only after you click to show them.
      </p>

      <h2>5. How long we keep it</h2>
      <ul>
        <li>Your account and apps: until you delete them. Deleting your account deletes your apps, their data and your files straight away.</li>
        <li>Sign-in sessions: until they expire, 30 days after you sign in (or when you sign out).</li>
        <li>Admin invite links: 7 days. Password reset links: 1 hour.</li>
        <li>Files attached to a form that was never sent: {RETENTION.unsavedAttachmentsDays} day.</li>
        <li>The security log: {RETENTION.auditDays} days.</li>
        <li>
          Backups: <Fill value="" label="how long backups are kept" />.
        </li>
        <li>Data in other people&apos;s apps: until the app&apos;s maker deletes it or the app.</li>
      </ul>

      <h2>6. Your rights</h2>
      <p>
        You have the right to be informed, to access your data, to object, to have it corrected, blocked or erased, to data portability, to damages, and to file a complaint with the
        National Privacy Commission (privacy.gov.ph). How:
      </p>
      <ul>
        <li>
          <Link href="/settings">Settings</Link>: download all your data, change your name, stop sharing your details with apps, sign out other devices, or delete your account.
        </li>
        <li>
          Anything else — correcting your email, objecting, or data you sent to an app whose maker you can&apos;t reach — write to <Fill value={LEGAL.privacyEmail} label="privacy email" />.
          We may ask you to confirm your identity and will reply within <Fill value="" label="number" /> days.
        </li>
      </ul>

      <h2>7. Security</h2>
      <p>
        Passwords are stored only as scrambled hashes, connections are encrypted, access is limited to those who need it, and important changes are logged. No system is perfect: if a
        breach puts your information at risk, we will notify you and the National Privacy Commission as the law requires (within 72 hours of knowing about it where notification is
        required).
      </p>

      <h2>8. Children</h2>
      <p>
        {name} accounts are for people aged {LEGAL.minimumAge} and over. App makers must not knowingly collect children&apos;s information without a parent&apos;s or guardian&apos;s
        consent.
      </p>

      <h2>9. Changes</h2>
      <p>When this notice changes we update the version date above; we will tell you about important changes before they apply.</p>
    </LegalShell>
  );
}
