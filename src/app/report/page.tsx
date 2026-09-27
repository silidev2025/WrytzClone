import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { ReportForm } from "@/components/legal/ReportForm";
import { REPORT_REASONS } from "@/lib/server/reports";

export const metadata: Metadata = { title: "Report a problem" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const app = typeof sp.app === "string" ? sp.app.slice(0, 300) : "";
  return (
    <LegalShell title="Report a problem">
      <p>
        Tell us about an app that is a scam, asks for passwords or payment details under false pretences, sells illegal things, misuses people&apos;s data, copies someone&apos;s work, or
        harasses people. We review every report and can take apps offline.
      </p>
      <ReportForm reasons={REPORT_REASONS} initialApp={app} />
    </LegalShell>
  );
}
