import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Database, Layers, MousePointerClick, Palette, Rocket, Smartphone, Users, Zap } from "lucide-react";
import { BRAND } from "@/lib/shared/brand";
import { currentUser } from "@/lib/server/auth";
import { LegalFooter } from "@/components/legal/LegalShell";
import { Logo } from "@/components/workspace/Logo";
import { StackDemo } from "@/components/landing/StackDemo";

const FEATURES = [
  { icon: MousePointerClick, title: "Drag-and-drop design", text: "Drop in text, buttons, images, shapes and forms. Smart guides snap everything into place." },
  { icon: Palette, title: "Canva-style styling", text: "Gradients, fonts, masks, shadows, hover effects and entrance animations — no CSS required." },
  { icon: Layers, title: "Figma-grade control", text: "Layers, grouping, alignment, auto-layout rows and grids, precise sizes and undo history." },
  { icon: Database, title: "A real database, built in", text: "Create collections with typed fields and edit records in a friendly spreadsheet." },
  { icon: Zap, title: "Logic without code", text: "Buttons that save, update and delete records, show pop-ups, change pages and more." },
  { icon: Smartphone, title: "Looks right on every screen", text: "Design for desktop and your phone layout arranges itself — then tweak it if you like." },
  { icon: Users, title: "Sign-in and permissions", text: "Private pages, admin-only tools and data that each user can only see for themselves." },
  { icon: Rocket, title: "Publish in one click", text: "Share a live link, keep editing in draft, save versions and list your app in Explore." },
];

const STEPS = [
  { title: "Pick a starting point", text: "Start blank or choose a template like a store, portfolio, booking form or feedback board." },
  { title: "Design it visually", text: "Drag elements in, change colours and fonts, and arrange everything with smart guides." },
  { title: "Connect your data", text: "Create collections, hook forms up to them, and show records in lists, tables and charts." },
  { title: "Publish and share", text: "Preview on any device, then publish a live link. Keep improving it whenever you like." },
];

export default async function Landing() {
  const user = await currentUser();
  if (user) redirect("/apps");
  return (
    <div className="landing">
      <header className="menubar">
        <Logo />
        <nav className="menubar-items" aria-label="Main">
          <Link href="/templates">Templates</Link>
          <Link href="/explore">Explore</Link>
          <Link href="/guide">Guide</Link>
        </nav>
        <div className="menubar-actions">
          <Link className="btn ghost sm" href="/auth">
            Sign in
          </Link>
          <Link className="btn primary sm" href="/auth?mode=signup">
            Start free
          </Link>
        </div>
      </header>

      <main className="desk">
        <section className="window welcome" aria-labelledby="welcome-title">
          <div className="window-bar">
            <span>Welcome</span>
          </div>
          <div className="welcome-body">
            <div className="welcome-copy">
              <h1 id="welcome-title">Build real apps by dragging things around.</h1>
              <p>{BRAND.description} Perfect for sign-up pages, portfolios, stores, booking forms, trackers and community boards.</p>
              <div className="welcome-actions">
                <Link className="btn primary lg" href="/auth?mode=signup">
                  Start building — it&apos;s free <ArrowRight size={18} />
                </Link>
                <Link className="btn lg" href="/templates">
                  Browse templates
                </Link>
              </div>
              <p className="welcome-tagline">{BRAND.tagline}</p>
            </div>
            <StackDemo />
          </div>
        </section>

        <section className="window" aria-labelledby="features-title">
          <div className="window-bar">
            <h2 id="features-title">Everything you need to launch an app</h2>
          </div>
          <p className="window-lead">The visual freedom of a design tool and the power of a database — made friendly for people who have never written code.</p>
          <ul className="feature-index">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <f.icon size={22} strokeWidth={2} aria-hidden="true" />
                <div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="window" aria-labelledby="steps-title">
          <div className="window-bar">
            <h2 id="steps-title">From idea to live app in four steps</h2>
          </div>
          <ol className="step-strip">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="step-no num" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="alert-box" aria-labelledby="cta-title">
          <div className="alert-box-inner">
            <h2 id="cta-title">Your next big idea is one drag away.</h2>
            <p>Create a free account and build your first app in minutes.</p>
            <Link className="btn primary lg default-ring" href="/auth?mode=signup">
              Create my first app <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>

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
