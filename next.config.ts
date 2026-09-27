import path from "node:path";
import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/**
 * What pages may load. Apps show images, videos, maps and embeds from other sites (https
 * only) and Google Fonts; scripts only come from this site. Next.js needs inline scripts
 * (and eval while developing). Nobody else may frame our pages.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "frame-src https:",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // `pg` is only loaded when DATABASE_URL is set; keep it out of the server bundle.
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  // There's an unrelated package-lock.json in the home folder; pin the project root.
  turbopack: { root: path.resolve(".") },
  // Don't generate AGENTS.md / CLAUDE.md in the project folder.
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // browsers only honour this over HTTPS; there it keeps every later visit on HTTPS
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      {
        // pages (not API responses or files, which set their own)
        source: "/((?!api/).*)",
        headers: [{ key: "Content-Security-Policy", value: csp }],
      },
    ];
  },
};

export default nextConfig;
