/*
 * Phone-app templates: Habit tracker, Coffee shop ordering. Screens are 390px wide.
 */
import type { AppTemplate } from "./index";
import type { ElementSpec } from "@/lib/shared/elements";
import type { MenuItem } from "@/lib/shared/types";
import { box, button, buildPage, fill, grad, icon, image, photo, solid, stack, text } from "@/lib/build";
import { ACCESS, PW, col, formBox, formField, go, makeDoc, makeTheme, notify, phoneHeader, phoneTabBar, recordList, recordTable, seedRef, statCard, submitButton, chartOf } from "./kit";

const PAD = 20;
const IW = PW - PAD * 2;
const SCREEN_H = 844;

/* ------------------------------------------------------------------ habit tracker */

export const habits: AppTemplate = {
  id: "habits",
  name: "Habit tracker",
  tagline: "Build streaks, one day at a time",
  description:
    "A phone app for building good habits. Add a habit, tap Done each day to grow your streak, and watch your progress on a chart. Everyone who signs in gets their own private habits. People can install it on their home screen.",
  category: "Productivity",
  emoji: "🔥",
  color: "#ff4d8d",
  kind: "mobile",
  features: ["Tap Done to grow a streak", "Private habits for every person", "Progress chart of your check-ins", "Installs on phones like an app"],
  collections: [
    {
      key: "habits",
      name: "Habits",
      icon: "Flame",
      access: ACCESS.personal,
      fields: [
        { name: "Name", type: "text", required: true },
        { name: "Emoji", type: "text", defaultValue: "✨" },
        { name: "Goal", type: "select", options: ["Every day", "Weekdays", "3 times a week"], defaultValue: "Every day" },
        { name: "Streak", type: "number", min: 0, defaultValue: "0", counter: true },
      ],
      seed: [
        { Name: "Drink water", Emoji: "💧", Goal: "Every day", Streak: 12 },
        { Name: "Read 10 pages", Emoji: "📚", Goal: "Every day", Streak: 5 },
        { Name: "Morning walk", Emoji: "🚶", Goal: "Weekdays", Streak: 3 },
      ],
    },
    {
      key: "checkins",
      name: "Check-ins",
      icon: "CircleCheck",
      access: ACCESS.personal,
      fields: [
        { name: "Habit", type: "reference", refCollectionId: "@col:habits" },
        { name: "Day", type: "date" },
      ],
      seed: [
        { Habit: seedRef("habits", 0), Day: "2026-09-24" },
        { Habit: seedRef("habits", 1), Day: "2026-09-24" },
        { Habit: seedRef("habits", 0), Day: "2026-09-25" },
        { Habit: seedRef("habits", 2), Day: "2026-09-25" },
        { Habit: seedRef("habits", 0), Day: "2026-09-26" },
        { Habit: seedRef("habits", 1), Day: "2026-09-26" },
        { Habit: seedRef("habits", 2), Day: "2026-09-26" },
      ],
    },
  ],
  build: () => {
    const TODAY = "pg_today";
    const NEW = "pg_new";
    const PROGRESS = "pg_progress";
    const PROFILE = "pg_profile";
    const tabs: MenuItem[] = [
      { id: "m1", label: "Today", pageId: TODAY, icon: "House" },
      { id: "m2", label: "Progress", pageId: PROGRESS, icon: "ChartColumn" },
      { id: "m3", label: "Profile", pageId: PROFILE, icon: "UserRound" },
    ];
    const habitRow = stack(
      "row",
      [0, 0, IW, 84],
      [
        text("{{record.Emoji}}", [0, 0, 52, 52], { fill: solid("$primary/12"), radius: 16, fontSize: 26, textAlign: "center", verticalAlign: "middle" }, "p", { sizing: { w: "fixed", h: "fixed" } }),
        {
          ...stack("column", [0, 0, 180, 52], [fill(text("{{record.Name}}", [0, 0, 180], { fontSize: 17, fontWeight: 700 }, "p")), fill(text("🔥 {{record.Streak}} day streak", [0, 0, 180], { fontSize: 13, color: "$muted" }, "small"))], { gap: 2, align: "stretch" }),
          sizing: { w: "fill", h: "hug" },
        },
        button("Done", [0, 0, 100, 42], { fontSize: 15, paddingX: 14 }, { icon: "Check" }, {
          click: [
            {
              type: "transaction",
              steps: [
                { id: "s1", kind: "create", collectionId: col("checkins"), mapping: { Habit: "{{record.id}}", Day: "{{now.iso}}" } },
                { id: "s2", kind: "adjust", collectionId: col("habits"), recordId: "{{record.id}}", fieldName: "Streak", amount: "1" },
              ],
            },
            notify("Nice! Streak +1 🔥"),
          ],
        }),
      ],
      { gap: 12, padding: 16, align: "center" },
      { fill: solid("$background"), radius: 20, borderWidth: 1, borderColor: "$border" },
    );
    const today = buildPage(
      "Today",
      "",
      [
        phoneHeader("Today", { icon: "Plus", iconEvents: { click: [go(NEW)] } }),
        box([PAD, 80, IW, 150], { fill: grad(135, "$primary", "$secondary"), radius: 24 }, [
          text("Hi {{user.name}} 👋", [20, 22, 300, 28], { fontSize: 22, fontWeight: 800, color: "#ffffff" }, "h2"),
          text("Small steps every day add up. Tap Done when you've done a habit.", [20, 56, 300, 44], { fontSize: 14, color: "rgba(255,255,255,0.9)" }, "p"),
          text("{{now.day}}, {{now.date}}", [20, 110, 300, 20], { fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)" }, "small"),
        ]),
        text("Your habits", [PAD, 256, 200, 26], { fontSize: 19, fontWeight: 800 }, "h2"),
        recordList("HabitList", "habits", [PAD, 292, IW, 400], habitRow, { columns: 1, gap: 10, pageSize: 20, sortField: "createdAt", sortDir: "asc", empty: "No habits yet — tap + to add your first one." }),
        phoneTabBar(tabs),
      ],
      { id: TODAY, access: "users", height: SCREEN_H },
    );
    const newHabit = buildPage(
      "New habit",
      "new",
      [
        phoneHeader("New habit", { back: true }),
        formBox(
          "HabitForm",
          "habits",
          [PAD, 84, IW, 520],
          [
            fill(text("What do you want to do more often?", [0, 0, 300], { fontSize: 18, fontWeight: 700 }, "p")),
            formField("text", "Habit", "Name", { placeholder: "e.g. Stretch for 5 minutes", required: true }),
            formField("text", "Emoji", "Emoji", { placeholder: "✨", defaultValue: "✨" }),
            formField("radio", "How often?", "Goal", { options: ["Every day", "Weekdays", "3 times a week"], defaultValue: "Every day" }, 120),
            submitButton("Add habit", {}, { icon: "Plus" }),
          ],
          { success: "Habit added! 🌱", events: { submit: [go(TODAY)] }, padding: 20, style: { borderWidth: 0, shadow: null, fill: solid("$surface") } },
        ),
      ],
      { id: NEW, access: "users", height: SCREEN_H },
    );
    const checkinRow = stack(
      "row",
      [0, 0, IW, 60],
      [icon("CircleCheckBig", [0, 0, 24], { color: "$primary" }), { ...text("{{record.Habit.Emoji}} {{record.Habit.Name}}", [0, 0, 220, 24], { fontSize: 15, fontWeight: 600 }, "p"), sizing: { w: "fill", h: "hug" } }, text("{{record.Day}}", [0, 0, 90, 20], { fontSize: 13, color: "$muted", textAlign: "right" }, "small", { sizing: { w: "hug", h: "hug" } })],
      { gap: 12, padding: 14, align: "center" },
      { fill: solid("$background"), radius: 14, borderWidth: 1, borderColor: "$border" },
    );
    const progress = buildPage(
      "Progress",
      "progress",
      [
        phoneHeader("Progress"),
        statCard("CheckinCount", "checkins", [PAD, 80, 170, 100], "Check-ins", { style: { padding: 16 } }),
        statCard("BestStreak", "habits", [PAD + 180, 80, 170, 100], "Best streak", { aggregate: "max", field: "Streak", suffix: " 🔥", style: { padding: 16 } }),
        chartOf("CheckinChart", "checkins", [PAD, 196, IW, 220], "bar", "Day"),
        text("Recent check-ins", [PAD, 440, 250, 26], { fontSize: 19, fontWeight: 800 }, "h2"),
        recordList("RecentCheckins", "checkins", [PAD, 476, IW, 280], checkinRow, { columns: 1, gap: 8, pageSize: 5, sortField: "createdAt", sortDir: "desc", empty: "Check in on the Today tab to see it here." }),
        phoneTabBar(tabs),
      ],
      { id: PROGRESS, access: "users", height: SCREEN_H },
    );
    const settingRow = (ic: string, label: string, y: number, actions?: ElementSpec["events"]): ElementSpec =>
      box([0, y, IW, 56], { cursor: actions ? "pointer" : undefined }, [icon(ic, [16, 16, 22], { color: "$primary" }), text(label, [52, 16, 220, 24], { fontSize: 16 }, "p"), icon("ChevronRight", [IW - 36, 18, 20], { color: "$muted" })], {}, { events: actions });
    const profile = buildPage(
      "Profile",
      "profile",
      [
        phoneHeader("Profile"),
        box([(PW - 96) / 2, 96, 96, 96], { fill: grad(135, "$primary", "$secondary"), radius: 999 }, [icon("UserRound", [26, 26, 44], { color: "#ffffff" })]),
        text("{{user.name}}", [PAD, 206, IW, 30], { fontSize: 22, fontWeight: 800, textAlign: "center" }, "h2"),
        text("{{user.email}}", [PAD, 238, IW, 22], { fontSize: 14, color: "$muted", textAlign: "center" }, "p"),
        box([PAD, 290, IW, 232], { fill: solid("$surface"), radius: 20 }, [
          settingRow("Plus", "Add a habit", 4, { click: [go(NEW)] }),
          settingRow("ChartColumn", "My progress", 60, { click: [go(PROGRESS)] }),
          settingRow("Bell", "Reminders (coming soon)", 116),
          settingRow("LogOut", "Sign out", 172, { click: [{ type: "signOut" }] }),
        ]),
        phoneTabBar(tabs),
      ],
      { id: PROFILE, access: "users", height: SCREEN_H },
    );
    for (const [p, ic] of [[today, "House"], [progress, "ChartColumn"], [profile, "UserRound"], [newHabit, "Plus"]] as const) p.icon = ic;
    newHabit.hideInNav = true;
    return makeDoc([today, progress, profile, newHabit], makeTheme("candy"), { kind: "mobile" });
  },
};

/* ------------------------------------------------------------------ coffee shop */

export const coffee: AppTemplate = {
  id: "coffee",
  name: "Coffee shop",
  tagline: "Order ahead, skip the line",
  description:
    "A phone app for a café: customers browse the menu, pick a size and milk, and order ahead for pickup. Orders arrive on a staff-only screen. Add drinks and prices in the Database tab. Installs on phones like an app.",
  category: "Business",
  emoji: "☕",
  color: "#9c6644",
  kind: "mobile",
  features: ["Menu with photos and prices", "Order ahead with size, milk and pickup time", "Staff screen with every order", "Installs on phones like an app"],
  collections: [
    {
      key: "drinks",
      name: "Drinks",
      icon: "Coffee",
      access: ACCESS.catalog,
      fields: [
        { name: "Name", type: "text", required: true },
        { name: "Price", type: "currency", currency: "USD" },
        { name: "Photo", type: "image" },
        { name: "Category", type: "select", options: ["Coffee", "Tea", "Treats"] },
        { name: "Description", type: "text" },
        { name: "Popular", type: "boolean" },
      ],
      seed: [
        { Name: "Flat white", Price: 4.2, Photo: photo(431, 600, 600), Category: "Coffee", Description: "Velvety milk over a double ristretto", Popular: true },
        { Name: "Cold brew", Price: 4.5, Photo: photo(766, 600, 600), Category: "Coffee", Description: "Steeped for 18 hours, smooth and sweet", Popular: true },
        { Name: "Cappuccino", Price: 3.9, Photo: photo(63, 600, 600), Category: "Coffee", Description: "Equal parts espresso, milk and foam", Popular: true },
        { Name: "Jasmine green tea", Price: 3.2, Photo: photo(225, 600, 600), Category: "Tea", Description: "Delicate, floral and calming", Popular: false },
        { Name: "Honey chai", Price: 4.0, Photo: photo(312, 600, 600), Category: "Tea", Description: "Spiced black tea with local honey", Popular: true },
        { Name: "Butter cookie", Price: 2.5, Photo: photo(835, 600, 600), Category: "Treats", Description: "Baked this morning", Popular: false },
      ],
    },
    {
      key: "orders",
      name: "Orders",
      icon: "Receipt",
      access: ACCESS.inbox,
      fields: [
        { name: "Drink", type: "reference", refCollectionId: "@col:drinks" },
        { name: "Size", type: "select", options: ["Small", "Medium", "Large"], defaultValue: "Medium" },
        { name: "Milk", type: "select", options: ["Whole", "Oat", "Almond", "No milk"], defaultValue: "Whole" },
        { name: "Name", type: "text", required: true },
        { name: "Pickup", type: "time" },
        { name: "Status", type: "select", options: ["New", "Making", "Ready"], defaultValue: "New", locked: true },
      ],
      seed: [
        { Drink: seedRef("drinks", 0), Size: "Medium", Milk: "Oat", Name: "Lena", Pickup: "08:15", Status: "Ready" },
        { Drink: seedRef("drinks", 4), Size: "Large", Milk: "Whole", Name: "Omar", Pickup: "08:30", Status: "New" },
      ],
    },
  ],
  build: () => {
    const MENU = "pg_menu";
    const DRINK = "pg_drink";
    const DONE = "pg_done";
    const VISIT = "pg_visit";
    const STAFF = "pg_staff";
    const tabs: MenuItem[] = [
      { id: "m1", label: "Menu", pageId: MENU, icon: "Coffee" },
      { id: "m2", label: "Visit us", pageId: VISIT, icon: "MapPin" },
    ];
    const popularCard = stack(
      "column",
      [0, 0, 170, 220],
      [
        { ...image("{{record.Photo}}", [0, 0, 170, 140], {}, { radius: 18 }), sizing: { w: "fill", h: "fixed" } },
        fill(text("{{record.Name}}", [0, 0, 160], { fontSize: 15, fontWeight: 700 }, "p")),
        fill(text("{{record.Price}}", [0, 0, 160], { fontSize: 14, color: "$primary", fontWeight: 800 }, "p")),
      ],
      { gap: 6, align: "stretch" },
      { cursor: "pointer" },
      { events: { click: [go(DRINK, "{{record.id}}")] } },
    );
    const drinkRow = stack(
      "row",
      [0, 0, IW, 88],
      [
        { ...image("{{record.Photo}}", [0, 0, 64, 64], {}, { radius: 14 }), sizing: { w: "fixed", h: "fixed" } },
        {
          ...stack("column", [0, 0, 200, 60], [fill(text("{{record.Name}}", [0, 0, 200], { fontSize: 16, fontWeight: 700 }, "p")), fill(text("{{record.Description}}", [0, 0, 200], { fontSize: 13, color: "$muted" }, "small"))], { gap: 2, align: "stretch" }),
          sizing: { w: "fill", h: "hug" },
        },
        text("{{record.Price}}", [0, 0, 60, 22], { fontSize: 15, fontWeight: 800, color: "$primary", textAlign: "right" }, "p", { sizing: { w: "hug", h: "hug" } }),
      ],
      { gap: 12, padding: 12, align: "center" },
      { fill: solid("$background"), radius: 18, borderWidth: 1, borderColor: "$border", cursor: "pointer" },
      { events: { click: [go(DRINK, "{{record.id}}")] } },
    );
    const menu = buildPage(
      "Menu",
      "",
      [
        phoneHeader("Bean There", { icon: "ShoppingBag" }),
        box([PAD, 80, IW, 170], { fill: solid("#2b1d14"), radius: 24, overflow: "hidden" }, [
          image(photo(42, 800, 500), [0, 0, IW, 170], {}, { radius: 0, opacity: 0.55 }),
          text("Good morning ☀️", [20, 26, 300, 22], { fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.85)" }, "p"),
          text("Your usual? Order ahead, skip the line.", [20, 52, 290, 64], { fontSize: 22, fontWeight: 800, color: "#ffffff", lineHeight: 1.2 }, "h2"),
          text("Ready in about 5 minutes", [20, 128, 300, 20], { fontSize: 13, color: "rgba(255,255,255,0.8)" }, "small"),
        ]),
        text("Popular", [PAD, 276, 200, 26], { fontSize: 19, fontWeight: 800 }, "h2"),
        recordList("PopularList", "drinks", [PAD, 312, IW, 450], popularCard, { columns: 2, mobileColumns: 2, gap: 12, pageSize: 4, sortField: "createdAt", sortDir: "asc", filters: [{ field: "Popular", op: "isTrue" }] }),
        text("Full menu", [PAD, 780, 200, 26], { fontSize: 19, fontWeight: 800 }, "h2"),
        recordList("MenuList", "drinks", [PAD, 816, IW, 600], drinkRow, { columns: 1, gap: 10, pageSize: 30, sortField: "Category", sortDir: "asc", search: true, searchPlaceholder: "Search drinks…" }),
        { ...phoneTabBar(tabs), box: { x: 0, y: 1400, w: PW, h: 68 } },
      ],
      { id: MENU, height: 1470 },
    );
    const drink = buildPage(
      "Drink",
      "drink",
      [
        phoneHeader("Order", { back: true }),
        image("{{record.Photo}}", [0, 64, PW, 280], {}, { radius: 0 }),
        text("{{record.Name}}", [PAD, 364, 260, 34], { fontSize: 26, fontWeight: 800 }, "h1"),
        text("{{record.Price}}", [PW - PAD - 100, 368, 100, 30], { fontSize: 22, fontWeight: 800, color: "$primary", textAlign: "right" }, "p"),
        text("{{record.Description}}", [PAD, 404, IW, 22], { fontSize: 15, color: "$muted" }, "p"),
        formBox(
          "OrderForm",
          null,
          [PAD, 444, IW, 560],
          [
            formField("radio", "Size", "Size", { options: ["Small", "Medium", "Large"], defaultValue: "Medium" }, 110),
            formField("select", "Milk", "Milk", { options: ["Whole", "Oat", "Almond", "No milk"], defaultValue: "Whole" }),
            formField("text", "Name for the order", "Name", { placeholder: "So we can call you", required: true }),
            formField("time", "Pickup time", "Pickup", {}),
            submitButton("Place order", {}, { icon: "Coffee" }),
          ],
          {
            success: "",
            padding: 18,
            style: { borderWidth: 0, shadow: null, fill: solid("$surface") },
            events: { submit: [{ type: "createRecord", collectionId: col("orders"), mapping: { Drink: "{{record.id}}", Status: "New" } }, go(DONE)] },
          },
        ),
      ],
      { id: DRINK, recordCollectionId: col("drinks"), height: 1060 },
    );
    const done = buildPage(
      "Order placed",
      "order-placed",
      [
        box([(PW - 120) / 2, 180, 120, 120], { fill: solid("$primary"), radius: 999 }, [icon("Coffee", [32, 32, 56], { color: "#ffffff" })]),
        text("Order placed!", [PAD, 330, IW, 40], { fontSize: 32, fontWeight: 800, textAlign: "center" }, "h1"),
        text("We're on it. We'll call your name when it's ready — usually about 5 minutes.", [PAD + 10, 382, IW - 20, 70], { fontSize: 16, color: "$muted", textAlign: "center" }, "p"),
        button("Back to the menu", [PAD, 490, IW, 54], { fontSize: 16 }, { icon: "ArrowLeft" }, { click: [go(MENU)] }),
      ],
      { id: DONE, height: SCREEN_H, background: solid("$surface") },
    );
    const infoRow = (ic: string, title: string, value: string, y: number): ElementSpec =>
      box([0, y, IW, 64], {}, [icon(ic, [16, 20, 24], { color: "$primary" }), text(title, [56, 12, 260, 20], { fontSize: 13, color: "$muted", fontWeight: 600 }, "small"), text(value, [56, 32, 260, 22], { fontSize: 16, fontWeight: 600 }, "p")]);
    const visit = buildPage(
      "Visit us",
      "visit",
      [
        phoneHeader("Visit us"),
        { type: "map", name: "Map", box: { x: PAD, y: 80, w: IW, h: 240 }, style: { radius: 20 }, props: { address: "Pike Place Market, Seattle", mapZoom: 15 } },
        box([PAD, 336, IW, 214], { fill: solid("$surface"), radius: 20 }, [
          infoRow("MapPin", "Address", "85 Pike St, Seattle", 8),
          infoRow("Clock", "Open", "Mon – Sat · 7:00 – 18:00", 76),
          infoRow("Phone", "Call", "+1 555 0123", 144),
        ]),
        button("Staff: see orders", [PAD, 572, IW, 48], { fill: { type: "none" }, color: "$muted", fontSize: 14 }, { icon: "Lock" }, { click: [go(STAFF)] }),
        phoneTabBar(tabs),
      ],
      { id: VISIT, height: SCREEN_H },
    );
    const staff = buildPage(
      "Orders",
      "staff",
      [
        phoneHeader("Orders", { back: true }),
        statCard("OpenOrders", "orders", [PAD, 80, IW, 96], "Waiting", { filters: [{ field: "Status", op: "notEquals", value: "Ready" }], style: { padding: 16 } }),
        recordTable("OrdersTable", "orders", [PAD, 196, IW, 560], [{ field: "Name" }, { field: "Drink" }, { field: "Size" }, { field: "Milk" }, { field: "Pickup" }, { field: "Status" }], { search: false }),
      ],
      { id: STAFF, access: "admins", height: SCREEN_H },
    );
    menu.icon = "Coffee";
    done.hideInNav = true;
    visit.icon = "MapPin";
    return makeDoc([menu, drink, done, visit, staff], makeTheme("earthy", { headingFont: "Fredoka", bodyFont: "Nunito", radius: 16 }), { kind: "mobile" });
  },
};
