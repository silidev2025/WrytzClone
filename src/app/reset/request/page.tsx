import type { Metadata } from "next";
import { ResetForm } from "@/components/workspace/ResetForm";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ResetRequestPage() {
  return <ResetForm mode="request" />;
}
