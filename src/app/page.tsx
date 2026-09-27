import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Database, Layers, MousePointerClick, Palette, Rocket, Smartphone, Sparkles, Users, Zap } from "lucide-react";
import { BRAND } from "@/lib/shared/brand";
import { currentUser } from "@/lib/server/auth";
import { LegalFooter } from "@/components/legal/LegalShell";
import { Logo } from "@/components/workspace/Logo";

const FEATURES = [
  { icon: <MousePointerClick size={22} />, color: "#6c47ff", title: "Drag-and-drop design", text: "Drop in text, buttons, images, shapes and forms. Smart guides snap everything into place." },
  { icon: <Palette size={22} />, color: "#ff5d99", title: "Canva-style styling", text: "Gradients, fonts, masks, shadows, hover effects and entrance animations — no CSS required." },
  { icon: <Layers size={22} />, color: "#0ea5e9", title: "Figma-grade control", text: "Layers, grouping, alignment, auto-layout rows and grids, precise sizes and undo history." },
  { icon: <Database size={22} />, color: "#10b981", title: "A real database, built in", text: "Create collections with typed fields and edit records in a friendly spreadsheet." },
  { icon: <Zap size={22} />, color: "#f59e0b", title: "Logic without code", text: "Buttons that save, update and delete records, show pop-ups, change pages and more." },
  { icon: <Smartphone size={22} />, color: "#8b5cf6", title: "Looks right on every screen", text: "Design for desktop and your phone layout arranges itself — then tweak it if you like." },
  { icon: <Users size={22} />, color: "#ef4444", title: "Sign-in and permissions", text: "Private pages, admin-only tools and data that each user can only see for themselves." },
  { icon: <Rocket size={22} />, color: "#14b8a6", title: "Publish in one click", text: "Share a live link, keep editing in draft, save versions and list your app in Explore." },
];

export default async function Landing() {
  const user = await currentUser();
  if (user) redirect("/apps");
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav>
          <Link className="link" href="/templates">
            Templates
          </Link>
          <Link className="link" href="/explore">
            Explore
          </Link>
          <Link className="link" href="/guide">
            Guide
          </Link>
          <Link className="btn ghost" href="/auth">
            Sign in
          </Link>
          <Link className="btn primary" href="/auth?mode=signup">
            Start free
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <span className="pill-note">
          <span className="new">New</span> Design + database in one place
        </span>
        <h1>
          Build real apps <span className="grad-text">by dragging things around.</span>
        </h1>
        <p>{BRAND.description} Perfect for sign-up pages, portfolios, stores, booking forms, trackers and community boards.</p>
        <div className="hero-actions">
          <Link className="btn gradient lg" href="/auth?mode=signup">
            Start building — it&apos;s free <ArrowRight size={18} />
          </Link>
          <Link className="btn lg" href="/templates">
            <Sparkles size={17} /> Browse templates
          </Link>
        </div>

        <div className="editor-mock" aria-hidden="true">
          <div className="mock-top">
            <span className="mock-dot" style={{ background: "#ff5f57" }} />
            <span className="mock-dot" style={{ background: "#febc2e" }} />
            <span className="mock-dot" style={{ background: "#28c840" }} />
            <span style={{ marginLeft: 12, fontWeight: 650, fontSize: 13, color: "var(--ink-2)" }}>Bakery orders · Home</span>
            <span style={{ marginLeft: "auto" }} className="badge success">
              ● Live
            </span>
          </div>
          <div className="mock-body">
            <div className="mock-side">
              {["Heading", "Button", "Image", "Form", "Repeating list", "Chart"].map((t) => (
                <div key={t} className="mock-tile">
                  <Sparkles size={14} /> {t}
                </div>
              ))}
            </div>
            <div className="mock-canvas">
              <div className="mock-frame">
                <div style={{ fontSize: 12, fontWeight: 700, color: "#ff5d99", letterSpacing: ".1em" }}>FRESH EVERY MORNING</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", marginTop: 6, position: "relative", display: "inline-block" }}>
                  Order your favourite bakes
                  <span className="mock-sel" style={{ inset: "-6px -8px" }} />
                </div>
                <div style={{ color: "#6b6880", marginTop: 8, fontSize: 14 }}>Pick, pay at pickup, enjoy. Saved straight to your database.</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 18 }}>
                  {["🥐 Croissant", "🍞 Sourdough", "🧁 Cupcake"].map((p) => (
                    <div key={p} style={{ borderRadius: 12, background: "#f5f3ff", padding: "14px 10px", fontSize: 13, fontWeight: 650 }}>
                      {p}
                      <div style={{ color: "#6c47ff", marginTop: 4 }}>$3.50</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, display: "inline-flex", background: "#6c47ff", color: "#fff", borderRadius: 10, padding: "10px 16px", fontWeight: 650, fontSize: 13 }}>Place order</div>
              </div>
            </div>
            <div className="mock-inspector">
              <div style={{ fontWeight: 700, fontSize: 12.5 }}>Design</div>
              <div className="mock-row">
                <span>Font</span>
                <strong>Poppins</strong>
              </div>
              <div className="mock-row">
                <span>Size</span>
                <strong>30</strong>
              </div>
              <div className="mock-row">
                <span>Fill</span>
                <strong style={{ color: "#6c47ff" }}>■ Primary</strong>
              </div>
              <div className="mock-row">
                <span>Animate</span>
                <strong>Slide up</strong>
              </div>
              <div style={{ fontWeight: 700, fontSize: 12.5, marginTop: 8 }}>Events</div>
              <div className="mock-row">
                <span>On click</span>
                <strong>Save to Orders</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <h2>Everything you need to launch an app</h2>
        <p className="lead">The visual freedom of a design tool and the power of a database — made friendly for people who have never written code.</p>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card">
              <div className="f-icon" style={{ background: f.color }}>
                {f.icon}
              </div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" style={{ paddingTop: 20 }}>
        <h2>From idea to live app in four steps</h2>
        <div className="steps">
          <div className="step">
            <h3>Pick a starting point</h3>
            <p>Start blank or choose a template like a store, portfolio, booking form or feedback board.</p>
          </div>
          <div className="step">
            <h3>Design it visually</h3>
            <p>Drag elements in, change colours and fonts, and arrange everything with smart guides.</p>
          </div>
          <div className="step">
            <h3>Connect your data</h3>
            <p>Create collections, hook forms up to them, and show records in lists, tables and charts.</p>
          </div>
          <div className="step">
            <h3>Publish and share</h3>
            <p>Preview on any device, then publish a live link. Keep improving it whenever you like.</p>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <h2>Your next big idea is one drag away.</h2>
        <p>Create a free account and build your first app in minutes.</p>
        <Link className="btn lg" href="/auth?mode=signup" style={{ background: "#fff", color: "#2a1760", border: "none" }}>
          Create my first app <ArrowRight size={18} />
        </Link>
      </section>

      <footer className="landing-footer">
        <Logo />
        <span>
          © {new Date().getFullYear()} {BRAND.name} · {BRAND.tagline}
        </span>
        <LegalFooter />
      </footer>
    </div>
  );
}
