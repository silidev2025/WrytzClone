import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL, legalReady } from "@/lib/shared/legal";
import { Logo } from "@/components/workspace/Logo";

/** A value from the operator settings, or a highlighted gap that must be filled in. */
export function Fill({ value, label }: { value: string; label: string }) {
  return value ? <>{value}</> : <span className="fill-in">[{label}]</span>;
}

export function LegalFooter() {
  return (
    <nav className="legal-footer" aria-label="Legal">
      <Link href="/terms">Terms</Link>
      <Link href="/privacy">Privacy</Link>
      <Link href="/contact">Contact</Link>
      <Link href="/report">Report a problem</Link>
      {LEGAL.businessRegistration && <span>{LEGAL.businessRegistration}</span>}
    </nav>
  );
}

export function LegalShell({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--panel)" }}>
      <div className="doc-page">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <h1>{title}</h1>
        {updated && <p className="mini-note">Version {updated}</p>}
        {!legalReady() && (
          <div className="alert draft-banner" role="note">
            <span>
              <strong>Template — not yet complete.</strong> The operator of this site must fill in the highlighted details (in the settings described in README.md) and have this text reviewed
              by a lawyer before real people use the service.
            </span>
          </div>
        )}
        {children}
      </div>
      <LegalFooter />
    </div>
  );
}
