import type { Metadata } from "next";
import { currentUser } from "@/lib/server/auth";
import { Explore } from "@/components/workspace/Explore";

export const metadata: Metadata = { title: "Explore" };

export default async function ExplorePage() {
  const user = await currentUser();
  return <Explore signedIn={!!user} />;
}
