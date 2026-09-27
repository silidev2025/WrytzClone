import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/shared/brand";
import { LEGAL } from "@/lib/shared/legal";
import { APP_ATTACHMENT_QUOTA, USER_QUOTA } from "@/lib/server/media";
import { MAX_APPS_PER_USER } from "@/lib/server/apps";
import { Fill, LegalShell } from "@/components/legal/LegalShell";

export const metadata: Metadata = { title: "Terms" };

const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;

export default function TermsPage() {
  const name = BRAND.name;
  return (
    <LegalShell title="Terms of Service" updated={LEGAL.termsVersion}>
      <p>
        These terms are an agreement between you and <Fill value={LEGAL.operatorName} label="operator's legal name" /> (“we”), who runs {name}. By creating an account you accept
        them. Please read them — they are written to be understood.
      </p>

      <h2>1. Who we are</h2>
      <p>
        <Fill value={LEGAL.operatorName} label="operator's legal name" />, <Fill value={LEGAL.operatorAddress} label="postal address" />.{" "}
        {LEGAL.businessRegistration ? `${LEGAL.businessRegistration}. ` : <Fill value="" label="business registration numbers (e.g. DTI/SEC, BIR), if any" />} Contact:{" "}
        <Fill value={LEGAL.supportEmail} label="support email" />. See also our <Link href="/contact">contact page</Link>.
      </p>

      <h2>2. The service</h2>
      <p>
        {name} lets you design websites and phone apps without code, keep their data in a built-in database, and publish them on the internet. The service is currently free. We may
        improve, change or stop parts of it; if we stop the service we will give at least 30 days&apos; notice so you can download your data.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>You must be at least {LEGAL.minimumAge} years old.</li>
        <li>Give your real name and an email address you control, and keep your password to yourself. You are responsible for what happens in your account.</li>
        <li>Tell us straight away at <Fill value={LEGAL.supportEmail} label="support email" /> if you think someone else used your account.</li>
      </ul>

      <h2>4. What you may not do</h2>
      <p>Don&apos;t use {name}, or apps built with it, to:</p>
      <ul>
        <li>break the law, or sell or promote illegal goods or services;</li>
        <li>deceive people — scams, phishing, fake shops, impersonating someone, or collecting passwords or payment details under false pretences;</li>
        <li>harass, threaten or discriminate against anyone, or publish sexual content involving minors or content that exploits anyone;</li>
        <li>infringe someone else&apos;s copyright, trademark or other rights;</li>
        <li>collect personal or sensitive information (health, religion, finances, government IDs…) without a lawful basis and a clear notice to the people concerned;</li>
        <li>send spam, spread malware, or attack, overload or probe the service or other people&apos;s apps.</li>
      </ul>

      <h2>5. Your apps are yours — and your responsibility</h2>
      <p>
        You run the apps you publish. Toward the people who use them you are responsible for complying with the law, including privacy law (in the Philippines, the Data Privacy Act of
        2012) and consumer law (such as the Consumer Act and the Internet Transactions Act). In particular, if your app sells anything, show who you are and how to reach you, your
        prices, delivery, returns, refunds and how complaints are handled. {name}&apos;s templates contain example text: replace it with your real terms before you publish.
      </p>

      <h2>6. Content and licences</h2>
      <ul>
        <li>You keep ownership of what you create and upload. You let us store, copy and show it only as needed to run the service for you.</li>
        <li>
          <strong>Explore and remixing:</strong> if you list an app in Explore, you allow other {name} users to make and change their own copy of its design — pages, text, and images
          shown on its pages — for use in their own apps. Rows in your database are never copied. Only list designs you have the right to share this way.
        </li>
        <li>Templates are provided for you to use freely in your apps. Example photos come from free image libraries; check the licence of any image before relying on it commercially.</li>
      </ul>

      <h2>7. Reports, suspension and ending</h2>
      <p>
        Anyone can <Link href="/report">report an app</Link>. If an app or account breaks these terms or the law, we may take the app offline or suspend the account, and we will
        tell you why and how to respond, unless the law or safety prevents it. You can reply to <Fill value={LEGAL.supportEmail} label="support email" /> to ask us to reconsider.
        You can delete your account at any time in Settings.
      </p>

      <h2>8. Limits</h2>
      <p>
        To keep the service fair: up to {MAX_APPS_PER_USER} apps per account, {mb(USER_QUOTA)} of design uploads per account, and {mb(APP_ATTACHMENT_QUOTA)} of files attached by visitors
        per app. If we ever introduce paid plans or charges, we will tell you at least 30 days ahead and nothing will be charged without your explicit agreement.
      </p>

      <h2>9. Availability and backups</h2>
      <p>
        We work to keep the service running and your data safe, but we can&apos;t promise it will always be available or error-free. Keep your own copies of important data (you can
        download your collections as CSV and your account data from Settings).
      </p>

      <h2>10. Liability</h2>
      <p>
        We are responsible for losses we cause through our own fault as the law requires. We are not responsible for how you or other people use apps built with {name}, or for
        losses you could have avoided with reasonable care. Nothing in these terms limits rights you have under consumer or privacy law that can&apos;t be limited by contract.
      </p>

      <h2>11. Processing data for your apps</h2>
      <p>
        When people use your app, you decide what data it collects and why: you are the <em>personal information controller</em> for that data, and we process it only to run your app
        for you (<em>personal information processor</em>). We keep it secure (see our <Link href="/privacy">Privacy notice</Link>), don&apos;t use it for anything else, tell you without
        undue delay about any security breach affecting it, help you answer requests from the people concerned (you can export and delete records), and delete it when you delete the
        app. Service providers we rely on: <Fill value="" label="hosting provider and location" />
        {process.env.RESEND_API_KEY ? ", Resend (email delivery)" : ""}. You must tell your app&apos;s users how you use their data and have a lawful basis for it.
      </p>

      <h2>12. Disputes and changes</h2>
      <p>
        These terms are governed by the laws of the Republic of the Philippines. If something goes wrong, contact us first at <Fill value={LEGAL.supportEmail} label="support email" /> — we
        aim to resolve complaints within <Fill value="" label="number" /> days. This doesn&apos;t stop you from going to the Department of Trade and Industry, the National Privacy
        Commission or the courts. When we change these terms we update the version date above and ask you to accept important changes again.
      </p>
    </LegalShell>
  );
}
