import type { Metadata } from "next";
import { resetInfo } from "@/lib/server/reset";
import { ResetForm } from "@/components/workspace/ResetForm";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { valid } = await resetInfo(token);
  return <ResetForm mode="set" token={token} valid={valid} />;
}
