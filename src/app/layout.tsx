import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./workspace.css";
import "./runtime.css";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { BRAND } from "@/lib/shared/brand";
import { Toaster } from "@/components/ui/toast";
import { DialogHost } from "@/components/ui/confirm";

// served from this site (downloaded at build time), so visitors' browsers don't contact Google for them
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-bricolage", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f5fb",
};

// Apply the saved colour mode before the first paint (no flash of the wrong theme).
const colorModeScript = `try{var m=localStorage.getItem('cb-color-mode')||'light';if(m==='system'){m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=m}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <html lang="en" data-theme="light" className={`${inter.variable} ${bricolage.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: colorModeScript }} />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Toaster />
        <DialogHost />
      </body>
    </html>
  );
}
