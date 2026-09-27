import Link from "next/link";
import { BRAND } from "@/lib/shared/brand";

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className="brandmark" style={{ width: size, height: size, borderRadius: size * 0.3 }}>
      <svg viewBox="0 0 64 64" aria-hidden="true" style={{ width: size * 0.62, height: size * 0.62 }}>
        <path d="M40.5 22.5a13 13 0 1 0 0 19" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
        <circle cx="44" cy="32" r="4.2" fill="#fff" />
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
