import path from "node:path";
import type { NextConfig } from "next";

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
    ];
  },
};

export default nextConfig;
