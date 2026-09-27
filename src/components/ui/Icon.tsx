import type { CSSProperties } from "react";
import { LUCIDE } from "@/lib/client/lucideLibrary";
import { BRAND_ICONS } from "@/lib/client/brandIcons";

export function iconExists(name: string | undefined): boolean {
  return !!name && (name in LUCIDE || name in BRAND_ICONS);
}

/** Render an icon by name (lucide names plus a few brand icons). */
export function Icon({
  name,
  size = 18,
  strokeWidth,
  className,
  color,
  style,
}: {
  name: string | undefined;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  color?: string;
  style?: CSSProperties;
}) {
  const C = (name && (LUCIDE[name] || BRAND_ICONS[name])) || LUCIDE.Sparkles;
  return <C size={size} strokeWidth={strokeWidth} className={className} color={color} style={style} aria-hidden="true" />;
}
