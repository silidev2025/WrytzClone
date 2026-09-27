/*
 * Templates: Feedback board (ideas + votes + roadmap), Resource library.
 */
import type { AppTemplate } from "./index";
import type { ElementSpec } from "@/lib/shared/elements";
import { box, button, buildPage, fill, grad, icon, image, photo, shape, solid, stack, text } from "@/lib/build";
import { ACCESS, W, col, footerBar, formBox, formField, go, makeDoc, makeTheme, navBar, notify, recordList, recordTable, statCard, submitButton, titleBlock } from "./kit";

/** A tag whose text comes from the record, e.g. the category of an idea. */
const dataTag = (value: string, tone = "$primary"): ElementSpec => ({
  ...text(value, [0, 0, 100, 26], { fill: solid(`${tone}/12`), color: tone, radius: 999, fontSize: 12.5, fontWeight: 700, paddingX: 10, textAlign: "center", verticalAlign: "middle" }, "small"),
  sizing: { w: "hug", h: "fixed" },
});

/* ------------------------------------------------------------------ feedback board */

export const feedback: AppTemplate = {
  id: "feedback",
  name: "Feedback board",
  tagline: "Collect ideas and let people vote",
  description:
    "A public ideas board: anyone can post a suggestion and upvote the ones they like, the most-wanted rise to the top, and a roadmap shows what's planned, in progress and done. Admins change an idea's status right from its page.",
  category: "Community",
  emoji: "💡",
  color: "#2563eb",
  features: ["Post ideas from a pop-up form", "One-click upvotes, sorted by votes", "Roadmap with Planned / In progress / Done", "Admins update status from the idea page"],
  collections: [
    {
      key: "ideas",
      name: "Ideas",
      icon: "Lightbulb",
      access: ACCESS.board,
      fields: [
        { name: "Title", type: "text", required: true },
        { name: "Details", type: "longText" },
        { name: "Category", type: "select", options: ["Feature", "Improvement", "Bug"], defaultValue: "Feature" },
        { name: "Votes", type: "number", min: 0, defaultValue: "0", counter: true, locked: true },
        { name: "Status", type: "select", options: ["New", "Planned", "In progress", "Done"], defaultValue: "New", locked: true },
        { name: "Author", type: "text" },
      ],
      seed: [
        { Title: "Dark mode", Details: "Easier on the eyes at night — and it looks great.", Category: "Feature", Votes: 42, Status: "Planned", Author: "Mia" },
        { Title: "Export to spreadsheet", Details: "Download everything as a CSV to share with the team.", Category: "Feature", Votes: 31, Status: "In progress", Author: "Tom" },
        { Title: "Faster search", Details: "Results should appear while I type.", Category: "Improvement", Votes: 18, Status: "Done", Author: "Ivy" },
        { Title: "Reminder emails", Details: "A gentle nudge the day before something is due.", Category: "Feature", Votes: 12, Status: "New", Author: "Ben" },
        { Title: "Save button hides on small phones", Details: "On an iPhone mini the button sits under the keyboard.", Category: "Bug", Votes: 9, Status: "Planned", Author: "Zoe" },
        { Title: "Keyboard shortcuts", Details: "Power users would love a few shortcuts.", Category: "Improvement", Votes: 6, Status: "New", Author: "Raj" },
      ],
    },
  ],
  build: () => {
    const BOARD = "pg_board";
    const IDEA = "pg_idea";
    const ROADMAP = "pg_roadmap";
    const brand = "Ideas board";
    const vote = { type: "adjustNumber" as const, collectionId: col("ideas"), fieldName: "Votes", amount: "1" };
    const voteBox = (size: "sm" | "lg"): ElementSpec =>
      box(
        size === "lg" ? [0, 0, 92, 100] : [0, 0, 68, 76],
        { fill: solid("$primary/10"), radius: 16, borderWidth: 1, borderColor: "$primary/25", cursor: "pointer", hover: { fill: solid("$primary/20") } },
        [icon("ArrowBigUp", [0, 0, size === "lg" ? 30 : 24], { color: "$primary" }), text("{{record.Votes}}", [0, 0, 60, 26], { fontSize: size === "lg" ? 24 : 19, fontWeight: 800, color: "$primary", textAlign: "center" }, "p")],
        { mode: "column", gap: 2, padding: 8, align: "center", justify: "center" },
        { name: "VoteButton", events: { click: [vote, notify("Thanks for voting! 👍")] }, sizing: { w: "fixed", h: "fixed" } },
      );
    const ideaCard = stack(
      "row",
      [0, 0, 760, 130],
      [
        voteBox("sm"),
        {
          ...stack(
            "column",
            [0, 0, 620, 110],
            [
              fill(text("{{record.Title}}", [0, 0, 600], { fontSize: 19, fontWeight: 700 }, "h3")),
              fill(text("{{record.Details | truncate:140}}", [0, 0, 600], { fontSize: 15, color: "$muted" }, "p")),
              stack("row", [0, 0, 400, 26], [dataTag("{{record.Category}}"), dataTag("{{record.Status}}", "$secondary"), text("by {{record.Author | default:'someone'}}", [0, 0, 160, 22], { fontSize: 13, color: "$muted" }, "small", { sizing: { w: "hug", h: "fixed" } })], { gap: 8, align: "center" }, {}, { sizing: { w: "fill", h: "hug" } }),
            ],
            { gap: 6, align: "stretch" },
          ),
          sizing: { w: "fill", h: "hug" },
        },
      ],
      { gap: 18, padding: 18, align: "start" },
      { fill: solid("$background"), radius: 18, borderWidth: 1, borderColor: "$border", cursor: "pointer", hover: { lift: true, borderColor: "$primary" } },
      { name: "IdeaCard", events: { click: [go(IDEA, "{{record.id}}")] } },
    );
    const header = titleBlock(64, "Help us decide what to build next", "Share an idea or upvote the ones you'd love to see. The most-wanted rise to the top.", { align: "left", size: 42, w: 700 });
    const step = (n: string, t: string) =>
      fill(stack("row", [0, 0, 300, 40], [text(n, [0, 0, 30, 30], { fill: solid("$primary"), color: "#ffffff", radius: 999, fontWeight: 800, fontSize: 14, textAlign: "center", verticalAlign: "middle" }, "small", { sizing: { w: "fixed", h: "fixed" } }), { ...text(t, [0, 0, 240], { fontSize: 15 }, "p"), sizing: { w: "fill", h: "hug" } }], { gap: 12, align: "center" }));
    const board = buildPage(
      "Board",
      "",
      [
        navBar(brand, { logo: "Lightbulb", cta: { label: "Share an idea", events: { click: [{ type: "openDialog", targetId: "@idea" }] } } }),
        box([0, 84, W, 300], { fill: grad(160, "$surface", "$background") }, [...header.specs, shape("ellipse", [1010, 40, 220, 220], { fill: solid("$secondary"), opacity: 0.12 }), icon("Lightbulb", [1070, 100, 100], { color: "$primary", opacity: 0.8 })]),
        recordList("IdeasList", "ideas", [80, 420, 760, 900], ideaCard, { columns: 1, gap: 14, pageSize: 20, sortField: "Votes", sortDir: "desc", search: true, searchPlaceholder: "Search ideas…", empty: "No ideas yet — be the first!" }),
        box([880, 420, 320, 250], { fill: solid("$surface"), radius: 20 }, [
          stack("column", [0, 0, 320, 250], [fill(text("How it works", [0, 0, 280], { fontSize: 18, fontWeight: 800 }, "h3")), step("1", "Share an idea in one minute"), step("2", "Upvote the ones you want"), step("3", "Follow along on the roadmap")], { gap: 14, padding: 24, align: "stretch" }),
        ]),
        statCard("IdeasCount", "ideas", [880, 690, 150, 116], "Ideas"),
        statCard("ShippedCount", "ideas", [1050, 690, 150, 116], "Shipped", { filters: [{ field: "Status", op: "equals", value: "Done" }] }),
        button("See the roadmap", [880, 826, 320, 50], { fill: solid("$background"), color: "$primary", borderWidth: 1.5, borderColor: "$primary" }, { icon: "ArrowRight", iconPos: "right" }, { click: [go(ROADMAP)] }),
        {
          type: "dialog",
          name: "NewIdeaDialog",
          ref: "idea",
          box: { x: 380, y: 300, w: 520, h: 600 },
          props: { title: "", closeOnBackdrop: true, layout: { mode: "column", gap: 0, padding: 0, align: "stretch", justify: "start", wrap: false, columns: 1 } },
          children: [
            formBox(
              "IdeaForm",
              "ideas",
              [0, 0, 520, 600],
              [
                fill(text("Share an idea 💡", [0, 0, 460], { fontSize: 26, fontWeight: 800 }, "h2")),
                formField("text", "Your idea", "Title", { placeholder: "e.g. A calendar view", required: true }),
                formField("textarea", "Tell us more", "Details", { placeholder: "What would it help you do?" }, 120),
                formField("select", "Type", "Category", { options: ["Feature", "Improvement", "Bug"], defaultValue: "Feature" }),
                formField("text", "Your name (optional)", "Author", { placeholder: "Alex" }),
                submitButton("Post my idea", {}, { icon: "Send" }),
              ],
              { success: "Idea posted — thank you! 🙌", events: { submit: [{ type: "closeDialog" }] }, style: { borderWidth: 0, shadow: null } },
            ),
          ],
        },
        footerBar(brand, 1400),
      ],
      { id: BOARD, height: 1520 },
    );

    const idea = buildPage(
      "Idea",
      "idea",
      [
        navBar(brand, { logo: "Lightbulb" }),
        button("All ideas", [70, 120, 140, 44], { fill: { type: "none" }, color: "$primary" }, { icon: "ArrowLeft" }, { click: [{ type: "goBack" }] }),
        { ...voteBox("lg"), box: { x: 80, y: 190, w: 92, h: 100 } },
        text("{{record.Title}}", [200, 190, 900, 50], { fontSize: 38, fontWeight: 800 }, "h1", { sizing: { w: "fixed", h: "hug" } }),
        stack("row", [200, 256, 600, 28], [dataTag("{{record.Category}}"), dataTag("{{record.Status}}", "$secondary"), text("Posted by {{record.Author | default:'someone'}} · {{record.createdAt | date}}", [0, 0, 320, 22], { fontSize: 14, color: "$muted" }, "small", { sizing: { w: "hug", h: "fixed" } })], { gap: 10, align: "center" }),
        text("{{record.Details | default:'No details yet.'}}", [200, 310, 760, 60], { fontSize: 18, lineHeight: 1.65 }, "p", { sizing: { w: "fixed", h: "hug" } }),
        {
          ...box([200, 420, 520, 170], { fill: solid("$surface"), radius: 18, borderWidth: 1, borderColor: "$border" }, [
            text("Admin · update status", [24, 20, 400, 24], { fontSize: 15, fontWeight: 800 }, "h3"),
            { type: "input", name: "StatusPicker", box: { x: 24, y: 56, w: 300, h: 74 }, props: { inputType: "select", label: "Status", name: "StatusPicker", showLabel: true, inputStyle: "box", options: ["New", "Planned", "In progress", "Done"], defaultValue: "{{record.Status}}" } },
            button("Save", [340, 82, 150, 48], {}, { icon: "Check" }, { click: [{ type: "updateRecord", collectionId: col("ideas"), mapping: { Status: "{{StatusPicker.value}}" } }, notify("Status updated")] }),
          ]),
          name: "AdminCard",
          ref: "admin",
          startHidden: true,
        },
        footerBar(brand, 700),
      ],
      {
        id: IDEA,
        recordCollectionId: col("ideas"),
        height: 820,
        onLoad: [{ type: "setVisibility", targetId: "@admin", mode: "show", condition: { left: "{{user.isAdmin}}", op: "isTrue" } }],
      },
    );

    const column = (x: number, title: string, status: string, tone: string, ic: string): ElementSpec[] => [
      box([x, 250, 360, 64], { fill: solid(`${tone}/12`), radius: 16 }, [icon(ic, [18, 19, 26], { color: tone }), text(title, [56, 18, 220, 28], { fontSize: 19, fontWeight: 800, color: tone }, "h3")]),
      recordList(
        `${status.replace(/\s/g, "")}List`,
        "ideas",
        [x, 330, 360, 500],
        stack(
          "column",
          [0, 0, 360, 96],
          [fill(text("{{record.Title}}", [0, 0, 320], { fontSize: 16, fontWeight: 700 }, "p")), fill(text("▲ {{record.Votes}} votes · {{record.Category}}", [0, 0, 320], { fontSize: 13, color: "$muted" }, "small"))],
          { gap: 4, padding: 18, align: "stretch" },
          { fill: solid("$background"), radius: 14, borderWidth: 1, borderColor: "$border", cursor: "pointer", hover: { lift: true } },
          { events: { click: [go(IDEA, "{{record.id}}")] } },
        ),
        { columns: 1, gap: 10, pageSize: 20, sortField: "Votes", sortDir: "desc", filters: [{ field: "Status", op: "equals", value: status }], empty: "Nothing here yet." },
      ),
    ];
    const rmTitle = titleBlock(120, "Roadmap", "What we're planning, building and have shipped — shaped by your votes.", { size: 42 });
    const roadmap = buildPage(
      "Roadmap",
      "roadmap",
      [navBar(brand, { logo: "Lightbulb" }), ...rmTitle.specs, ...column(80, "Planned", "Planned", "$primary", "CalendarCheck"), ...column(460, "In progress", "In progress", "$accent", "Hammer"), ...column(840, "Done", "Done", "#16a34a", "CircleCheckBig"), footerBar(brand, 900)],
      { id: ROADMAP, height: 1020 },
    );
    return makeDoc([board, roadmap, idea], makeTheme("tech"));
  },
};

/* ------------------------------------------------------------------ resource library */

export const resources: AppTemplate = {
  id: "resources",
  name: "Resource library",
  tagline: "A searchable collection of links",
  description:
    "Share your favourite articles, tools and courses in a searchable library with covers, types and likes. Visitors can suggest new resources; you review suggestions on an admin page and add the best ones from the Database tab.",
  category: "Community",
  emoji: "📚",
  color: "#2d6a4f",
  features: ["Featured picks and a searchable grid", "One-click likes on every card", "Suggestion form for visitors", "Admin page to review suggestions"],
  collections: [
    {
      key: "resources",
      name: "Resources",
      icon: "BookOpen",
      access: ACCESS.catalog,
      fields: [
        { name: "Title", type: "text", required: true },
        { name: "Description", type: "longText" },
        { name: "Link", type: "url", required: true },
        { name: "Type", type: "select", options: ["Article", "Video", "Tool", "Course", "Book"] },
        { name: "Cover", type: "image" },
        { name: "Featured", type: "boolean" },
        { name: "Likes", type: "number", min: 0, defaultValue: "0", counter: true, locked: true },
      ],
      seed: [
        { Title: "The beginner's guide to design", Description: "Colour, type and spacing explained with friendly examples.", Link: "https://example.com/design", Type: "Course", Cover: photo(20, 800, 500), Featured: true, Likes: 128 },
        { Title: "Write so people read", Description: "Short, practical tips for clearer emails, posts and pages.", Link: "https://example.com/writing", Type: "Article", Cover: photo(367, 800, 500), Featured: true, Likes: 96 },
        { Title: "Deep work, simply", Description: "A calm routine for focused hours without burning out.", Link: "https://example.com/focus", Type: "Book", Cover: photo(24, 800, 500), Featured: true, Likes: 88 },
        { Title: "Budget in 15 minutes", Description: "A no-stress spreadsheet to plan your month.", Link: "https://example.com/budget", Type: "Tool", Cover: photo(180, 800, 500), Featured: false, Likes: 54 },
        { Title: "Photography basics", Description: "Light, framing and your phone — that's all you need.", Link: "https://example.com/photo", Type: "Video", Cover: photo(250, 800, 500), Featured: false, Likes: 47 },
        { Title: "Build a habit that sticks", Description: "Tiny steps, big results: the science made simple.", Link: "https://example.com/habits", Type: "Article", Cover: photo(1015, 800, 500), Featured: false, Likes: 39 },
      ],
    },
    {
      key: "suggestions",
      name: "Suggestions",
      icon: "Inbox",
      access: ACCESS.inbox,
      fields: [
        { name: "Title", type: "text", required: true },
        { name: "Link", type: "url", required: true },
        { name: "Why", type: "longText" },
        { name: "Email", type: "email" },
      ],
      seed: [{ Title: "Free icon library", Link: "https://lucide.dev", Why: "Beautiful icons, free forever.", Email: "sam@example.com" }],
    },
  ],
  build: () => {
    const LIB = "pg_library";
    const SUGGEST = "pg_suggest";
    const MANAGE = "pg_manage";
    const brand = "The Good Stuff";
    const card = (big: boolean): ElementSpec =>
      stack(
        "column",
        [0, 0, 360, big ? 430 : 400],
        [
          { ...image("{{record.Cover}}", [0, 0, 360, big ? 210 : 190], {}, { radius: 14 }), sizing: { w: "fill", h: "fixed" } },
          stack("row", [0, 0, 300, 26], [dataTag("{{record.Type}}")], { gap: 8, align: "center" }, {}, { sizing: { w: "fill", h: "hug" } }),
          fill(text("{{record.Title}}", [0, 0, 320], { fontSize: big ? 21 : 19, fontWeight: 700 }, "h3")),
          fill(text("{{record.Description | truncate:110}}", [0, 0, 320], { fontSize: 15, color: "$muted" }, "p")),
          stack(
            "row",
            [0, 0, 320, 44],
            [
              button("Open", [0, 0, 120, 42], { fontSize: 15 }, { icon: "ArrowUpRight", iconPos: "right" }, { click: [{ type: "openUrl", url: "{{record.Link}}", newTab: true }] }),
              button("{{record.Likes}}", [0, 0, 96, 42], { fill: solid("$secondary/12"), color: "$secondary", fontSize: 15 }, { icon: "Heart" }, { click: [{ type: "adjustNumber", collectionId: col("resources"), fieldName: "Likes", amount: "1" }] }),
            ],
            { gap: 10, align: "center" },
            {},
            { sizing: { w: "fill", h: "hug" } },
          ),
        ],
        { gap: 12, padding: 14, align: "stretch" },
        { fill: solid("$background"), radius: 20, borderWidth: 1, borderColor: "$border", hover: { lift: true } },
      );
    const hero = titleBlock(80, "The best free resources, hand-picked", "Articles, tools and courses we actually use. Search, like your favourites and suggest your own.", { size: 50, w: 900 });
    const browse = titleBlock(0, "Browse everything", undefined, { align: "left", size: 32 });
    const lib = buildPage(
      "Library",
      "",
      [
        navBar(brand, { logo: "BookOpen", cta: { label: "Suggest a link", pageId: SUGGEST } }),
        box([0, 84, W, 300], { fill: grad(180, "$surface", "$background") }, hero.specs),
        text("⭐  Featured picks", [80, 420, 400, 30], { fontSize: 22, fontWeight: 800 }, "h2"),
        recordList("FeaturedList", "resources", [80, 470, 1120, 430], card(true), { columns: 3, gap: 24, pageSize: 3, sortField: "Likes", sortDir: "desc", filters: [{ field: "Featured", op: "isTrue" }] }),
        ...browse.specs.map((s) => ({ ...s, box: { ...s.box, x: 80, y: 960 } })),
        recordList("AllList", "resources", [80, 1020, 1120, 900], card(false), { columns: 3, gap: 24, pageSize: 9, sortField: "createdAt", sortDir: "desc", search: true, searchPlaceholder: "Search by title or topic…" }),
        footerBar(brand, 1980),
      ],
      { id: LIB, height: 2100 },
    );
    const sgTitle = titleBlock(150, "Suggest a resource", "Found something great? Send it over — we read every suggestion.", { size: 42, w: 700 });
    const suggest = buildPage(
      "Suggest",
      "suggest",
      [
        navBar(brand, { logo: "BookOpen" }),
        ...sgTitle.specs,
        formBox(
          "SuggestForm",
          "suggestions",
          [340, sgTitle.bottom + 40, 600, 560],
          [
            formField("text", "What is it?", "Title", { placeholder: "e.g. A great free course", required: true }),
            formField("url", "Link", "Link", { placeholder: "https://", required: true }),
            formField("textarea", "Why do you like it?", "Why", { placeholder: "One or two sentences" }, 120),
            formField("email", "Your email (optional)", "Email", { placeholder: "So we can say thanks" }),
            submitButton("Send suggestion", {}, { icon: "Send" }),
          ],
          { success: "Thank you! We'll take a look. 📚" },
        ),
        footerBar(brand, 980),
      ],
      { id: SUGGEST, height: 1100 },
    );
    const mgTitle = titleBlock(120, "Suggestions to review", "Add the good ones to the Resources collection in the Database tab (tick “Featured” to show them at the top).", { align: "left", size: 36, w: 1000 });
    const manage = buildPage(
      "Manage",
      "manage",
      [
        navBar(brand, { logo: "BookOpen" }),
        ...mgTitle.specs,
        recordTable("SuggestionsTable", "suggestions", [80, 280, 1120, 360], [{ field: "Title" }, { field: "Link" }, { field: "Why" }, { field: "Email" }]),
        text("Everything in the library", [80, 690, 600, 34], { fontSize: 26, fontWeight: 800 }, "h2"),
        recordTable("ResourcesTable", "resources", [80, 740, 1120, 460], [{ field: "Title" }, { field: "Type" }, { field: "Featured" }, { field: "Likes" }, { field: "Link" }], { sortField: "Likes" }),
      ],
      { id: MANAGE, access: "admins", height: 1260 },
    );
    return makeDoc([lib, suggest, manage], makeTheme("forest"));
  },
};
