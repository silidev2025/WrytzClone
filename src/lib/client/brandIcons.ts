import { createLucideIcon, type LucideIcon } from "lucide-react";

/*
 * Social/brand icons in the same 24×24 stroke style as lucide (lucide 1.x dropped its
 * brand icons). Paths adapted from lucide ≤0.4 (ISC) and Tabler Icons (MIT).
 */

type Node = Parameters<typeof createLucideIcon>[1];

const make = (name: string, node: Node): LucideIcon => createLucideIcon(name, node);

export const BRAND_ICONS: Record<string, LucideIcon> = {
  Instagram: make("instagram", [
    ["rect", { width: "20", height: "20", x: "2", y: "2", rx: "5", ry: "5", key: "a" }],
    ["path", { d: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z", key: "b" }],
    ["line", { x1: "17.5", x2: "17.51", y1: "6.5", y2: "6.5", key: "c" }],
  ]),
  Facebook: make("facebook", [["path", { d: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z", key: "a" }]]),
  Linkedin: make("linkedin", [
    ["path", { d: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z", key: "a" }],
    ["rect", { width: "4", height: "12", x: "2", y: "9", key: "b" }],
    ["circle", { cx: "4", cy: "4", r: "2", key: "c" }],
  ]),
  Youtube: make("youtube", [
    ["path", { d: "M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17", key: "a" }],
    ["path", { d: "m10 15 5-3-5-3z", key: "b" }],
  ]),
  Github: make("github", [
    ["path", { d: "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4", key: "a" }],
    ["path", { d: "M9 18c-4.51 2-5-2-7-2", key: "b" }],
  ]),
  XTwitter: make("x-twitter", [
    ["path", { d: "M4 4l11.733 16h4.267l-11.733 -16z", key: "a" }],
    ["path", { d: "M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772", key: "b" }],
  ]),
  Tiktok: make("tiktok", [
    ["path", { d: "M21 7.917v4.034a9.948 9.948 0 0 1 -5 -1.951v4.5a6.5 6.5 0 1 1 -8 -6.326v4.326a2.5 2.5 0 1 0 4 2v-11.5h4.083a6.005 6.005 0 0 0 4.917 4.917z", key: "a" }],
  ]),
  Dribbble: make("dribbble", [
    ["circle", { cx: "12", cy: "12", r: "10", key: "a" }],
    ["path", { d: "M19.13 5.09C15.22 9.14 10 10.44 2.25 10.94", key: "b" }],
    ["path", { d: "M21.75 12.84c-6.62-1.41-12.14 1-16.38 6.32", key: "c" }],
    ["path", { d: "M8.56 2.75c4.37 6 6 9.42 8 17.72", key: "d" }],
  ]),
  Figma: make("figma", [
    ["path", { d: "M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z", key: "a" }],
    ["path", { d: "M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z", key: "b" }],
    ["path", { d: "M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z", key: "c" }],
    ["path", { d: "M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z", key: "d" }],
    ["path", { d: "M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z", key: "e" }],
  ]),
  Whatsapp: make("whatsapp", [
    ["path", { d: "M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9", key: "a" }],
    ["path", { d: "M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1", key: "b" }],
  ]),
  Discord: make("discord", [
    ["path", { d: "M8 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0", key: "a" }],
    ["path", { d: "M14 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0", key: "b" }],
    ["path", { d: "M15.5 17c0 1 1.5 3 2 3c1.5 0 2.833 -1.667 3.5 -3c.667 -1.667 .5 -5.833 -1.5 -11.5c-1.457 -1.015 -3 -1.34 -4.5 -1.5l-.972 1.923a11.913 11.913 0 0 0 -4.053 0l-.975 -1.923c-1.5 .16 -3.043 .485 -4.5 1.5c-2 5.667 -2.167 9.833 -1.5 11.5c.667 1.333 2 3 3.5 3c.5 0 2 -2 2 -3", key: "c" }],
    ["path", { d: "M7 16.5c3.5 1 6.5 1 10 0", key: "d" }],
  ]),
};

export const BRAND_ICON_NAMES = Object.keys(BRAND_ICONS);
