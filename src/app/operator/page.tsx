import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { isOperator } from "@/lib/server/reports";
import { mailConfigured } from "@/lib/server/mail";
import { trustProxy } from "@/lib/server/http";
import { dataDir } from "@/lib/server/store";
import { legalReady } from "@/lib/shared/legal";
import { OperatorPanel } from "@/components/legal/OperatorPanel";

export const metadata: Metadata = { title: "Operator", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Hours since the newest `npm run backup` folder, or null when there is none. */
function lastBackupHours(): number | null {
  const dir = process.env.CRAFTBASE_BACKUP_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "backups");
  try {
    const newest = fs.readdirSync(dir).filter((n) => /^craftbase-\d{4}-\d{2}-\d{2}T/.test(n)).sort().pop();
    const m = newest && /^craftbase-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/.exec(newest);
    return m ? (Date.now() - Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`)) / 3_600_000 : null;
  } catch {
    return null;
  }
}

/** For the people who run this site: reports, takedowns, account recovery, setup checks. */
export default async function OperatorPage() {
  const user = await currentUser();
  if (!user) redirect("/auth?next=/operator");
  if (!isOperator(user)) redirect("/apps");
  const backup = process.env.DATABASE_URL ? null : lastBackupHours();
  const checks = [
    { ok: legalReady(), label: "Operator name, support and privacy emails are set (NEXT_PUBLIC_OPERATOR_NAME, …)" },
    { ok: mailConfigured(), label: "Email sending is set up (RESEND_API_KEY, MAIL_FROM) for password resets" },
    { ok: trustProxy(), label: "Running behind a trusted proxy (TRUST_PROXY=1) so rate limits see real IP addresses" },
    { ok: !!process.env.DATABASE_URL || !/onedrive|dropbox|icloud|google ?drive/i.test(dataDir()), label: "Data folder is not inside a cloud-synced folder" },
    process.env.DATABASE_URL
      ? { ok: !!process.env.CRAFTBASE_SECRET, label: "CRAFTBASE_SECRET is set (needed with Postgres)" }
      : { ok: backup !== null && backup < 48, label: `A backup was made in the last 2 days (npm run backup)${backup === null ? " — none found" : ` — newest is ${Math.round(backup)} h old`}` },
  ];
  return <OperatorPanel checks={checks} />;
}
