import type { Metadata } from "next";
import { Guide } from "@/components/workspace/Guide";

export const metadata: Metadata = { title: "User guide" };

export default function GuidePage() {
  return <Guide />;
}
