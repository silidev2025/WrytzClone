import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./workspace.css";
import "./runtime.css";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Pixelify_Sans } from "next/font/google";
import { BRAND } from "@/lib/shared/brand";
import { Toaster } from "@/components/ui/toast";
import { DialogHost } from "@/components/ui/confirm";

// served from this site (downloaded at build time), so visitors' browsers don't contact Google for them.
// Pixelify: menus, buttons and titles. Atkinson Hyperlegible: everything people read. Its mono: numbers and addresses.
const pixel = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixel", display: "swap" });
// Next has no fallback metrics for the Atkinson faces, so it can't size-match a fallback for them
const text = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-text", display: "swap", adjustFontFallback: false });
const mono = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", adjustFontFallback: false });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

// Apply the saved colour mode before the first paint (no flash of the wrong theme).
const colorModeScript = `try{var m=localStorage.getItem('cb-color-mode')||'light';if(m==='system'){m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=m}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${pixel.variable} ${text.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: colorModeScript }} />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Toaster />
        <DialogHost />
      </body>
    </html>
  );
}
