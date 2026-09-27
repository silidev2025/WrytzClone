import Link from "next/link";
import { BRAND } from "@/lib/shared/brand";
import { BrandMark } from "@/components/workspace/Logo";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeContent: "center", justifyItems: "center", gap: 14, textAlign: "center", padding: 24 }}>
      <BrandMark size={52} />
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, marginTop: 8 }}>This page isn&apos;t here.</h1>
      <p style={{ color: "var(--muted)", maxWidth: 420 }}>The app may be unpublished or removed, or the link may be incorrect.</p>
      <Link className="btn primary" href="/">
        Back to {BRAND.name}
      </Link>
    </main>
  );
}
