/*
 * Ready-made page sections ("blocks"), 1280px wide. Inserted at the bottom of the page.
 */
import type { ElementSpec } from "./shared/elements";
import { box, button, grad, icon, image, input, shape, solid, stack, text, fill, line } from "./build";

export interface BlockDef {
  id: string;
  name: string;
  category: "Headers" | "Content" | "Social proof" | "Sales" | "Forms" | "Footers";
  height: number;
  spec: () => ElementSpec;
}

const W = 1280;
const section = (name: string, h: number, style: ElementSpec["style"], children: ElementSpec[]): ElementSpec => ({
  ...box([0, 0, W, h], { overflow: "hidden", ...style }, children),
  name,
});

const initials = (letters: string, x: number, y: number, size: number, color: string): ElementSpec =>
  box([x, y, size, size], { fill: solid(color), radius: 999 }, [text(letters, [0, size / 2 - size * 0.22, size, size * 0.44], { color: "#ffffff", fontWeight: 700, fontSize: size * 0.36, textAlign: "center", lineHeight: 1.2 }, "p")], {}, { name: "Avatar" });

const featureCard = (ic: string, title: string, body: string): ElementSpec =>
  fill({
    ...stack(
      "column",
      [0, 0, 340, 230],
      [
        box([0, 0, 52, 52], { fill: solid("$primary/12"), radius: 14 }, [icon(ic, [12, 12, 28], { color: "$primary" })], {}, { sizing: { w: "fixed", h: "fixed" } }),
        fill(text(title, [0, 0, 280], { fontSize: 22, fontWeight: 700 }, "h3")),
        fill(text(body, [0, 0, 280], { color: "$muted", fontSize: 16 }, "p")),
      ],
      { gap: 14, padding: 28, align: "start" },
      { fill: solid("$background"), radius: 20, borderWidth: 1, borderColor: "$border" },
    ),
    sizing: { w: "fill", h: "hug" },
  });

export const BLOCKS: BlockDef[] = [
  {
    id: "navbar",
    name: "Navigation bar",
    category: "Headers",
    height: 84,
    spec: () =>
      section("Navbar", 84, { fill: solid("$background") }, [
        icon("Sparkles", [48, 26, 32], { color: "$primary" }),
        text("Brandname", [88, 25, 240, 34], { fontSize: 24, fontWeight: 800, fontFamily: "$heading" }, "h3"),
        { type: "menu", box: { x: 520, y: 20, w: 520, h: 44 }, style: { textAlign: "right" }, props: { items: [], orientation: "horizontal", variant: "links" } },
        button("Get started", [1080, 18, 152, 48]),
      ]),
  },
  {
    id: "hero-center",
    name: "Hero · centred",
    category: "Headers",
    height: 600,
    spec: () =>
      section("Hero", 600, { fill: grad(170, "$surface", "$background") }, [
        shape("blob", [-90, 340, 340, 320], { fill: solid("$secondary"), opacity: 0.18 }),
        shape("ellipse", [1060, 40, 260, 260], { fill: solid("$accent"), opacity: 0.25 }),
        text("✨  New — just launched", [505, 110, 270, 34], { fill: solid("$primary/12"), color: "$primary", radius: 999, fontSize: 14, fontWeight: 700, textAlign: "center", verticalAlign: "middle" }, "small", { sizing: { w: "fixed", h: "fixed" } }),
        text("Build something people love", [190, 166, 900, 150], { fontSize: 66, fontWeight: 800, textAlign: "center", letterSpacing: -1.5 }, "h1"),
        text("A short sentence that explains what you do and why it matters. Keep it friendly and clear.", [290, 330, 700, 64], { fontSize: 20, color: "$muted", textAlign: "center" }, "p"),
        button("Get started", [456, 436, 176, 56], {}, { icon: "ArrowRight", iconPos: "right" }),
        button("See how it works", [648, 436, 196, 56], { fill: { type: "none" }, borderWidth: 2, borderColor: "$border", color: "$text" }),
      ]),
  },
  {
    id: "hero-split",
    name: "Hero · with image",
    category: "Headers",
    height: 620,
    spec: () =>
      section("HeroSplit", 620, { fill: solid("$background") }, [
        text("FOR BUSY PEOPLE", [80, 150, 320, 22], { fontSize: 14, fontWeight: 800, letterSpacing: 3, color: "$primary" }, "small"),
        text("Your ideas, brought to life", [80, 184, 540, 136], { fontSize: 58, fontWeight: 800, letterSpacing: -1 }, "h1"),
        text("Tell visitors what you offer in one or two sentences. Then give them one clear thing to do next.", [80, 340, 480, 84], { fontSize: 19, color: "$muted" }, "p"),
        button("Start free", [80, 456, 160, 54]),
        button("Learn more", [256, 456, 170, 54], { fill: { type: "none" }, color: "$primary" }, { icon: "ArrowRight", iconPos: "right" }),
        image("https://picsum.photos/seed/cb-hero/1000/960", [680, 70, 520, 480], {}, { radius: 32 }),
        box([612, 440, 260, 86], { fill: solid("$background"), radius: 18, shadow: { x: 0, y: 18, blur: 40, spread: -12, color: "rgba(20,16,40,0.28)" } }, [
          box([16, 18, 50, 50], { fill: solid("$accent"), radius: 14 }, [icon("Star", [13, 13, 24], { color: "#ffffff" })]),
          text("4.9 out of 5", [80, 18, 170, 24], { fontWeight: 800, fontSize: 17 }, "p"),
          text("from 2,000+ reviews", [80, 44, 170, 20], { color: "$muted", fontSize: 13 }, "small"),
        ]),
      ]),
  },
  {
    id: "features",
    name: "Features · 3 columns",
    category: "Content",
    height: 560,
    spec: () =>
      section("Features", 560, { fill: solid("$surface") }, [
        text("WHY PEOPLE LOVE IT", [390, 80, 500, 22], { fontSize: 14, fontWeight: 800, letterSpacing: 3, color: "$primary", textAlign: "center" }, "small"),
        text("Everything you need, nothing you don't", [240, 110, 800, 50], { fontSize: 40, fontWeight: 800, textAlign: "center" }, "h2"),
        text("Three short reasons someone should pick you. Swap the icons and words to match your idea.", [340, 170, 600, 56], { color: "$muted", fontSize: 18, textAlign: "center" }, "p"),
        stack("grid", [80, 262, 1120, 250], [featureCard("Zap", "Fast to start", "Get going in minutes with a setup that just makes sense."), featureCard("ShieldCheck", "Safe & private", "Your information stays yours — protected and backed up."), featureCard("Heart", "Made with care", "Thoughtful details that make every day a little easier.")], { columns: 3, mobileColumns: 1, gap: 24, align: "stretch" }),
      ]),
  },
  {
    id: "stats",
    name: "Stats band",
    category: "Social proof",
    height: 240,
    spec: () =>
      section("Stats", 240, { fill: solid("$primary") }, [
        stack(
          "grid",
          [80, 56, 1120, 128],
          [
            ["10k+", "happy customers"],
            ["98%", "would recommend us"],
            ["24/7", "friendly support"],
            ["4.9★", "average rating"],
          ].map(([n, l]) =>
            fill(
              stack(
                "column",
                [0, 0, 260, 120],
                [fill(text(n, [0, 0, 260], { fontSize: 52, fontWeight: 800, color: "#ffffff", textAlign: "center", fontFamily: "$heading" }, "h2")), fill(text(l, [0, 0, 260], { color: "rgba(255,255,255,0.8)", textAlign: "center" }, "p"))],
                { gap: 4, align: "stretch" },
              ),
            ),
          ),
          { columns: 4, mobileColumns: 2, gap: 20, align: "center" },
        ),
      ]),
  },
  {
    id: "testimonials",
    name: "Testimonials",
    category: "Social proof",
    height: 520,
    spec: () =>
      section("Testimonials", 520, { fill: solid("$background") }, [
        text("Loved by people like you", [240, 80, 800, 50], { fontSize: 40, fontWeight: 800, textAlign: "center" }, "h2"),
        stack(
          "grid",
          [80, 180, 1120, 280],
          [
            ["“It took me one afternoon to launch. My customers noticed right away.”", "Maya R.", "Bakery owner", "MR", "$primary"],
            ["“Finally something that doesn't need a developer. I changed everything myself.”", "Daniel K.", "Coach", "DK", "$secondary"],
            ["“The forms go straight into my database. It saves me hours every week.”", "Aisha B.", "Event planner", "AB", "$accent"],
          ].map(([quote, name, role, ini, color]) =>
            fill(
              stack(
                "column",
                [0, 0, 340, 260],
                [
                  fill(text("★★★★★", [0, 0, 300], { color: "$accent", fontSize: 18, letterSpacing: 2 }, "p")),
                  fill(text(quote, [0, 0, 300], { fontSize: 18, lineHeight: 1.5 }, "p")),
                  stack(
                    "row",
                    [0, 0, 300, 52],
                    [
                      { ...initials(ini, 0, 0, 44, color), sizing: { w: "fixed", h: "fixed" } },
                      stack("column", [0, 0, 200, 44], [fill(text(name, [0, 0, 200], { fontWeight: 700, fontSize: 15 }, "p")), fill(text(role, [0, 0, 200], { color: "$muted", fontSize: 13 }, "small"))], { gap: 0, align: "stretch" }, {}, { sizing: { w: "fill", h: "hug" } }),
                    ],
                    { gap: 12, align: "center" },
                    {},
                    { sizing: { w: "fill", h: "hug" } },
                  ),
                ],
                { gap: 16, padding: 28, align: "stretch" },
                { fill: solid("$surface"), radius: 20 },
              ),
            ),
          ),
          { columns: 3, mobileColumns: 1, gap: 24, align: "stretch" },
        ),
      ]),
  },
  {
    id: "pricing",
    name: "Pricing plans",
    category: "Sales",
    height: 720,
    spec: () => {
      const plan = (name: string, price: string, blurb: string, features: string[], hot: boolean): ElementSpec =>
        fill(
          stack(
            "column",
            [0, 0, 340, 520],
            [
              ...(hot ? [text("MOST POPULAR", [0, 0, 140, 26], { fill: solid("rgba(255,255,255,0.2)"), color: "#ffffff", radius: 999, fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textAlign: "center", verticalAlign: "middle" }, "small", { sizing: { w: "fixed", h: "fixed" } })] : []),
              fill(text(name, [0, 0, 280], { fontSize: 20, fontWeight: 700, color: hot ? "#ffffff" : "$text" }, "h3")),
              fill(text(price, [0, 0, 280], { fontSize: 48, fontWeight: 800, color: hot ? "#ffffff" : "$text", fontFamily: "$heading" }, "h2")),
              fill(text(blurb, [0, 0, 280], { color: hot ? "rgba(255,255,255,0.8)" : "$muted", fontSize: 15 }, "p")),
              fill(line([0, 0, 280, 12], { color: hot ? "rgba(255,255,255,0.3)" : "$border" })),
              ...features.map((f) => fill(text(`✓  ${f}`, [0, 0, 280], { fontSize: 15, color: hot ? "#ffffff" : "$text" }, "p"))),
              fill(button(hot ? "Start free trial" : "Choose plan", [0, 0, 280, 50], hot ? { fill: solid("#ffffff"), color: "$primary" } : {})),
            ],
            { gap: 14, padding: 32, align: "start" },
            hot ? { fill: grad(160, "$primary", "$secondary"), radius: 24, shadow: { x: 0, y: 24, blur: 50, spread: -16, color: "rgba(20,16,40,0.35)" } } : { fill: solid("$background"), radius: 24, borderWidth: 1, borderColor: "$border" },
          ),
        );
      return section("Pricing", 720, { fill: solid("$surface") }, [
        text("Simple, honest pricing", [240, 80, 800, 50], { fontSize: 40, fontWeight: 800, textAlign: "center" }, "h2"),
        text("Start free. Upgrade when you're ready. Cancel anytime.", [340, 140, 600, 30], { color: "$muted", fontSize: 18, textAlign: "center" }, "p"),
        stack(
          "grid",
          [80, 210, 1120, 470],
          [plan("Starter", "Free", "For trying things out.", ["1 project", "Basic support", "Community access"], false), plan("Pro", "$19/mo", "For growing businesses.", ["Unlimited projects", "Priority support", "Custom domain"], true), plan("Team", "$49/mo", "For teams that collaborate.", ["Everything in Pro", "5 team seats", "Admin controls"], false)],
          { columns: 3, mobileColumns: 1, gap: 24, align: "stretch" },
        ),
      ]);
    },
  },
  {
    id: "cta",
    name: "Call to action",
    category: "Sales",
    height: 320,
    spec: () =>
      section("CallToAction", 320, { fill: grad(135, "$primary", "$secondary") }, [
        shape("ellipse", [-60, -80, 260, 260], { fill: solid("#ffffff"), opacity: 0.08 }),
        shape("ellipse", [1100, 180, 240, 240], { fill: solid("#ffffff"), opacity: 0.08 }),
        text("Ready to get started?", [240, 76, 800, 56], { fontSize: 44, fontWeight: 800, color: "#ffffff", textAlign: "center" }, "h2"),
        text("Join thousands of happy people today. It only takes a minute.", [340, 142, 600, 30], { fontSize: 18, color: "rgba(255,255,255,0.85)", textAlign: "center" }, "p"),
        button("Create my account", [540, 200, 200, 56], { fill: solid("#ffffff"), color: "$primary" }),
      ]),
  },
  {
    id: "contact",
    name: "Contact form",
    category: "Forms",
    height: 640,
    spec: () =>
      section("Contact", 640, { fill: solid("$background") }, [
        text("Get in touch", [80, 110, 460, 54], { fontSize: 44, fontWeight: 800 }, "h2"),
        text("Questions, ideas or just want to say hi? Send a message and we'll reply within a day.", [80, 180, 440, 60], { color: "$muted", fontSize: 18 }, "p"),
        icon("Mail", [80, 290, 24], { color: "$primary" }),
        text("hello@example.com", [118, 290, 300, 26], { fontSize: 16 }, "p"),
        icon("Phone", [80, 336, 24], { color: "$primary" }),
        text("+1 (555) 010-2030", [118, 336, 300, 26], { fontSize: 16 }, "p"),
        icon("MapPin", [80, 382, 24], { color: "$primary" }),
        text("12 Market Street, Springfield", [118, 382, 340, 26], { fontSize: 16 }, "p"),
        {
          type: "form",
          name: "ContactForm",
          box: { x: 640, y: 80, w: 560, h: 480 },
          sizing: { w: "fixed", h: "hug" },
          style: { fill: solid("$surface"), radius: 24 },
          props: { layout: { mode: "column", gap: 14, padding: 32, align: "stretch", justify: "start", wrap: false, columns: 1 }, successMessage: "Thanks! We'll be in touch soon." },
          children: [
            fill(input("text", "Your name", "Name", [0, 0, 496], { placeholder: "Jane Doe", required: true })),
            fill(input("email", "Email", "Email", [0, 0, 496], { placeholder: "jane@example.com", required: true })),
            fill(input("textarea", "Message", "Message", [0, 0, 496, 150], { placeholder: "How can we help?" })),
            fill(button("Send message", [0, 0, 496, 52], {}, { submit: true, icon: "Send", iconPos: "right" })),
          ],
        },
      ]),
  },
  {
    id: "faq",
    name: "Questions & answers",
    category: "Content",
    height: 660,
    spec: () =>
      section("FAQ", 660, { fill: solid("$background") }, [
        text("Frequently asked questions", [240, 80, 800, 50], { fontSize: 40, fontWeight: 800, textAlign: "center" }, "h2"),
        stack(
          "column",
          [240, 170, 800, 440],
          [
            ["How do I get started?", "Create a free account, pick a template, and you're ready to go."],
            ["Can I change things later?", "Absolutely. Everything can be edited any time, and old versions are saved."],
            ["Is my information safe?", "Yes. Your data is private by default and only shared if you choose to."],
            ["Do you offer support?", "Our friendly team replies to every message, usually within a day."],
          ].map(([q, a]) =>
            fill(
              stack(
                "column",
                [0, 0, 800, 90],
                [fill(text(q, [0, 0, 740], { fontSize: 19, fontWeight: 700 }, "h3")), fill(text(a, [0, 0, 740], { color: "$muted", fontSize: 16 }, "p"))],
                { gap: 6, padding: 22, align: "stretch" },
                { fill: solid("$surface"), radius: 16 },
              ),
            ),
          ),
          { gap: 12, align: "stretch" },
        ),
      ]),
  },
  {
    id: "team",
    name: "Meet the team",
    category: "Content",
    height: 480,
    spec: () =>
      section("Team", 480, { fill: solid("$surface") }, [
        text("Meet the team", [240, 80, 800, 50], { fontSize: 40, fontWeight: 800, textAlign: "center" }, "h2"),
        stack(
          "grid",
          [80, 180, 1120, 240],
          [
            ["Ana Lopez", "Founder", "AL", "$primary"],
            ["Sam Chen", "Design", "SC", "$secondary"],
            ["Priya Nair", "Engineering", "PN", "$accent"],
            ["Leo Martin", "Customer happiness", "LM", "$primary"],
          ].map(([name, role, ini, color]) =>
            fill(
              stack(
                "column",
                [0, 0, 260, 220],
                [{ ...initials(ini, 0, 0, 112, color), sizing: { w: "fixed", h: "fixed" } }, fill(text(name, [0, 0, 240], { fontSize: 19, fontWeight: 700, textAlign: "center" }, "h3")), fill(text(role, [0, 0, 240], { color: "$muted", textAlign: "center" }, "p"))],
                { gap: 10, align: "center", padding: 10 },
              ),
            ),
          ),
          { columns: 4, mobileColumns: 2, gap: 20, align: "start" },
        ),
      ]),
  },
  {
    id: "gallery",
    name: "Photo gallery",
    category: "Content",
    height: 660,
    spec: () =>
      section("Gallery", 660, { fill: solid("$background") }, [
        text("A look inside", [240, 70, 800, 50], { fontSize: 40, fontWeight: 800, textAlign: "center" }, "h2"),
        stack(
          "grid",
          [80, 160, 1120, 460],
          [11, 16, 28, 29, 42, 48].map((id) => ({ ...image(`https://picsum.photos/id/${id}/800/600`, [0, 0, 360, 220], {}, { radius: 16 }), sizing: { w: "fill" as const, h: "fixed" as const } })),
          { columns: 3, mobileColumns: 1, gap: 20, align: "stretch" },
        ),
      ]),
  },
  {
    id: "newsletter",
    name: "Newsletter sign-up",
    category: "Forms",
    height: 320,
    spec: () =>
      section("Newsletter", 320, { fill: solid("$surface") }, [
        text("Get the good stuff, monthly", [240, 70, 800, 48], { fontSize: 36, fontWeight: 800, textAlign: "center" }, "h2"),
        text("One short email a month. No spam, unsubscribe any time.", [340, 128, 600, 28], { color: "$muted", fontSize: 17, textAlign: "center" }, "p"),
        {
          type: "form",
          name: "SignupForm",
          box: { x: 360, y: 184, w: 560, h: 64 },
          props: { layout: { mode: "row", gap: 10, padding: 0, align: "center", justify: "start", wrap: false, columns: 1 }, successMessage: "You're on the list! 🎉" },
          children: [
            { ...input("email", "Email", "Email", [0, 0, 380, 54], { placeholder: "you@example.com", showLabel: false, required: true }), sizing: { w: "fill", h: "hug" } },
            button("Subscribe", [0, 0, 160, 54], {}, { submit: true }),
          ],
        },
      ]),
  },
  {
    id: "logos",
    name: "Trusted by",
    category: "Social proof",
    height: 190,
    spec: () =>
      section("Logos", 190, { fill: solid("$background") }, [
        text("TRUSTED BY TEAMS AT", [390, 44, 500, 22], { fontSize: 13, fontWeight: 800, letterSpacing: 3, color: "$muted", textAlign: "center" }, "small"),
        stack(
          "row",
          [80, 90, 1120, 60],
          ["Northwind", "Globex", "Initech", "Umbrella", "Hooli"].map((n) => text(n, [0, 0, 180, 40], { fontSize: 28, fontWeight: 800, color: "$muted", opacity: 0.7, textAlign: "center", fontFamily: "Poppins" }, "p", { sizing: { w: "fixed", h: "hug" } })),
          { gap: 24, justify: "between", align: "center", wrap: true },
        ),
      ]),
  },
  {
    id: "footer",
    name: "Footer",
    category: "Footers",
    height: 280,
    spec: () =>
      section("Footer", 280, { fill: solid("$text") }, [
        icon("Sparkles", [80, 60, 30], { color: "$background" }),
        text("Brandname", [118, 58, 240, 34], { fontSize: 24, fontWeight: 800, color: "$background" }, "h3"),
        text("Making good ideas easy to share.", [80, 104, 320, 26], { color: "$background", opacity: 0.7 }, "p"),
        { type: "menu", box: { x: 560, y: 56, w: 200, h: 140 }, style: { color: "$background" }, props: { items: [], orientation: "vertical", variant: "links" } },
        text("Follow along", [900, 60, 200, 26], { color: "$background", fontWeight: 700 }, "p"),
        icon("Instagram", [900, 100, 26], { color: "$background" }, { props: { icon: "Instagram", link: { url: "https://instagram.com", newTab: true } } }),
        icon("XTwitter", [944, 100, 26], { color: "$background" }, { props: { icon: "XTwitter", link: { url: "https://x.com", newTab: true } } }),
        icon("Linkedin", [988, 100, 26], { color: "$background" }, { props: { icon: "Linkedin", link: { url: "https://linkedin.com", newTab: true } } }),
        icon("Youtube", [1032, 100, 26], { color: "$background" }, { props: { icon: "Youtube", link: { url: "https://youtube.com", newTab: true } } }),
        line([80, 206, 1120, 12], { color: "$background", opacity: 0.2 }),
        text("© 2026 Brandname. All rights reserved.", [80, 230, 500, 22], { color: "$background", opacity: 0.6, fontSize: 14 }, "small"),
      ]),
  },
];

export const BLOCK_CATEGORIES = Array.from(new Set(BLOCKS.map((b) => b.category)));
