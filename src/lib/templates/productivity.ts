/*
 * Template: Task tracker (private to each signed-in person).
 */
import type { AppTemplate } from "./index";
import type { ElementSpec } from "@/lib/shared/elements";
import type { Action } from "@/lib/shared/types";
import { box, button, buildPage, fill, grad, icon, input, shape, solid, stack, text } from "@/lib/build";
import { ACCESS, W, col, featureRow, footerBar, go, makeDoc, makeTheme, navBar, notify, recordList, statCard, titleBlock } from "./kit";

const dataTag = (value: string, tone = "$primary"): ElementSpec => ({
  ...text(value, [0, 0, 100, 26], { fill: solid(`${tone}/12`), color: tone, radius: 999, fontSize: 12.5, fontWeight: 700, paddingX: 10, textAlign: "center", verticalAlign: "middle" }, "small"),
  sizing: { w: "hug", h: "fixed" },
});

export const tasks: AppTemplate = {
  id: "tasks",
  name: "Task tracker",
  tagline: "A private to-do list for everyone",
  description:
    "Everyone who signs in gets their own private task list: add tasks with a priority and a due date, move them from To do to Doing to Done, and watch the counters change. Nobody can see anyone else's tasks.",
  category: "Productivity",
  emoji: "✅",
  color: "#4d7c0f",
  features: ["Private lists — people only see their own tasks", "Quick-add with priority and due date", "To do / Doing / Done tabs", "Live counters for each column"],
  collections: [
    {
      key: "tasks",
      name: "Tasks",
      icon: "SquareCheck",
      access: ACCESS.personal,
      fields: [
        { name: "Title", type: "text", required: true },
        { name: "Notes", type: "longText" },
        { name: "Due", type: "date" },
        { name: "Priority", type: "select", options: ["Low", "Medium", "High"], defaultValue: "Medium" },
        { name: "Status", type: "select", options: ["To do", "Doing", "Done"], defaultValue: "To do" },
      ],
      seed: [
        { Title: "Plan the team offsite", Due: "2026-10-10", Priority: "High", Status: "Doing" },
        { Title: "Book flights", Due: "2026-10-02", Priority: "High", Status: "To do" },
        { Title: "Send the monthly update", Due: "2026-10-01", Priority: "Medium", Status: "To do" },
        { Title: "Water the plants", Priority: "Low", Status: "Done" },
      ],
    },
  ],
  build: () => {
    const HOME = "pg_home";
    const TASKS = "pg_tasks";
    const brand = "Tickoff";
    const setStatus = (status: string): Omit<Action, "id">[] => [{ type: "updateRecord", collectionId: col("tasks"), mapping: { Status: status } }];
    const smallBtn = (label: string, ic: string, actions: Omit<Action, "id">[], tone = "$primary") =>
      button(label, [0, 0, 110, 40], { fill: solid(`${tone}/12`), color: tone, fontSize: 14 }, { icon: ic }, { click: actions }, { sizing: { w: "hug", h: "fixed" } });
    const removeBtn = button("", [0, 0, 40, 40], { fill: { type: "none" }, color: "$muted" }, { icon: "Trash2" }, { click: [{ type: "deleteRecord", collectionId: col("tasks"), confirmText: "Delete “{{record.Title}}”?" }] }, { name: "DeleteButton" });
    const taskCard = (actions: ElementSpec[]): ElementSpec =>
      stack(
        "row",
        [0, 0, 1060, 84],
        [
          {
            ...stack(
              "column",
              [0, 0, 600, 56],
              [
                fill(text("{{record.Title}}", [0, 0, 600], { fontSize: 18, fontWeight: 700 }, "p")),
                stack("row", [0, 0, 600, 26], [dataTag("{{record.Priority}}", "$secondary"), text("Due {{record.Due | date | default:'any time'}}", [0, 0, 200, 22], { fontSize: 14, color: "$muted" }, "small", { sizing: { w: "hug", h: "fixed" } })], { gap: 10, align: "center" }, {}, { sizing: { w: "fill", h: "hug" } }),
              ],
              { gap: 6, align: "stretch" },
            ),
            sizing: { w: "fill", h: "hug" },
          },
          ...actions,
          removeBtn,
        ],
        { gap: 10, padding: 16, align: "center" },
        { fill: solid("$background"), radius: 16, borderWidth: 1, borderColor: "$border" },
      );
    const list = (status: string, actions: ElementSpec[]) =>
      recordList(`${status.replace(/\s/g, "")}Tasks`, "tasks", [30, 20, 1060, 480], taskCard(actions), {
        columns: 1,
        gap: 10,
        pageSize: 30,
        sortField: "Due",
        sortDir: "asc",
        filters: [{ field: "Status", op: "equals", value: status }],
        empty: status === "Done" ? "Nothing finished yet — you've got this!" : "Nothing here. Add a task above.",
      });

    const hero = titleBlock(150, "Get things done, one task at a time.", "A calm, private to-do list. Sign in and it's yours — nobody else can see your tasks.", { size: 56, w: 820 });
    const home = buildPage(
      "Welcome",
      "",
      [
        navBar(brand, { logo: "SquareCheck", cta: { label: "Open my tasks", pageId: TASKS } }),
        box([0, 84, W, 620], { fill: grad(180, "$surface", "$background"), overflow: "hidden" }, [
          shape("blob", [-120, 380, 400, 360], { fill: solid("$secondary"), opacity: 0.15 }),
          shape("ellipse", [1080, 60, 260, 260], { fill: solid("$accent"), opacity: 0.25 }),
          ...hero.specs.map((s) => ({ ...s, box: { ...s.box, y: (s.box?.y ?? 0) - 84 } })),
          button("Open my tasks", [520, hero.bottom - 30, 240, 58], { fontSize: 17 }, { icon: "ArrowRight", iconPos: "right" }, { click: [go(TASKS)] }),
          text("Free · works on your phone too", [440, hero.bottom + 44, 400, 24], { fontSize: 14, color: "$muted", textAlign: "center" }, "small"),
        ]),
        box([0, 704, W, 360], { fill: solid("$background") }, [
          featureRow(40, [
            ["Lock", "Private by default", "Your tasks are only visible to you, on every device."],
            ["Zap", "Quick to add", "Type, pick a priority, press Enter. Done in seconds."],
            ["ChartColumn", "See your progress", "Counters for To do, Doing and Done keep you moving."],
          ]),
        ]),
        footerBar(brand, 1064),
      ],
      { id: HOME, height: 1184 },
    );

    const tabs: ElementSpec = {
      type: "tabs",
      name: "StatusTabs",
      box: { x: 80, y: 520, w: 1120, h: 620 },
      props: { tabs: [{ id: "t0", label: "To do" }, { id: "t1", label: "Doing" }, { id: "t2", label: "Done" }], activeTab: 0, variant: "pills" },
      children: [
        { type: "box", name: "TodoPanel", box: { x: 0, y: 0, w: 1120, h: 560 }, children: [list("To do", [smallBtn("Start", "Play", setStatus("Doing")), smallBtn("Done", "Check", [...setStatus("Done"), notify("Nice work! ✅")], "#16a34a")])] },
        { type: "box", name: "DoingPanel", box: { x: 0, y: 0, w: 1120, h: 560 }, children: [list("Doing", [smallBtn("Done", "Check", [...setStatus("Done"), notify("Nice work! ✅")], "#16a34a")])] },
        { type: "box", name: "DonePanel", box: { x: 0, y: 0, w: 1120, h: 560 }, children: [list("Done", [smallBtn("Undo", "Undo2", setStatus("To do"), "$muted")])] },
      ],
    };
    const counter = (name: string, status: string, x: number, tone: string, ic: string): ElementSpec[] => [
      statCard(name, "tasks", [x, 200, 360, 110], status, { filters: [{ field: "Status", op: "equals", value: status }], style: { fill: solid(`${tone}/10`) } }),
      icon(ic, [x + 300, 236, 36], { color: tone, opacity: 0.8 }),
    ];
    const tasksPage = buildPage(
      "My tasks",
      "tasks",
      [
        navBar(brand, { logo: "SquareCheck" }),
        text("Hi {{user.name}} 👋", [80, 120, 700, 50], { fontSize: 38, fontWeight: 800 }, "h1"),
        text("Here's what's on your plate.", [80, 170, 700, 26], { fontSize: 17, color: "$muted" }, "p"),
        ...counter("TodoCount", "To do", 80, "$primary", "Circle"),
        ...counter("DoingCount", "Doing", 460, "$accent", "Timer"),
        ...counter("DoneCount", "Done", 840, "#16a34a", "CircleCheckBig"),
        {
          type: "form",
          name: "QuickAdd",
          box: { x: 80, y: 340, w: 1120, h: 110 },
          style: { fill: solid("$surface"), radius: 20 },
          props: { collectionId: col("tasks"), successMessage: "Task added", layout: { mode: "row", gap: 12, padding: 18, align: "end", justify: "start", wrap: false, columns: 1 } },
          children: [
            { ...input("text", "New task", "Title", [0, 0, 480, 74], { placeholder: "What needs doing?", required: true, inputStyle: "box" }), sizing: { w: "fill", h: "hug" } },
            input("select", "Priority", "Priority", [0, 0, 170, 74], { options: ["Low", "Medium", "High"], defaultValue: "Medium", inputStyle: "box" }),
            input("date", "Due", "Due", [0, 0, 190, 74], { inputStyle: "box" }),
            button("Add task", [0, 0, 150, 48], {}, { submit: true, icon: "Plus" }),
          ],
        },
        tabs,
        footerBar(brand, 1200),
      ],
      { id: TASKS, access: "users", height: 1320 },
    );
    return makeDoc([home, tasksPage], makeTheme("lime"));
  },
};

