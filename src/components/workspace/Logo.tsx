import Link from "next/link";
import { BRAND } from "@/lib/shared/brand";

/** The mark: a stack of two cards, the front one with an inverted title bar — the product in one glyph. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className="brandmark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 32 32" aria-hidden="true" shapeRendering="crispEdges" style={{ width: size, height: size }}>
        <rect x="10" y="3" width="19" height="16" rx="1.5" style={{ fill: "var(--paper)" }} stroke="currentColor" strokeWidth="2" />
        <rect x="3" y="11" width="19" height="17" rx="1.5" style={{ fill: "var(--paper)" }} stroke="currentColor" strokeWidth="2" />
        <rect x="3" y="11" width="19" height="5" fill="currentColor" />
        <rect x="6" y="20" width="9" height="2" fill="currentColor" />
        <rect x="6" y="24" width="12" height="2" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link className="logo" href={href} aria-label={`${BRAND.name} home`}>
      <BrandMark />
      <span>
        {BRAND.lower}
        <span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
