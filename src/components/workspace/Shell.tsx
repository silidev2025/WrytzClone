"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, Compass, LayoutGrid, LogIn, LogOut, Menu, Monitor, Moon, Settings, Shapes, Sun, X } from "lucide-react";
import type { PublicUser } from "@/lib/shared/types";
import { Dropdown } from "@/components/ui/Popover";
import { Logo } from "./Logo";
import { useColorMode } from "./ColorMode";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import { useModalFocus } from "@/components/ui/useModalFocus";

export function Avatar({ user, size = 34 }: { user: Pick<PublicUser, "name" | "avatarColor">; size?: number }) {
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="avatar" style={{ background: user.avatarColor, width: size, height: size, fontSize: size * 0.4 }}>
      {initials || "?"}
    </span>
  );
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  // installed apps under this address may have offline copies of pages: clear them too
  try {
    if ("caches" in window) for (const k of await caches.keys()) if (k.startsWith("cb-app")) await caches.delete(k);
  } catch {
    /* nothing cached */
  }
  window.location.href = "/";
}

export function Shell({ user, appCount, templateCount, children }: { user: PublicUser | null; appCount: number; templateCount: number; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const mobile = useMediaQuery("(max-width: 900px)");
  const drawerRef = useModalFocus(mobile && open, () => setOpen(false));
  const [mode, setMode] = useColorMode();
  useEffect(() => setOpen(false), [pathname]);

  const nav = [
    { href: "/apps", label: "My apps", icon: <LayoutGrid size={19} />, tag: user ? String(appCount) : undefined },
    { href: "/templates", label: "Templates", icon: <Shapes size={19} />, tag: String(templateCount) },
    { href: "/explore", label: "Explore", icon: <Compass size={19} /> },
  ];
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="workspace">
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}
      <aside ref={drawerRef} id="workspace-navigation" tabIndex={-1} inert={mobile && !open} role={mobile && open ? "dialog" : undefined} aria-modal={mobile && open ? true : undefined} aria-label="Workspace navigation" className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-logo">
          <Logo href={user ? "/apps" : "/"} />
          <button className="icon-btn mobile-only" aria-label="Close menu" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={active(n.href) ? "active" : ""}>
              {n.icon}
              {n.label}
              {n.tag && <span className="tiny-tag">{n.tag}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <nav className="side-nav">
            <Link href="/guide" className={active("/guide") ? "active" : ""}>
              <BookOpen size={19} />
              User guide
            </Link>
            {user && (
              <Link href="/settings" className={active("/settings") ? "active" : ""}>
                <Settings size={19} />
                Settings
              </Link>
            )}
          </nav>
          <div className="segmented full" role="group" aria-label="Color mode">
            <button aria-pressed={mode === "light"} onClick={() => setMode("light")} title="Light">
              <Sun size={14} />
            </button>
            <button aria-pressed={mode === "dark"} onClick={() => setMode("dark")} title="Dark">
              <Moon size={14} />
            </button>
            <button aria-pressed={mode === "system"} onClick={() => setMode("system")} title="Match my device">
              <Monitor size={14} />
            </button>
          </div>
          <div className="side-legal">
            <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/report">Report</Link>
          </div>
          {user ? (
            <div className="account-row">
              <Avatar user={user} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>
              <Dropdown
                trigger={
                  <button className="icon-btn sm" aria-label="Account menu">
                    <Settings size={16} />
                  </button>
                }
                placement="top-end"
                items={[
                  { label: "Settings", icon: <Settings size={15} />, onClick: () => (window.location.href = "/settings") },
                  "sep",
                  { label: "Sign out", icon: <LogOut size={15} />, onClick: () => void signOut(), danger: true },
                ]}
              />
            </div>
          ) : (
            <div className="account-row">
              <span className="avatar" style={{ background: "var(--accent-grad)" }}>
                <LogIn size={16} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong>Your workspace</strong>
                <small>Sign in to start building</small>
              </div>
              <Link className="btn primary sm" href={`/auth?next=${encodeURIComponent(pathname)}`}>
                Sign in
              </Link>
            </div>
          )}
        </div>
      </aside>
      <div className="main-column">
        <header className="mobile-header">
          <button className="icon-btn" aria-label="Open navigation" aria-expanded={open} aria-controls="workspace-navigation" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <Logo href={user ? "/apps" : "/"} />
        </header>
        <main id="main-content">{children}</main>
      </div>
    </div>
  );
}
