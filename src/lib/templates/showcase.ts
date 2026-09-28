/*
 * Templates: Portfolio, Blog.
 */
import type { AppTemplate } from "./index";
import type { ElementSpec } from "@/lib/shared/elements";
import { box, button, buildPage, fill, image, input, photo, shape, solid, stack, text } from "@/lib/build";
import { ACCESS, W, col, footerBar, formBox, formField, go, makeDoc, makeTheme, navBar, notify, recordList, recordTable, statCard, submitButton, titleBlock } from "./kit";

const dataTag = (value: string, tone = "$primary"): ElementSpec => ({
  ...text(value, [0, 0, 100, 26], { fill: solid(`${tone}/12`), color: tone, radius: 999, fontSize: 12.5, fontWeight: 700, paddingX: 10, textAlign: "center", verticalAlign: "middle" }, "small"),
  sizing: { w: "hug", h: "fixed" },
});

/* ------------------------------------------------------------------ portfolio */

export const portfolio: AppTemplate = {
  id: "portfolio",
  name: "Portfolio",
  tagline: "Show your work and get hired",
  description:
    "A clean portfolio with a big introduction, a grid of projects that each open their own case-study page, an about section and a contact form. Add a project in the Database tab and it appears on the site instantly.",
  category: "Personal",
  emoji: "🎨",
  color: "#111111",
  features: ["Project grid with a page for every project", "Case study pages filled from your database", "Contact form with budget choices", "Admin inbox for new messages"],
  collections: [
    {
      key: "projects",
      name: "Projects",
      icon: "Briefcase",
      access: ACCESS.catalog,
      fields: [
        { name: "Title", type: "text", required: true },
        { name: "Summary", type: "longText" },
        { name: "Cover", type: "image" },
        { name: "Category", type: "select", options: ["Branding", "Web design", "Illustration", "Photography"] },
        { name: "Year", type: "text" },
        { name: "Client", type: "text" },
        { name: "Story", type: "longText" },
        { name: "Link", type: "url" },
      ],
      seed: [
        { Title: "Sunday Coffee Co.", Summary: "A warm, hand-drawn identity for a neighbourhood roaster.", Cover: photo(431, 1200, 800), Category: "Branding", Year: "2026", Client: "Sunday Coffee", Story: "Sunday wanted to feel like the first sip of the weekend. We built a hand-drawn logo, a warm colour palette and packaging that customers keep long after the beans are gone. Sales of whole beans doubled in the first three months.", Link: "https://example.com" },
        { Title: "Trailhead app", Summary: "Planning hikes made simple, from the first idea to the summit.", Cover: photo(177, 1200, 800), Category: "Web design", Year: "2025", Client: "Trailhead", Story: "Hikers told us planning felt like homework. The new app turns it into a few taps: pick a mood, see trails nearby, and share the plan with friends.", Link: "https://example.com" },
        { Title: "Wild Kitchen cookbook", Summary: "Illustrations for a cookbook about foraging and seasonal food.", Cover: photo(292, 1200, 800), Category: "Illustration", Year: "2025", Client: "Wild Kitchen Press", Story: "Forty illustrations, one for every recipe, painted in gouache and scanned at high resolution for print.", Link: "https://example.com" },
        { Title: "City at dusk", Summary: "A photo series about the quiet hour when the city switches on.", Cover: photo(43, 1200, 800), Category: "Photography", Year: "2024", Client: "Personal project", Story: "Shot over twelve evenings with a single lens. The series was shown at a local gallery and printed as a small zine.", Link: "https://example.com" },
      ],
    },
    {
      key: "messages",
      name: "Messages",
      icon: "Mail",
      access: ACCESS.inbox,
      fields: [
        { name: "Name", type: "text", required: true },
        { name: "Email", type: "email", required: true },
        { name: "Budget", type: "select", options: ["Under $1k", "$1k – $5k", "$5k – $15k", "$15k+"] },
        { name: "Message", type: "longText", required: true },
        { name: "Consent", type: "boolean" },
      ],
      seed: [{ Name: "Jamie from Bloom", Email: "jamie@example.com", Budget: "$5k – $15k", Message: "Hi! We're opening a flower shop in spring and would love a new brand. Are you free for a call?" }],
    },
  ],
  build: () => {
    const HOME = "pg_home";
    const PROJECT = "pg_project";
    const CONTACT = "pg_contact";
    const INBOX = "pg_inbox";
    const brand = "Alex Rivera";
    const nav = () => navBar(brand, { logo: "PenTool", cta: { label: "Hire me", pageId: CONTACT } });
    const projectCard = stack(
      "column",
      [0, 0, 548, 470],
      [
        { ...image("{{record.Cover}}", [0, 0, 548, 360], {}, { radius: 18 }), sizing: { w: "fill", h: "fixed" } },
        fill(text("{{record.Title}}", [0, 0, 540], { fontSize: 24, fontWeight: 700 }, "h3")),
        fill(text("{{record.Category}} · {{record.Year}}", [0, 0, 540], { fontSize: 15, color: "$muted" }, "p")),
      ],
      { gap: 10, align: "stretch" },
      { cursor: "pointer", hover: { lift: true } },
      { name: "ProjectCard", events: { click: [go(PROJECT, "{{record.id}}")] } },
    );
    const skills = ["Brand identity", "Web design", "Illustration", "Art direction", "Photography"];
    const home = buildPage(
      "Home",
      "",
      [
        nav(),
        text("👋  Hi, I'm Alex —", [80, 170, 600, 34], { fontSize: 22, color: "$muted", fontWeight: 500 }, "p"),
        text("a designer & illustrator making brands feel human.", [80, 214, 700, 250], { fontSize: 64, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }, "h1"),
        stack("row", [80, 500, 520, 56], [button("See my work", [0, 0, 180, 56], { fontSize: 16 }, { icon: "ArrowDown", iconPos: "right" }, { click: [{ type: "scrollTo", targetId: "@work" }] }), button("Get in touch", [0, 0, 180, 56], { fill: { type: "none" }, color: "$text", borderWidth: 2, borderColor: "$text", fontSize: 16 }, {}, { click: [go(CONTACT)] })], { gap: 14, align: "center" }),
        shape("blob", [860, 150, 380, 400], { fill: solid("$accent"), opacity: 0.35 }),
        image(photo(823, 800, 1000), [880, 130, 320, 420], { mask: "arch" }, { radius: 0 }),
        box([0, 640, W, 90], { fill: solid("$text") }, [text("Brand identity  ✦  Web design  ✦  Illustration  ✦  Art direction  ✦  Photography", [0, 26, W, 40], { fontSize: 26, fontWeight: 700, color: "$background", textAlign: "center", fontFamily: "$heading" }, "p")]),
        { ...text("Selected work", [80, 800, 600, 50], { fontSize: 44, fontWeight: 800, letterSpacing: -1 }, "h2"), ref: "work" },
        text("A few projects I'm proud of. Click one to read the story.", [80, 860, 700, 30], { fontSize: 19, color: "$muted" }, "p"),
        recordList("Projects", "projects", [80, 930, 1120, 1000], projectCard, { columns: 2, gap: 24, pageSize: 6, sortField: "Year", sortDir: "desc" }),
        box([0, 1990, W, 520], { fill: solid("$surface") }, [
          image(photo(454, 900, 900), [80, 80, 360, 360], {}, { radius: 24 }),
          text("About me", [520, 90, 600, 50], { fontSize: 40, fontWeight: 800 }, "h2"),
          text("I've spent ten years helping small businesses look as good as they are. I love simple ideas, bold colour and a good cup of coffee. When I'm not designing, you'll find me sketching in a park or behind a camera.", [520, 156, 640, 140], { fontSize: 19, lineHeight: 1.65, color: "$muted" }, "p"),
          stack("row", [520, 330, 680, 40], skills.map((s) => ({ ...text(s, [0, 0, 100, 38], { fill: solid("$background"), radius: 999, borderWidth: 1, borderColor: "$border", fontSize: 14, fontWeight: 600, paddingX: 16, textAlign: "center", verticalAlign: "middle" }, "small"), sizing: { w: "hug" as const, h: "fixed" as const } })), { gap: 10, align: "center", wrap: true }),
        ]),
        box([80, 2570, 1120, 260], { fill: solid("$primary"), radius: 32 }, [
          text("Have a project in mind?", [60, 60, 700, 60], { fontSize: 46, fontWeight: 800, color: "$background", letterSpacing: -1 }, "h2"),
          text("I'm booking new work for next month. Tell me about your idea.", [60, 130, 640, 30], { fontSize: 19, color: "$background", opacity: 0.8 }, "p"),
          button("Let's talk", [880, 100, 180, 60], { fill: solid("$background"), color: "$primary", fontSize: 17 }, { icon: "ArrowRight", iconPos: "right" }, { click: [go(CONTACT)] }),
        ]),
        footerBar(brand, 2900, "Designed with love."),
      ],
      { id: HOME, height: 3020 },
    );
    const project = buildPage(
      "Project",
      "project",
      [
        nav(),
        button("All projects", [70, 116, 150, 44], { fill: { type: "none" }, color: "$text" }, { icon: "ArrowLeft" }, { click: [go(HOME)] }),
        text("{{record.Category}} · {{record.Year}}", [80, 180, 600, 26], { fontSize: 16, color: "$muted", fontWeight: 600 }, "p"),
        text("{{record.Title}}", [80, 212, 1000, 76], { fontSize: 60, fontWeight: 800, letterSpacing: -2 }, "h1", { sizing: { w: "fixed", h: "hug" } }),
        text("{{record.Summary}}", [80, 304, 900, 60], { fontSize: 22, color: "$muted" }, "p", { sizing: { w: "fixed", h: "hug" } }),
        image("{{record.Cover}}", [80, 400, 1120, 640], {}, { radius: 24 }),
        stack(
          "column",
          [80, 1090, 300, 200],
          [
            fill(text("Client", [0, 0, 300], { fontSize: 13, color: "$muted", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }, "small")),
            fill(text("{{record.Client}}", [0, 0, 300], { fontSize: 18, fontWeight: 600 }, "p")),
            fill(text("Year", [0, 0, 300], { fontSize: 13, color: "$muted", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }, "small")),
            fill(text("{{record.Year}}", [0, 0, 300], { fontSize: 18, fontWeight: 600 }, "p")),
          ],
          { gap: 6, align: "stretch" },
        ),
        text("{{record.Story}}", [440, 1090, 760, 120], { fontSize: 20, lineHeight: 1.7 }, "p", { sizing: { w: "fixed", h: "hug" } }),
        button("Visit the project", [440, 1250, 220, 54], {}, { icon: "ArrowUpRight", iconPos: "right" }, { click: [{ type: "openUrl", url: "{{record.Link}}", newTab: true }] }),
        footerBar(brand, 1380, "Designed with love."),
      ],
      { id: PROJECT, recordCollectionId: col("projects"), height: 1500 },
    );
    const contact = buildPage(
      "Contact",
      "contact",
      [
        nav(),
        text("Let's make something great.", [80, 170, 480, 170], { fontSize: 56, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05 }, "h1"),
        text("Tell me a little about your project and I'll get back to you.", [80, 360, 440, 60], { fontSize: 19, color: "$muted" }, "p"),
        stack("column", [80, 460, 440, 120], [fill(text("✉️  hello@alexrivera.design", [0, 0, 440], { fontSize: 17, fontWeight: 600 }, "p")), fill(text("📍  Lisbon, working worldwide", [0, 0, 440], { fontSize: 17, fontWeight: 600 }, "p"))], { gap: 12, align: "stretch" }),
        formBox(
          "ContactForm",
          "messages",
          [620, 150, 580, 640],
          [
            formField("text", "Your name", "Name", { placeholder: "Jamie", required: true }),
            formField("email", "Email", "Email", { placeholder: "jamie@example.com", required: true }),
            formField("radio", "Budget", "Budget", { options: ["Under $1k", "$1k – $5k", "$5k – $15k", "$15k+"] }, 140),
            formField("textarea", "About your project", "Message", { placeholder: "What are you making? When do you need it?", required: true }),
            formField("toggle", "I agree that Alex keeps my message and email to reply to me.", "Consent", { required: true }, 56),
            submitButton("Send message", {}, { icon: "Send" }),
          ],
          { success: "Thanks {{form.Name}}! I'll be in touch soon." },
        ),
        footerBar(brand, 900, "Designed with love."),
      ],
      { id: CONTACT, height: 1020 },
    );
    const inboxTitle = titleBlock(120, "Messages", "New enquiries from your contact form. Only you and your app admins can see them.", { align: "left", size: 38 });
    const inbox = buildPage(
      "Inbox",
      "inbox",
      [nav(), ...inboxTitle.specs, statCard("MessageCount", "messages", [80, 270, 260, 120], "Messages"), recordTable("MessagesTable", "messages", [80, 430, 1120, 520], [{ field: "Name" }, { field: "Email" }, { field: "Budget" }, { field: "Message" }])],
      { id: INBOX, access: "admins", height: 1020 },
    );
    return makeDoc([home, project, contact, inbox], makeTheme("mono", { headingFont: "Space Grotesk", colors: { primary: "#111111", accent: "#ffb347", secondary: "#ff5c35" } }));
  },
};

/* ------------------------------------------------------------------ blog */

export const blog: AppTemplate = {
  id: "blog",
  name: "Blog",
  tagline: "Write stories and grow a following",
  description:
    "A calm, readable blog: a featured story up top, a grid of recent posts, a page for every post with likes, and a newsletter sign-up. Write and publish posts in the Database tab — no editor needed.",
  category: "Personal",
  emoji: "✍️",
  color: "#9c6644",
  features: ["Featured story and recent posts", "A readable page for every post", "Likes on every story", "Newsletter sign-up with a subscriber list"],
  collections: [
    {
      key: "posts",
      name: "Posts",
      icon: "Newspaper",
      access: ACCESS.catalog,
      fields: [
        { name: "Title", type: "text", required: true },
        { name: "Excerpt", type: "longText" },
        { name: "Body", type: "longText" },
        { name: "Cover", type: "image" },
        { name: "Author", type: "text" },
        { name: "Topic", type: "select", options: ["Stories", "Guides", "Notes"] },
        { name: "Published", type: "date" },
        { name: "Featured", type: "boolean" },
        { name: "Likes", type: "number", min: 0, defaultValue: "0", counter: true, locked: true },
      ],
      seed: [
        { Title: "The art of the slow morning", Excerpt: "Why the first hour of the day shapes everything that follows — and how to protect it.", Body: "There's a quiet moment before the day starts asking for things. For years I skipped it: phone first, coffee second, me last. Then I tried something small — ten minutes with a cup of tea and nothing else.\n\nIt felt silly at first. By the second week it felt necessary. The day didn't get less busy, but I got less scattered.\n\nHere's the routine that stuck: wake up, open a window, make tea, write three lines in a notebook. That's it. No apps, no plans, no pressure.", Cover: photo(365, 1400, 900), Author: "Nora Ellis", Topic: "Stories", Published: "2026-09-20", Featured: true, Likes: 64 },
        { Title: "A beginner's guide to sourdough", Excerpt: "Flour, water, salt and patience. Everything you need for your first loaf.", Body: "Sourdough has a reputation for being difficult. It isn't — it's just slow. Start with a healthy starter, give the dough time, and don't worry about perfect.", Cover: photo(292, 1200, 800), Author: "Nora Ellis", Topic: "Guides", Published: "2026-09-12", Featured: false, Likes: 41 },
        { Title: "Notes from a rainy week", Excerpt: "Small joys, good books and the sound of rain on the roof.", Body: "It rained for seven days straight. I read three books, baked twice and finally fixed the wobbly chair. Not bad at all.", Cover: photo(116, 1200, 800), Author: "Sam Park", Topic: "Notes", Published: "2026-09-05", Featured: false, Likes: 27 },
        { Title: "How to start a reading habit", Excerpt: "Ten pages a day adds up to more than a dozen books a year.", Body: "The trick isn't willpower. It's making reading the easiest thing to do: a book by the bed, one in your bag, and a phone that lives in another room.", Cover: photo(24, 1200, 800), Author: "Sam Park", Topic: "Guides", Published: "2026-08-28", Featured: false, Likes: 33 },
      ],
    },
    {
      key: "subscribers",
      name: "Subscribers",
      icon: "Mail",
      access: ACCESS.inbox,
      fields: [
        { name: "Email", type: "email", required: true, unique: true },
        { name: "Consent", type: "boolean" },
      ],
      seed: [{ Email: "reader@example.com" }, { Email: "fan@example.com" }],
    },
  ],
  build: () => {
    const HOME = "pg_home";
    const POST = "pg_post";
    const SUBS = "pg_subscribers";
    const brand = "The Slow Journal";
    const nav = () => navBar(brand, { logo: "Feather" });
    const featured = stack(
      "row",
      [0, 0, 1120, 440],
      [
        { ...image("{{record.Cover}}", [0, 0, 620, 440], {}, { radius: 24 }), sizing: { w: "fixed", h: "fixed" } },
        {
          ...stack(
            "column",
            [0, 0, 460, 440],
            [
              stack("row", [0, 0, 300, 26], [dataTag("Featured", "$secondary"), dataTag("{{record.Topic}}")], { gap: 8, align: "center" }, {}, { sizing: { w: "fill", h: "hug" } }),
              fill(text("{{record.Title}}", [0, 0, 440], { fontSize: 40, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }, "h2")),
              fill(text("{{record.Excerpt}}", [0, 0, 440], { fontSize: 18, color: "$muted", lineHeight: 1.6 }, "p")),
              fill(text("{{record.Author}} · {{record.Published}}", [0, 0, 440], { fontSize: 14, color: "$muted", fontWeight: 600 }, "small")),
              button("Read the story", [0, 0, 190, 52], {}, { icon: "ArrowRight", iconPos: "right" }, { click: [go(POST, "{{record.id}}")] }),
            ],
            { gap: 16, padding: 8, align: "start", justify: "center" },
          ),
          sizing: { w: "fill", h: "fixed" },
        },
      ],
      { gap: 48, align: "center" },
    );
    const postCard = stack(
      "column",
      [0, 0, 357, 440],
      [
        { ...image("{{record.Cover}}", [0, 0, 357, 230], {}, { radius: 18 }), sizing: { w: "fill", h: "fixed" } },
        stack("row", [0, 0, 300, 26], [dataTag("{{record.Topic}}")], { gap: 8 }, {}, { sizing: { w: "fill", h: "hug" } }),
        fill(text("{{record.Title}}", [0, 0, 340], { fontSize: 22, fontWeight: 700, lineHeight: 1.2 }, "h3")),
        fill(text("{{record.Excerpt | truncate:100}}", [0, 0, 340], { fontSize: 15, color: "$muted" }, "p")),
        fill(text("{{record.Published}} · ♥ {{record.Likes}}", [0, 0, 340], { fontSize: 13, color: "$muted", fontWeight: 600 }, "small")),
      ],
      { gap: 10, align: "stretch" },
      { cursor: "pointer", hover: { lift: true } },
      { name: "PostCard", events: { click: [go(POST, "{{record.id}}")] } },
    );
    const home = buildPage(
      "Home",
      "",
      [
        nav(),
        text("Stories about living a little slower.", [80, 140, 900, 60], { fontSize: 46, fontWeight: 800, letterSpacing: -1 }, "h1"),
        text("Essays, guides and notes — new every week.", [80, 206, 700, 30], { fontSize: 19, color: "$muted" }, "p"),
        recordList("FeaturedPost", "posts", [80, 290, 1120, 440], featured, { columns: 1, pageSize: 1, sortField: "Published", sortDir: "desc", filters: [{ field: "Featured", op: "isTrue" }] }),
        text("Recent posts", [80, 800, 600, 40], { fontSize: 30, fontWeight: 800 }, "h2"),
        recordList("Posts", "posts", [80, 860, 1120, 960], postCard, { columns: 3, gap: 24, pageSize: 6, sortField: "Published", sortDir: "desc", filters: [{ field: "Featured", op: "isFalse" }], search: true, searchPlaceholder: "Search stories…" }),
        box([80, 1880, 1120, 280], { fill: solid("$surface"), radius: 28 }, [
          text("Get new stories by email", [60, 60, 560, 44], { fontSize: 34, fontWeight: 800 }, "h2"),
          text("We'll write when there's a new story. To stop, email us and we'll remove you.", [60, 116, 520, 56], { fontSize: 18, color: "$muted" }, "p"),
          {
            type: "form",
            name: "NewsletterForm",
            box: { x: 620, y: 50, w: 440, h: 180 },
            style: {},
            props: { collectionId: col("subscribers"), successMessage: "You're subscribed! 💌", layout: { mode: "column", gap: 10, padding: 0, align: "stretch", justify: "start", wrap: false, columns: 1 } },
            children: [
              { ...input("email", "Email", "Email", [0, 0, 440, 52], { showLabel: false, placeholder: "you@example.com", required: true, inputStyle: "box" }), sizing: { w: "fill", h: "hug" } },
              formField("toggle", "I agree that the blog keeps my email to write to me about new stories.", "Consent", { required: true }, 56),
              { ...button("Subscribe", [0, 0, 440, 52], {}, { submit: true }), sizing: { w: "fill", h: "fixed" } },
            ],
          },
        ]),
        footerBar(brand, 2220, "Written slowly."),
      ],
      { id: HOME, height: 2340 },
    );
    const post = buildPage(
      "Post",
      "post",
      [
        nav(),
        button("All stories", [230, 116, 150, 44], { fill: { type: "none" }, color: "$primary" }, { icon: "ArrowLeft" }, { click: [go(HOME)] }),
        stack("row", [240, 180, 600, 26], [dataTag("{{record.Topic}}")], { gap: 8 }),
        text("{{record.Title}}", [240, 220, 800, 120], { fontSize: 52, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1 }, "h1", { sizing: { w: "fixed", h: "hug" } }),
        text("By {{record.Author}} · {{record.Published}}", [240, 356, 800, 26], { fontSize: 16, color: "$muted", fontWeight: 600 }, "p"),
        image("{{record.Cover}}", [80, 410, 1120, 560], {}, { radius: 28 }),
        text("{{record.Excerpt}}", [240, 1010, 800, 60], { fontSize: 23, lineHeight: 1.55, fontWeight: 600 }, "p", { sizing: { w: "fixed", h: "hug" } }),
        text("{{record.Body}}", [240, 1110, 800, 200], { fontSize: 19, lineHeight: 1.8 }, "p", { sizing: { w: "fixed", h: "hug" } }),
        box([240, 1360, 800, 110], { fill: solid("$surface"), radius: 20 }, [
          text("Enjoyed this story?", [28, 26, 400, 28], { fontSize: 20, fontWeight: 800 }, "h3"),
          text("Let the author know with a like.", [28, 58, 400, 24], { fontSize: 15, color: "$muted" }, "p"),
          button("♥  {{record.Likes}}", [620, 30, 150, 50], { fill: solid("$secondary"), fontSize: 17 }, {}, { click: [{ type: "adjustNumber", collectionId: col("posts"), fieldName: "Likes", amount: "1" }, notify("Thanks for the love! ♥")] }),
        ]),
        footerBar(brand, 1540, "Written slowly."),
      ],
      { id: POST, recordCollectionId: col("posts"), height: 1660 },
    );
    const subsTitle = titleBlock(120, "Subscribers", "Everyone who signed up for your newsletter. Export them as a CSV from the Database tab.", { align: "left", size: 38 });
    const subs = buildPage(
      "Subscribers",
      "subscribers",
      [nav(), ...subsTitle.specs, statCard("SubscriberCount", "subscribers", [80, 270, 260, 120], "Subscribers"), recordTable("SubscribersTable", "subscribers", [80, 430, 700, 480], [{ field: "Email" }])],
      { id: SUBS, access: "admins", height: 980 },
    );
    return makeDoc([home, post, subs], makeTheme("earthy"));
  },
};
