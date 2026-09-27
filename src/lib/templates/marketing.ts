/*
 * Templates: Launch page (waitlist), Survey form, Event RSVP.
 */
import type { AppTemplate } from "./index";
import { box, button, buildPage, fill, grad, icon, image, photo, shape, solid, stack, text } from "@/lib/build";
import { ACCESS, W, chartOf, featureRow, footerBar, formBox, formField, go, iconTile, inDays, makeDoc, makeTheme, navBar, recordList, recordTable, statCard, submitButton, tag, titleBlock } from "./kit";

const faqCard = (q: string, a: string) =>
  fill(
    stack(
      "column",
      [0, 0, 800, 96],
      [fill(text(q, [0, 0, 740], { fontSize: 19, fontWeight: 700 }, "h3")), fill(text(a, [0, 0, 740], { color: "$muted", fontSize: 16 }, "p"))],
      { gap: 6, padding: 22, align: "stretch" },
      { fill: solid("$background"), radius: 16, borderWidth: 1, borderColor: "$border" },
    ),
  );

/* ------------------------------------------------------------------ launch page */

export const waitlist: AppTemplate = {
  id: "waitlist",
  name: "Launch page",
  tagline: "Collect sign-ups before you launch",
  description:
    "A bold landing page with a live countdown and a waitlist form. Every sign-up is saved to your database, duplicate emails are turned away, and an admin-only page shows who joined and how they heard about you.",
  category: "Marketing",
  emoji: "🚀",
  color: "#6c47ff",
  features: ["Live countdown to launch day", "Waitlist form saved to your database", "Admin page with a chart and a table", "Duplicate emails rejected automatically"],
  collections: [
    {
      key: "signups",
      name: "Signups",
      icon: "Mail",
      access: ACCESS.inbox,
      fields: [
        { name: "Name", type: "text", required: true },
        { name: "Email", type: "email", required: true, unique: true },
        { name: "Heard from", type: "select", options: ["A friend", "Social media", "Search", "Somewhere else"] },
        { name: "Consent", type: "boolean" },
      ],
      seed: [
        { Name: "Maya Chen", Email: "maya@example.com", "Heard from": "A friend" },
        { Name: "Jordan Lee", Email: "jordan@example.com", "Heard from": "Social media" },
        { Name: "Priya Patel", Email: "priya@example.com", "Heard from": "Social media" },
        { Name: "Sam Rivera", Email: "sam@example.com", "Heard from": "Search" },
      ],
    },
  ],
  build: () => {
    const HOME = "pg_home";
    const ADMIN = "pg_signups";
    const brand = "Weekwise";
    const features = titleBlock(70, "Why people can't wait", "Three reasons to join the list today. Swap them for your own.", { eyebrow: "What you get" });
    const faqTitle = titleBlock(70, "Questions? Answers.", undefined, { size: 38 });
    const home = buildPage(
      "Home",
      "",
      [
        navBar(brand, { logo: "CalendarCheck", cta: { label: "Join the list", events: { click: [{ type: "scrollTo", targetId: "@signup" }] } } }),
        box([0, 84, W, 660], { fill: grad(160, "$surface", "$background"), overflow: "hidden" }, [
          shape("blob", [-140, 400, 440, 380], { fill: solid("$secondary"), opacity: 0.14 }),
          shape("ellipse", [1090, -80, 300, 300], { fill: solid("$accent"), opacity: 0.25 }),
          tag("🚀  Launching soon", [80, 92, 200, 34]),
          text("The calm way to plan your week", [80, 146, 580, 150], { fontSize: 60, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.08 }, "h1"),
          text("Plan, focus and finish what matters. Join the waitlist and be first in line when we open the doors.", [80, 316, 540, 64], { fontSize: 20, color: "$muted" }, "p"),
          { type: "countdown", name: "Countdown", box: { x: 80, y: 420, w: 500, h: 96 }, style: { fontSize: 36, textAlign: "left" }, props: { target: inDays(30), doneText: "We're live! 🎉" } },
          text("until launch day", [80, 528, 400, 22], { fontSize: 14, color: "$muted" }, "small"),
          formBox(
            "WaitlistForm",
            "signups",
            [720, 70, 480, 500],
            [
              fill(text("Get early access", [0, 0, 420], { fontSize: 26, fontWeight: 800 }, "h2")),
              fill(text("Be the first to know when we launch.", [0, 0, 420], { color: "$muted" }, "p")),
              formField("text", "Your name", "Name", { placeholder: "Alex Morgan", required: true }),
              formField("email", "Email", "Email", { placeholder: "alex@example.com", required: true }),
              formField("select", "How did you hear about us?", "Heard from", { options: ["A friend", "Social media", "Search", "Somewhere else"], placeholder: "Choose one" }),
              formField("toggle", "I agree that Weekwise keeps my name and email to tell me about the launch.", "Consent", { required: true }, 56),
              submitButton("Join the waitlist", {}, { icon: "ArrowRight" }),
            ],
            { success: "You're on the list, {{form.Name}}! 🎉", ref: "signup" },
          ),
        ]),
        box([0, 744, W, 500], { fill: solid("$background") }, [
          ...features.specs,
          featureRow(features.bottom + 40, [
            ["Sparkles", "Plans itself", "Drop in your to-dos and get a realistic week in seconds."],
            ["Timer", "Focus sessions", "Built-in focus timers keep you in the zone, not in your inbox."],
            ["HeartHandshake", "Kind reminders", "Gentle nudges that help you finish — never nag."],
          ]),
        ]),
        box([0, 1244, W, 600], { fill: solid("$surface") }, [
          ...faqTitle.specs,
          stack(
            "column",
            [240, faqTitle.bottom + 30, 800, 420],
            [
              faqCard("When do you launch?", "Soon! Everyone on the waitlist hears first — and gets in first."),
              faqCard("How much will it cost?", "We'll share prices before launch. Joining the list doesn't commit you to anything."),
              faqCard("Can I leave the list?", "Of course. Email us and we'll remove you straight away."),
            ],
            { gap: 12, align: "stretch" },
          ),
        ]),
        footerBar(brand, 1844),
      ],
      { id: HOME, height: 1964 },
    );
    const adminTitle = titleBlock(124, "Waitlist sign-ups", "Everyone who joined, newest first. Only you and your app admins can see this page.", { align: "left", size: 38, w: 900 });
    const admin = buildPage(
      "Sign-ups",
      "signups",
      [
        navBar(brand, { logo: "CalendarCheck" }),
        ...adminTitle.specs,
        statCard("TotalSignups", "signups", [80, 280, 350, 130], "People on the waitlist"),
        statCard("FromFriends", "signups", [80, 430, 350, 130], "Heard from a friend", { filters: [{ field: "Heard from", op: "equals", value: "A friend" }] }),
        chartOf("SourcesChart", "signups", [460, 280, 740, 280], "bar", "Heard from"),
        recordTable("SignupsTable", "signups", [80, 600, 1120, 520], [{ field: "Name" }, { field: "Email" }, { field: "Heard from" }]),
      ],
      { id: ADMIN, access: "admins", height: 1180 },
    );
    return makeDoc([home, admin], makeTheme("violet"));
  },
};

/* ------------------------------------------------------------------ survey */

export const survey: AppTemplate = {
  id: "survey",
  name: "Survey form",
  tagline: "Ask questions, see the answers add up",
  description:
    "A friendly one-page survey with ratings, choices and comments. Answers are saved to your database, people land on a thank-you page, and an admin page shows the average rating, a chart and every response.",
  category: "Forms",
  emoji: "📝",
  color: "#0ea5e9",
  features: ["Star rating, choices and comments", "Thank-you page after sending", "Average rating and a chart for admins", "Export answers from the Database tab"],
  collections: [
    {
      key: "responses",
      name: "Responses",
      icon: "ClipboardList",
      access: ACCESS.inbox,
      fields: [
        { name: "Name", type: "text" },
        { name: "Email", type: "email" },
        { name: "Rating", type: "rating", required: true, min: 1, max: 5 },
        { name: "Favourite part", type: "select", options: ["The people", "The content", "The venue", "The food"] },
        { name: "Would recommend", type: "select", options: ["Yes", "Maybe", "No"] },
        { name: "Comments", type: "longText" },
        { name: "Consent", type: "boolean" },
      ],
      seed: [
        { Name: "Ana", Rating: 5, "Favourite part": "The people", "Would recommend": "Yes", Comments: "Loved every minute. Please do it again!" },
        { Name: "Leo", Rating: 4, "Favourite part": "The content", "Would recommend": "Yes", Comments: "Great talks, a bit short on breaks." },
        { Name: "Kim", Rating: 3, "Favourite part": "The food", "Would recommend": "Maybe", Comments: "" },
        { Name: "Ravi", Rating: 5, "Favourite part": "The content", "Would recommend": "Yes", Comments: "The workshop was the highlight." },
      ],
    },
  ],
  build: () => {
    const FORM = "pg_form";
    const THANKS = "pg_thanks";
    const ADMIN = "pg_responses";
    const form = buildPage(
      "Survey",
      "",
      [
        box([0, 0, W, 300], { fill: grad(135, "$primary", "$secondary") }, [
          shape("ellipse", [980, -120, 360, 360], { fill: solid("#ffffff"), opacity: 0.12 }),
          shape("ellipse", [-80, 180, 240, 240], { fill: solid("#ffffff"), opacity: 0.1 }),
          text("📝  2 minutes · 5 questions", [340, 72, 600, 26], { color: "rgba(255,255,255,0.85)", fontSize: 16, fontWeight: 600, textAlign: "center" }, "p"),
          text("How was your experience?", [240, 106, 800, 70], { color: "#ffffff", fontSize: 50, fontWeight: 800, textAlign: "center", letterSpacing: -1 }, "h1"),
          text("Your answers help us make the next one even better.", [290, 186, 700, 30], { color: "rgba(255,255,255,0.9)", fontSize: 19, textAlign: "center" }, "p"),
        ]),
        formBox(
          "SurveyForm",
          "responses",
          [290, 250, 700, 900],
          [
            formField("rating", "How would you rate it overall?", "Rating", { required: true }),
            formField("radio", "What did you like most?", "Favourite part", { options: ["The people", "The content", "The venue", "The food"] }, 150),
            formField("select", "Would you recommend us to a friend?", "Would recommend", { options: ["Yes", "Maybe", "No"], placeholder: "Choose one" }),
            formField("textarea", "Anything else to share?", "Comments", { placeholder: "What worked, what didn't…" }),
            formField("text", "Your name (optional)", "Name", { placeholder: "Alex" }),
            formField("email", "Email (optional)", "Email", { placeholder: "you@example.com" }),
            formField("toggle", "I agree that the organisers keep my answers to improve their events.", "Consent", { required: true }, 56),
            submitButton("Send my answers", {}, { icon: "Send" }),
          ],
          { success: "", events: { submit: [go(THANKS)] }, padding: 36, gap: 18 },
        ),
        text("Your answers are private and only seen by the organisers.", [290, 1180, 700, 22], { color: "$muted", fontSize: 14, textAlign: "center" }, "small"),
      ],
      { id: FORM, height: 1260, background: solid("$surface") },
    );
    const thanks = buildPage(
      "Thank you",
      "thanks",
      [
        box([390, 150, 500, 460], { fill: solid("$background"), radius: 28, shadow: { x: 0, y: 30, blur: 70, spread: -30, color: "rgba(20,16,40,0.25)" } }, [
          box([200, 56, 100, 100], { fill: solid("$primary/12"), radius: 999 }, [icon("PartyPopper", [26, 26, 48], { color: "$primary" })]),
          text("Thank you!", [40, 184, 420, 50], { fontSize: 40, fontWeight: 800, textAlign: "center" }, "h1"),
          text("We read every answer. Have a wonderful day!", [60, 246, 380, 56], { fontSize: 18, color: "$muted", textAlign: "center" }, "p"),
          button("Send another response", [110, 340, 280, 52], {}, { icon: "RotateCcw" }, { click: [go(FORM)] }),
        ]),
      ],
      { id: THANKS, height: 760, background: solid("$surface") },
    );
    const adminTitle = titleBlock(60, "Survey results", "Only you and your app admins can see this page.", { align: "left", size: 38 });
    const admin = buildPage(
      "Results",
      "results",
      [
        ...adminTitle.specs,
        statCard("ResponsesCount", "responses", [80, 200, 350, 130], "Responses"),
        statCard("AverageRating", "responses", [80, 350, 350, 130], "Average rating", { aggregate: "avg", field: "Rating", decimals: 1, suffix: " ★" }),
        chartOf("FavouriteChart", "responses", [460, 200, 740, 280], "bar", "Favourite part"),
        recordTable("ResponsesTable", "responses", [80, 520, 1120, 520], [{ field: "Rating" }, { field: "Favourite part" }, { field: "Would recommend" }, { field: "Comments" }, { field: "Name" }]),
      ],
      { id: ADMIN, access: "admins", height: 1100 },
    );
    thanks.hideInNav = true;
    return makeDoc([form, thanks, admin], makeTheme("ocean", { buttonStyle: "pill" }));
  },
};

/* ------------------------------------------------------------------ event rsvp */

export const rsvp: AppTemplate = {
  id: "rsvp",
  name: "Event RSVP",
  tagline: "Invite people and see who's coming",
  description:
    "A beautiful invitation with the date, a countdown, a map and an RSVP form. Guests see who else is coming (emails stay private), and you get a head count, dietary needs and a full guest list on an admin page.",
  category: "Events",
  emoji: "🎉",
  color: "#f3722c",
  features: ["Countdown, schedule and map", "RSVP form with dietary needs", "Public guest list — emails stay private", "Head count and guest table for admins"],
  collections: [
    {
      key: "guests",
      name: "Guests",
      icon: "Users",
      access: ACCESS.guestbook,
      fields: [
        { name: "Name", type: "text", required: true },
        { name: "Email", type: "email", required: true, private: true },
        { name: "Coming", type: "select", options: ["Yes", "Maybe", "No"], required: true },
        { name: "Plus ones", type: "number", min: 0, max: 5, defaultValue: "0" },
        { name: "Diet", type: "select", options: ["No preference", "Vegetarian", "Vegan", "Gluten-free"], private: true },
        { name: "Message", type: "longText" },
        { name: "Consent", type: "boolean" },
      ],
      seed: [
        { Name: "Olivia", Email: "olivia@example.com", Coming: "Yes", "Plus ones": 1, Diet: "Vegetarian", Message: "Wouldn't miss it! 🥳" },
        { Name: "Noah", Email: "noah@example.com", Coming: "Yes", "Plus ones": 0, Diet: "No preference", Message: "Bringing my famous lemonade." },
        { Name: "Emma", Email: "emma@example.com", Coming: "Maybe", "Plus ones": 0, Diet: "Vegan", Message: "Will try my best!" },
        { Name: "Lucas", Email: "lucas@example.com", Coming: "Yes", "Plus ones": 2, Diet: "Gluten-free", Message: "See you there!" },
      ],
    },
  ],
  build: () => {
    const HOME = "pg_invite";
    const ADMIN = "pg_guestlist";
    const detail = (ic: string, title: string, value: string) =>
      fill(
        stack("row", [0, 0, 340, 96], [iconTile(ic, 0, 0, 52, "$primary"), stack("column", [0, 0, 240, 60], [fill(text(title, [0, 0, 240], { fontSize: 14, color: "$muted", fontWeight: 600 }, "small")), fill(text(value, [0, 0, 240], { fontSize: 18, fontWeight: 700 }, "p"))], { gap: 2, align: "stretch" }, {}, { sizing: { w: "fill", h: "hug" } })], { gap: 16, padding: 22, align: "center" }, { fill: solid("$background"), radius: 20, borderWidth: 1, borderColor: "$border" }),
      );
    const guestCard = stack(
      "row",
      [0, 0, 540, 90],
      [
        box([0, 0, 52, 52], { fill: solid("$primary"), radius: 999 }, [icon("PartyPopper", [14, 14, 24], { color: "#ffffff" })], {}, { sizing: { w: "fixed", h: "fixed" } }),
        {
          ...stack("column", [0, 0, 420, 60], [fill(text("{{record.Name}}", [0, 0, 420], { fontSize: 17, fontWeight: 700 }, "p")), fill(text("{{record.Message | default:'Coming!'}}", [0, 0, 420], { color: "$muted", fontSize: 15 }, "p"))], { gap: 2, align: "stretch" }),
          sizing: { w: "fill", h: "hug" },
        },
      ],
      { gap: 16, padding: 18, align: "center" },
      { fill: solid("$background"), radius: 18, borderWidth: 1, borderColor: "$border" },
    );
    const whoTitle = titleBlock(70, "Who's coming", "Say hi in your RSVP — your message shows up here.", { size: 38 });
    const home = buildPage(
      "Invitation",
      "",
      [
        box([0, 0, W, 640], { fill: solid("#1f130c"), overflow: "hidden" }, [
          image(photo(660, 1600, 900), [0, 0, W, 640], {}, { radius: 0, opacity: 0.6 }),
          box([0, 0, W, 640], { fill: grad(180, "rgba(20,10,5,0.2)", "rgba(20,10,5,0.85)") }, []),
          tag("You're invited ✨", [540, 150, 200, 34], "$accent"),
          text("Summer Garden Party", [140, 204, 1000, 90], { fontSize: 76, fontWeight: 800, color: "#ffffff", textAlign: "center", letterSpacing: -2, fontFamily: "$heading" }, "h1"),
          text("Good food, great music and even better company. Bring your appetite and your dancing shoes.", [290, 310, 700, 64], { fontSize: 20, color: "rgba(255,255,255,0.88)", textAlign: "center" }, "p"),
          { type: "countdown", name: "Countdown", box: { x: 340, y: 410, w: 600, h: 100 }, style: { fontSize: 40, color: "#ffffff", fill: solid("rgba(255,255,255,0.12)") }, props: { target: inDays(21, 17), doneText: "It's party time! 🎉" } },
          button("RSVP now", [540, 540, 200, 56], { fontSize: 17 }, { icon: "ArrowDown", iconPos: "right" }, { click: [{ type: "scrollTo", targetId: "@rsvp" }] }),
        ]),
        stack("grid", [80, 690, 1120, 96], [detail("CalendarDays", "When", "Saturday, 5:00 PM"), detail("MapPin", "Where", "Riverside Garden"), detail("Shirt", "Dress code", "Summer casual")], { columns: 3, mobileColumns: 1, gap: 20, align: "stretch" }),
        { type: "map", name: "Map", box: { x: 80, y: 836, w: 560, h: 500 }, style: { radius: 20 }, props: { address: "Golden Gate Park, San Francisco", mapZoom: 14 } },
        formBox(
          "RsvpForm",
          "guests",
          [680, 836, 520, 760],
          [
            fill(text("Will you join us?", [0, 0, 460], { fontSize: 26, fontWeight: 800 }, "h2")),
            formField("text", "Your name", "Name", { placeholder: "Your name", required: true }),
            formField("email", "Email", "Email", { placeholder: "you@example.com", required: true, helpText: "Only the hosts can see this." }),
            formField("radio", "Are you coming?", "Coming", { options: ["Yes", "Maybe", "No"], required: true }, 120),
            formField("number", "Bringing anyone? (plus ones)", "Plus ones", { min: 0, max: 5, defaultValue: "0" }),
            formField("select", "Food preferences", "Diet", { options: ["No preference", "Vegetarian", "Vegan", "Gluten-free"], placeholder: "Choose one" }),
            formField("textarea", "A note for the hosts", "Message", { placeholder: "Can't wait!" }, 110),
            formField("toggle", "I agree that the hosts keep my RSVP (and food preferences, if I gave any) to plan the party. My name and note appear on the guest list.", "Consent", { required: true }, 56),
            submitButton("Send my RSVP", {}, { icon: "Send" }),
          ],
          { success: "Thanks {{form.Name}} — your RSVP is in! 🎉", ref: "rsvp" },
        ),
        box([0, 1650, W, 700], { fill: solid("$surface") }, [
          ...whoTitle.specs,
          recordList("GuestList", "guests", [80, whoTitle.bottom + 36, 1120, 400], guestCard, { columns: 2, gap: 16, pageSize: 10, filters: [{ field: "Coming", op: "equals", value: "Yes" }], empty: "Be the first to RSVP!" }),
        ]),
        footerBar("Summer Garden Party", 2350, "See you there!"),
      ],
      { id: HOME, height: 2470 },
    );
    const adminTitle = titleBlock(60, "Guest list", "Head count, food needs and every RSVP. Only admins can see this page.", { align: "left", size: 38 });
    const admin = buildPage(
      "Guest list",
      "guest-list",
      [
        ...adminTitle.specs,
        statCard("Attending", "guests", [80, 200, 260, 130], "Said yes", { filters: [{ field: "Coming", op: "equals", value: "Yes" }] }),
        statCard("PlusOnes", "guests", [360, 200, 260, 130], "Plus ones", { aggregate: "sum", field: "Plus ones" }),
        statCard("Maybes", "guests", [640, 200, 260, 130], "Maybe", { filters: [{ field: "Coming", op: "equals", value: "Maybe" }] }),
        chartOf("DietChart", "guests", [920, 200, 280, 300], "donut", "Diet"),
        recordTable("GuestsTable", "guests", [80, 540, 1120, 520], [{ field: "Name" }, { field: "Email" }, { field: "Coming" }, { field: "Plus ones" }, { field: "Diet" }, { field: "Message" }]),
      ],
      { id: ADMIN, access: "admins", height: 1120 },
    );
    return makeDoc([home, admin], makeTheme("sunset"));
  },
};
