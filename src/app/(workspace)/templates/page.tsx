import type { Metadata } from "next";
import { currentUser } from "@/lib/server/auth";
import { templateCards } from "@/lib/server/templateCards";
import { TemplatesGallery } from "@/components/workspace/TemplatesGallery";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const user = await currentUser();
  return <TemplatesGallery templates={templateCards()} signedIn={!!user} />;
}
