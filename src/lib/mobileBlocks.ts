/*
 * Ready-made pieces for phone apps, 390px wide (one phone screen).
 */
import type { ElementSpec } from "./shared/elements";
import type { BlockDef } from "./blocks";
import { box, button, fill, grad, icon, image, input, solid, stack, text } from "./build";

export interface MobileBlockDef extends Omit<BlockDef, "category"> {
  category: "Bars" | "Headers" | "Content" | "Lists" | "Forms" | "Profile";
}

const W = 390;
const PAD = 20;
const IW = W - PAD * 2;

const section = (name: string, h: number, style: ElementSpec["style"], children: ElementSpec[], extra: Partial<ElementSpec> = {}): ElementSpec => ({
  ...box([0, 0, W, h], { overflow: "hidden", ...style }, children),
  name,
  ...extra,
});

const avatar = (letters: string, x: number, y: number, size: number, color: string): ElementSpec =>
  box([x, y, size, size], { fill: solid(color), radius: 999 }, [text(letters, [0, size / 2 - size * 0.22, size, size * 0.44], { color: "#ffffff", fontWeight: 700, fontSize: size * 0.36, textAlign: "center", lineHeight: 1.2 }, "p")], {}, { name: "Avatar" });

/** A tappable row: icon tile, title + subtitle, chevron. */
const row = (ic: string, title: string, sub: string, y: number, tone = "$primary"): ElementSpec =>
  box([PAD, y, IW, 68], { fill: solid("$background"), radius: 16, borderWidth: 1, borderColor: "$border" }, [
    box([12, 12, 44, 44], { fill: solid(`${tone}/12`), radius: 12 }, [icon(ic, [11, 11, 22], { color: tone })]),
    text(title, [68, 13, 240, 22], { fontSize: 16, fontWeight: 700 }, "p"),
    text(sub, [68, 36, 240, 20], { fontSize: 13, color: "$muted" }, "small"),
    icon("ChevronRight", [IW - 34, 23, 20], { color: "$muted" }),
  ]);

const settingRow = (ic: string, label: string, y: number): ElementSpec =>
  box([0, y, IW, 52], {}, [icon(ic, [16, 15, 22], { color: "$primary" }), text(label, [52, 15, 220, 22], { fontSize: 16 }, "p"), icon("ChevronRight", [IW - 36, 16, 20], { color: "$muted" })]);

export const MOBILE_BLOCKS: MobileBlockDef[] = [
  {
    id: "m-header",
    name: "App header",
    category: "Bars",
    height: 64,
    spec: () =>
      section("Header", 64, { fill: solid("$background"), borderWidth: 0, shadow: { x: 0, y: 1, blur: 0, spread: 0, color: "rgba(0,0,0,0.08)" } }, [
        text("My app", [PAD, 17, 220, 30], { fontSize: 22, fontWeight: 800, fontFamily: "$heading" }, "h2"),
        icon("Bell", [W - PAD - 26, 19, 26], { color: "$text" }),
      ], { pin: "top" }),
  },
  {
    id: "m-tabbar",
    name: "Tab bar",
    category: "Bars",
    height: 68,
    spec: () =>
      section("TabBar", 68, { fill: solid("$background"), shadow: { x: 0, y: -1, blur: 0, spread: 0, color: "rgba(0,0,0,0.08)" } }, [
        { type: "menu", name: "Tabs", box: { x: 0, y: 4, w: W, h: 60 }, style: { fontSize: 15 }, props: { items: [], orientation: "horizontal", variant: "tabbar" } },
      ], { pin: "bottom" }),
  },
  {
    id: "m-back",
    name: "Back bar",
    category: "Bars",
    height: 56,
    spec: () =>
      section("BackBar", 56, { fill: solid("$background") }, [
        button("Back", [8, 8, 96, 40], { fill: { type: "none" }, color: "$primary", fontSize: 16 }, { icon: "ChevronLeft", iconPos: "left" }, { click: [{ type: "goBack" }] }),
        text("Details", [110, 15, 170, 26], { fontSize: 17, fontWeight: 700, textAlign: "center" }, "h3"),
      ], { pin: "top" }),
  },
  {
    id: "m-welcome",
    name: "Welcome card",
    category: "Headers",
    height: 212,
    spec: () =>
      section("Welcome", 212, { fill: solid("$background") }, [
        box([PAD, 16, IW, 180], { fill: grad(135, "$primary", "$secondary"), radius: 24 }, [
          text("Good morning 👋", [22, 24, 290, 22], { fontSize: 15, color: "rgba(255,255,255,0.85)" }, "p"),
          text("Ready for today?", [22, 50, 290, 36], { fontSize: 27, fontWeight: 800, color: "#ffffff" }, "h1"),
          button("Get started", [22, 108, 150, 46], { fill: solid("#ffffff"), color: "$primary", fontSize: 15 }, { icon: "ArrowRight", iconPos: "right" }),
        ]),
      ]),
  },
  {
    id: "m-hero-image",
    name: "Photo header",
    category: "Headers",
    height: 300,
    spec: () =>
      section("PhotoHeader", 300, { fill: solid("$background") }, [
        image("https://picsum.photos/id/1080/800/600", [0, 0, W, 300], {}, { radius: 0 }),
        box([0, 150, W, 150], { fill: grad(180, "rgba(0,0,0,0)", "rgba(0,0,0,0.65)") }, []),
        text("Discover something new", [PAD, 206, IW, 34], { fontSize: 26, fontWeight: 800, color: "#ffffff" }, "h1"),
        text("Hand-picked for you every day", [PAD, 246, IW, 22], { fontSize: 15, color: "rgba(255,255,255,0.85)" }, "p"),
      ]),
  },
  {
    id: "m-stats",
    name: "Stats row",
    category: "Content",
    height: 112,
    spec: () =>
      section("Stats", 112, { fill: solid("$background") }, [
        stack(
          "grid",
          [PAD, 12, IW, 88],
          [
            ["12", "Done"],
            ["3", "Today"],
            ["87%", "Streak"],
          ].map(([n, l]) =>
            fill(
              stack("column", [0, 0, 110, 88], [fill(text(n, [0, 0, 100], { fontSize: 26, fontWeight: 800, textAlign: "center", color: "$primary" }, "h2")), fill(text(l, [0, 0, 100], { fontSize: 13, color: "$muted", textAlign: "center" }, "small"))], { gap: 2, padding: 12, align: "stretch", justify: "center" }, { fill: solid("$surface"), radius: 16 }),
            ),
          ),
          { columns: 3, mobileColumns: 3, gap: 10, align: "stretch" },
        ),
      ]),
  },
  {
    id: "m-section-title",
    name: "Section title",
    category: "Content",
    height: 52,
    spec: () =>
      section("SectionTitle", 52, {}, [
        text("Popular", [PAD, 16, 220, 28], { fontSize: 20, fontWeight: 800 }, "h2"),
        text("See all", [W - PAD - 80, 20, 80, 22], { fontSize: 14, fontWeight: 600, color: "$primary", textAlign: "right" }, "p"),
      ]),
  },
  {
    id: "m-cards",
    name: "Image cards",
    category: "Content",
    height: 236,
    spec: () =>
      section("Cards", 236, {}, [
        stack(
          "row",
          [PAD, 8, IW, 220],
          [
            ["Morning run", 1015],
            ["Fresh bowl", 1080],
          ].map(([t, id]) =>
            fill(
              stack("column", [0, 0, 170, 220], [{ ...image(`https://picsum.photos/id/${id}/400/300`, [0, 0, 170, 150], {}, { radius: 16 }), sizing: { w: "fill" as const, h: "fixed" as const } }, fill(text(String(t), [0, 0, 160], { fontSize: 16, fontWeight: 700 }, "p")), fill(text("12 min · Easy", [0, 0, 160], { fontSize: 13, color: "$muted" }, "small"))], { gap: 6, align: "stretch" }),
            ),
          ),
          { gap: 12, align: "start" },
        ),
      ]),
  },
  {
    id: "m-rows",
    name: "Menu rows",
    category: "Lists",
    height: 252,
    spec: () =>
      section("Rows", 252, {}, [row("CalendarDays", "Schedule", "See what's coming up", 8), row("MessageCircle", "Messages", "2 new messages", 88, "$secondary"), row("Star", "Favourites", "Things you saved", 168, "$accent")]),
  },
  {
    id: "m-list",
    name: "Data list",
    category: "Lists",
    height: 330,
    spec: () =>
      section("ListSection", 330, {}, [
        {
          type: "list",
          name: "List",
          box: { x: PAD, y: 8, w: IW, h: 312 },
          props: {
            emptyText: "Nothing here yet. Pick a collection in the Data tab.",
            layout: { mode: "column", gap: 10, padding: 0, align: "stretch", justify: "start", wrap: false, columns: 1, mobileColumns: 1 },
            query: { pageSize: 20, sortField: "createdAt", sortDir: "desc", search: false, filters: [] },
          },
          children: [
            box([0, 0, IW, 72], { fill: solid("$surface"), radius: 16 }, [
              box([14, 14, 44, 44], { fill: solid("$primary/12"), radius: 12 }, [icon("Sparkles", [11, 11, 22], { color: "$primary" })]),
              text("{{record.id}}", [70, 14, 250, 22], { fontSize: 16, fontWeight: 700 }, "p"),
              text("Added {{record.createdAt | date}}", [70, 38, 250, 20], { fontSize: 13, color: "$muted" }, "small"),
            ], {}, { name: "ItemRow" }),
          ],
        },
      ]),
  },
  {
    id: "m-quick-add",
    name: "Quick add form",
    category: "Forms",
    height: 250,
    spec: () =>
      section("QuickAdd", 250, {}, [
        {
          type: "form",
          name: "QuickAddForm",
          box: { x: PAD, y: 8, w: IW, h: 230 },
          style: { fill: solid("$surface"), radius: 20 },
          props: { layout: { mode: "column", gap: 12, padding: 18, align: "stretch", justify: "start", wrap: false, columns: 1 }, successMessage: "Added!" },
          children: [
            fill(text("Add something new", [0, 0, 300], { fontSize: 18, fontWeight: 800 }, "h3")),
            fill(input("text", "Title", "Title", [0, 0, 314], { placeholder: "What is it?" })),
            fill(button("Add", [0, 0, 314, 50], {}, { icon: "Plus", submit: true })),
          ],
        },
      ]),
  },
  {
    id: "m-signup",
    name: "Sign-up card",
    category: "Forms",
    height: 330,
    spec: () =>
      section("SignUp", 330, {}, [
        {
          type: "form",
          name: "SignUpForm",
          box: { x: PAD, y: 8, w: IW, h: 312 },
          style: { fill: solid("$surface"), radius: 20 },
          props: { layout: { mode: "column", gap: 12, padding: 18, align: "stretch", justify: "start", wrap: false, columns: 1 }, successMessage: "Thanks! You're on the list." },
          children: [
            fill(text("Join us", [0, 0, 300], { fontSize: 22, fontWeight: 800 }, "h2")),
            fill(input("text", "Your name", "Name", [0, 0, 314], { placeholder: "Alex" })),
            fill(input("email", "Email", "Email", [0, 0, 314], { placeholder: "you@example.com", required: true })),
            fill(button("Sign me up", [0, 0, 314, 50], {}, { submit: true })),
          ],
        },
      ]),
  },
  {
    id: "m-profile",
    name: "Profile header",
    category: "Profile",
    height: 236,
    spec: () =>
      section("Profile", 236, { fill: solid("$background") }, [
        avatar("AL", (W - 96) / 2, 20, 96, "$primary"),
        text("{{user.name}}", [PAD, 128, IW, 30], { fontSize: 22, fontWeight: 800, textAlign: "center" }, "h2"),
        text("{{user.email}}", [PAD, 160, IW, 22], { fontSize: 14, color: "$muted", textAlign: "center" }, "p"),
        button("Edit profile", [(W - 150) / 2, 190, 150, 38], { fill: solid("$surface"), color: "$text", fontSize: 14 }),
      ]),
  },
  {
    id: "m-settings",
    name: "Settings list",
    category: "Profile",
    height: 300,
    spec: () =>
      section("Settings", 300, {}, [
        box([PAD, 8, IW, 262], { fill: solid("$surface"), radius: 18 }, [
          settingRow("Bell", "Notifications", 4),
          settingRow("Lock", "Privacy", 56),
          settingRow("Palette", "Appearance", 108),
          settingRow("CircleHelp", "Help", 160),
          box([0, 212, IW, 48], {}, [
            button("Sign out", [8, 4, 140, 40], { fill: { type: "none" }, color: "#e5484d", fontSize: 16 }, { icon: "LogOut" }, { click: [{ type: "signOut" }] }),
          ]),
        ]),
      ]),
  },
  {
    id: "m-cta",
    name: "Big button",
    category: "Content",
    height: 84,
    spec: () => section("BigButton", 84, {}, [button("Continue", [PAD, 14, IW, 56], { fontSize: 17 }, { icon: "ArrowRight", iconPos: "right" })]),
  },
];

export const MOBILE_BLOCK_CATEGORIES = Array.from(new Set(MOBILE_BLOCKS.map((b) => b.category)));
