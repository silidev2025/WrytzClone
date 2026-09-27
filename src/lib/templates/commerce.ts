/*
 * Templates: Online store (orders with stock), Restaurant (menu + reservations).
 */
import type { AppTemplate } from "./index";
import type { ElementSpec } from "@/lib/shared/elements";
import { box, button, buildPage, fill, grad, icon, image, input, photo, solid, stack, text } from "@/lib/build";
import { ACCESS, W, col, featureRow, footerBar, formBox, formField, go, makeDoc, makeTheme, navBar, recordList, recordTable, seedRef, statCard, submitButton, tag, titleBlock } from "./kit";

const dataTag = (value: string, tone = "$primary"): ElementSpec => ({
  ...text(value, [0, 0, 100, 26], { fill: solid(`${tone}/12`), color: tone, radius: 999, fontSize: 12.5, fontWeight: 700, paddingX: 10, textAlign: "center", verticalAlign: "middle" }, "small"),
  sizing: { w: "hug", h: "fixed" },
});

/* ------------------------------------------------------------------ online store */

export const onlineStore: AppTemplate = {
  id: "store",
  name: "Online store",
  tagline: "Sell products and take orders",
  description:
    "A small shop with a product grid, a page for every product and a checkout pop-up. Placing an order saves it and lowers the stock in one safe step — if something sells out, the order is stopped. Admins see every order and what's selling.",
  category: "Business",
  emoji: "🛍️",
  color: "#ff6f59",
  features: ["Product grid and product pages", "Checkout with quantity; the server checks and lowers stock", "Order price and total saved at the moment of ordering", "Shop policies page to fill in, and an orders page for admins"],
  collections: [
    {
      key: "products",
      name: "Products",
      icon: "Boxes",
      access: ACCESS.catalog,
      fields: [
        { name: "Name", type: "text", required: true },
        { name: "Price", type: "currency", required: true, currency: "USD" },
        { name: "Image", type: "image" },
        { name: "Description", type: "longText" },
        { name: "Category", type: "select", options: ["Kitchen", "Pantry", "Home"] },
        { name: "Stock", type: "number", min: 0, defaultValue: "10" },
      ],
      seed: [
        { Name: "Hand-thrown mug", Price: 28, Image: photo(30, 900, 900), Description: "Glazed stoneware, made by hand in small batches. Holds a generous 350 ml.", Category: "Kitchen", Stock: 12 },
        { Name: "Glass teapot", Price: 42, Image: photo(225, 900, 900), Description: "Heat-safe glass with a steel infuser. Watch your tea bloom.", Category: "Kitchen", Stock: 6 },
        { Name: "Wildflower honey", Price: 14, Image: photo(312, 900, 900), Description: "Raw honey from meadows nearby. Floral, golden and a little wild.", Category: "Pantry", Stock: 30 },
        { Name: "Single-origin beans", Price: 19, Image: photo(425, 900, 900), Description: "500 g of medium-roast beans with notes of cocoa and cherry.", Category: "Pantry", Stock: 25 },
        { Name: "Butter cookies", Price: 9, Image: photo(835, 900, 900), Description: "A tin of crumbly, golden cookies baked every Friday.", Category: "Pantry", Stock: 18 },
        { Name: "Oak serving board", Price: 55, Image: photo(292, 900, 900), Description: "Solid oak, oiled by hand. Big enough for a feast.", Category: "Home", Stock: 4 },
      ],
    },
    {
      key: "orders",
      name: "Orders",
      icon: "Receipt",
      access: ACCESS.inbox,
      fields: [
        { name: "Product", type: "reference", refCollectionId: "@col:products", required: true },
        { name: "Quantity", type: "number", min: 1, max: 10, defaultValue: "1", required: true },
        // filled in by the server from the product at the moment of ordering
        { name: "Unit price", type: "currency", currency: "USD", locked: true },
        { name: "Total", type: "currency", currency: "USD", locked: true },
        { name: "Name", type: "text", required: true },
        { name: "Email", type: "email", required: true },
        { name: "Address", type: "longText", required: true },
        { name: "Status", type: "select", options: ["New", "Packed", "Shipped", "Cancelled"], defaultValue: "New", locked: true },
      ],
      // every new order takes its quantity from the product's stock, or is refused
      stock: { refField: "Product", qtyField: "Quantity", stockField: "Stock", priceField: "Price", unitPriceField: "Unit price", totalField: "Total" },
      seed: [
        { Product: seedRef("products", 0), Quantity: 2, "Unit price": 28, Total: 56, Name: "Chris Wong", Email: "chris@example.com", Address: "12 Harbour St, Portland", Status: "Shipped" },
        { Product: seedRef("products", 2), Quantity: 1, "Unit price": 14, Total: 14, Name: "Dana Kim", Email: "dana@example.com", Address: "4 Elm Row, Austin", Status: "New" },
      ],
    },
  ],
  build: () => {
    const SHOP = "pg_shop";
    const PRODUCT = "pg_product";
    const THANKS = "pg_thanks";
    const ORDERS = "pg_orders";
    const POLICIES = "pg_policies";
    const brand = "Maple & Co.";
    const nav = () => navBar(brand, { logo: "ShoppingBag", cta: { label: "Shop now", pageId: SHOP } });
    const productCard = stack(
      "column",
      [0, 0, 357, 470],
      [
        { ...image("{{record.Image}}", [0, 0, 357, 340], {}, { radius: 18 }), sizing: { w: "fill", h: "fixed" } },
        stack(
          "row",
          [0, 0, 357, 30],
          [{ ...text("{{record.Name}}", [0, 0, 240, 28], { fontSize: 19, fontWeight: 700 }, "h3"), sizing: { w: "fill", h: "hug" } }, text("{{record.Price}}", [0, 0, 90, 28], { fontSize: 19, fontWeight: 800, color: "$primary", textAlign: "right" }, "p", { sizing: { w: "hug", h: "hug" } })],
          { gap: 10, align: "center" },
          {},
          { sizing: { w: "fill", h: "hug" } },
        ),
        fill(text("{{record.Description | truncate:80}}", [0, 0, 340], { fontSize: 15, color: "$muted" }, "p")),
      ],
      { gap: 10, align: "stretch" },
      { cursor: "pointer", hover: { lift: true } },
      { name: "ProductCard", events: { click: [go(PRODUCT, "{{record.id}}")] } },
    );
    const shop = buildPage(
      "Shop",
      "",
      [
        nav(),
        box([0, 84, W, 520], { fill: solid("$surface") }, [
          tag("New season collection", [80, 110, 220, 34]),
          text("Everyday things, made with care.", [80, 164, 560, 150], { fontSize: 58, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05 }, "h1"),
          text("Small-batch goods for your kitchen and home, from makers we know by name.", [80, 330, 500, 60], { fontSize: 19, color: "$muted" }, "p"),
          button("Browse the shop", [80, 416, 210, 56], { fontSize: 16 }, { icon: "ArrowDown", iconPos: "right" }, { click: [{ type: "scrollTo", targetId: "@products" }] }),
          image(photo(490, 1200, 900), [680, 50, 520, 420], {}, { radius: 28 }),
        ]),
        { ...text("Our favourites", [80, 660, 600, 50], { fontSize: 38, fontWeight: 800 }, "h2"), ref: "products" },
        recordList("Products", "products", [80, 730, 1120, 1000], productCard, { columns: 3, gap: 24, pageSize: 9, sortField: "createdAt", sortDir: "asc", search: true, searchPlaceholder: "Search the shop…" }),
        box([0, 1790, W, 340], { fill: solid("$surface") }, [
          featureRow(70, [
            ["Truck", "Delivery", "How and when we deliver is set out in our shop policies."],
            ["RefreshCw", "Returns & refunds", "How to return an item and get your money back — see our shop policies."],
            ["MessageCircle", "Questions?", "Contact us about any order. Our details are on the shop policies page."],
          ]),
        ]),
        footerBar(brand, 2130),
      ],
      { id: SHOP, height: 2250 },
    );
    const qty = { ...input("number", "Quantity", "Qty", [680, 470, 160, 74], { min: 1, max: 10, defaultValue: "1", inputStyle: "box" }), name: "Qty" };
    const product = buildPage(
      "Product",
      "product",
      [
        nav(),
        button("Back to shop", [70, 110, 190, 44], { fill: { type: "none" }, color: "$text" }, { icon: "ArrowLeft" }, { click: [go(SHOP)] }),
        image("{{record.Image}}", [80, 170, 540, 540], {}, { radius: 28 }),
        stack("row", [680, 180, 400, 28], [dataTag("{{record.Category}}")], { gap: 8 }),
        text("{{record.Name}}", [680, 222, 520, 60], { fontSize: 44, fontWeight: 800, letterSpacing: -1 }, "h1", { sizing: { w: "fixed", h: "hug" } }),
        text("{{record.Price}}", [680, 300, 300, 40], { fontSize: 30, fontWeight: 800, color: "$primary" }, "p"),
        text("{{record.Description}}", [680, 356, 500, 80], { fontSize: 18, color: "$muted", lineHeight: 1.6 }, "p"),
        qty,
        text("{{record.Stock}} in stock", [860, 510, 200, 24], { fontSize: 15, color: "$muted", fontWeight: 600 }, "p"),
        button("Buy now", [680, 574, 340, 58], { fontSize: 17 }, { icon: "ShoppingBag" }, { click: [{ type: "openDialog", targetId: "@checkout" }] }),
        stack(
          "column",
          [680, 656, 480, 80],
          [fill(text("🚚  Delivery, returns and refunds: read our shop policies", [0, 0, 480], { fontSize: 15, underline: true, cursor: "pointer" }, "p", { events: { click: [go(POLICIES)] } }))],
          { gap: 6, align: "stretch" },
        ),
        {
          type: "dialog",
          name: "CheckoutDialog",
          ref: "checkout",
          box: { x: 390, y: 180, w: 500, h: 640 },
          props: { title: "", closeOnBackdrop: true, layout: { mode: "column", gap: 0, padding: 0, align: "stretch", justify: "start", wrap: false, columns: 1 } },
          children: [
            formBox(
              "CheckoutForm",
              null,
              [0, 0, 500, 640],
              [
                fill(text("Checkout", [0, 0, 440], { fontSize: 28, fontWeight: 800 }, "h2")),
                fill(text("{{Qty.value}} × {{record.Name}} · {{record.Price}} each", [0, 0, 440], { fontSize: 16, color: "$muted" }, "p")),
                formField("text", "Full name", "Name", { placeholder: "Your name", required: true }),
                formField("email", "Email", "Email", { placeholder: "So we can reach you about your order", required: true }),
                formField("textarea", "Delivery address", "Address", { placeholder: "Street, city, postcode", required: true }, 110),
                submitButton("Place order", {}, { icon: "Lock" }),
                fill(text("Demo shop: no payment is taken. By ordering you accept our shop policies.", [0, 0, 440], { fontSize: 13, color: "$muted", textAlign: "center" }, "small")),
              ],
              {
                success: "",
                style: { borderWidth: 0, shadow: null },
                events: {
                  // the server checks and lowers the stock and records the price (see the Orders collection's stock rule)
                  submit: [
                    { type: "createRecord", collectionId: col("orders"), mapping: { Product: "{{record.id}}", Quantity: "{{Qty.value}}" }, saveIdTo: "orderRef" },
                    { type: "closeDialog" },
                    go(THANKS),
                  ],
                },
              },
            ),
          ],
        },
        footerBar(brand, 820),
      ],
      { id: PRODUCT, recordCollectionId: col("products"), height: 940 },
    );
    const thanks = buildPage(
      "Thank you",
      "thank-you",
      [
        nav(),
        box([390, 170, 500, 420], { fill: solid("$surface"), radius: 28 }, [
          box([200, 50, 100, 100], { fill: solid("$primary"), radius: 999 }, [icon("Check", [28, 28, 44], { color: "#ffffff" })]),
          text("Order placed!", [40, 170, 420, 50], { fontSize: 38, fontWeight: 800, textAlign: "center" }, "h1"),
          text("Order reference: {{vars.orderRef}}", [40, 226, 420, 26], { fontSize: 16, fontWeight: 700, textAlign: "center" }, "p"),
          text("Keep this reference. We'll contact you using the details you gave us.", [60, 260, 380, 50], { fontSize: 16, color: "$muted", textAlign: "center" }, "p"),
          button("Keep shopping", [140, 334, 220, 52], {}, { icon: "ArrowLeft" }, { click: [go(SHOP)] }),
        ]),
      ],
      { id: THANKS, height: 700 },
    );
    const policyTitle = titleBlock(130, "Shop policies", "Replace every part in brackets with your real terms before you start selling.", { size: 44, w: 800 });
    const policy = (y: number, title: string, body: string): ElementSpec[] => [
      text(title, [240, y, 800, 32], { fontSize: 24, fontWeight: 800 }, "h2"),
      text(body, [240, y + 44, 800, 80], { fontSize: 17, lineHeight: 1.7, color: "$muted" }, "p", { sizing: { w: "fixed", h: "hug" } }),
    ];
    const policies = buildPage(
      "Shop policies",
      "policies",
      [
        nav(),
        ...policyTitle.specs,
        ...policy(330, "Who we are", "[Your business name, registered address, business registration number and how to contact you.]"),
        ...policy(470, "Prices and payment", "[Which currency prices are in, what is included (taxes, delivery), and how and when customers pay.]"),
        ...policy(610, "Delivery", "[Where you deliver, how long it usually takes, and what it costs.]"),
        ...policy(750, "Returns, refunds and cancellations", "[How long customers have to return or cancel, the condition items must be in, how refunds are paid and how long they take. Your policy can't take away rights customers have under the law.]"),
        ...policy(910, "Questions and complaints", "[How to reach you about an order, how quickly you reply, and where customers can go if a complaint isn't resolved.]"),
        footerBar(brand, 1080),
      ],
      { id: POLICIES, height: 1200 },
    );
    const ordersTitle = titleBlock(120, "Orders", "Every order, newest first. Change the status in the Database tab as you pack and ship.", { align: "left", size: 38 });
    const orders = buildPage(
      "Orders",
      "orders",
      [
        nav(),
        ...ordersTitle.specs,
        statCard("OrderCount", "orders", [80, 270, 260, 120], "Orders"),
        statCard("ItemsSold", "orders", [360, 270, 260, 120], "Items sold", { aggregate: "sum", field: "Quantity" }),
        statCard("Revenue", "orders", [640, 270, 260, 120], "Order value", { aggregate: "sum", field: "Total", prefix: "$", decimals: 2 }),
        statCard("ToShip", "orders", [920, 270, 280, 120], "Waiting to ship", { filters: [{ field: "Status", op: "equals", value: "New" }] }),
        recordTable("OrdersTable", "orders", [80, 430, 1120, 520], [{ field: "Product" }, { field: "Quantity" }, { field: "Total" }, { field: "Name" }, { field: "Email" }, { field: "Address" }, { field: "Status" }]),
      ],
      { id: ORDERS, access: "admins", height: 1020 },
    );
    thanks.hideInNav = true;
    return makeDoc([shop, product, policies, thanks, orders], makeTheme("coral", { buttonStyle: "pill" }), {
      variables: [{ id: "var_orderref", name: "orderRef", type: "text", initial: "" }],
    });
  },
};

/* ------------------------------------------------------------------ restaurant */

export const restaurant: AppTemplate = {
  id: "restaurant",
  name: "Restaurant",
  tagline: "Menu, opening hours and bookings",
  description:
    "A warm restaurant site with a full-screen welcome, a tabbed menu that fills itself from your database, opening hours with a map and a table-booking form. Reservations arrive in an admin-only list, sorted by date.",
  category: "Business",
  emoji: "🍝",
  color: "#a3361f",
  features: ["Tabbed menu: starters, mains, desserts, drinks", "Table booking with date, time and guests", "Opening hours and a map", "Reservations list for staff"],
  collections: [
    {
      key: "dishes",
      name: "Menu",
      icon: "Utensils",
      access: ACCESS.catalog,
      fields: [
        { name: "Name", type: "text", required: true },
        { name: "Description", type: "text" },
        { name: "Price", type: "currency", currency: "EUR" },
        { name: "Course", type: "select", options: ["Starters", "Mains", "Desserts", "Drinks"], required: true },
        { name: "Photo", type: "image" },
        { name: "Vegetarian", type: "boolean" },
      ],
      seed: [
        { Name: "Burrata & heirloom tomatoes", Description: "Basil oil, sea salt, grilled sourdough", Price: 12, Course: "Starters", Photo: photo(1080, 800, 600), Vegetarian: true },
        { Name: "Crispy calamari", Description: "Lemon aioli, chilli, parsley", Price: 11, Course: "Starters", Photo: photo(488, 800, 600), Vegetarian: false },
        { Name: "Tagliatelle al ragù", Description: "Slow-cooked beef and pork, parmesan", Price: 19, Course: "Mains", Photo: photo(292, 800, 600), Vegetarian: false },
        { Name: "Wild mushroom risotto", Description: "Porcini, thyme, aged pecorino", Price: 18, Course: "Mains", Photo: photo(490, 800, 600), Vegetarian: true },
        { Name: "Sea bass al forno", Description: "Roasted fennel, olives, salsa verde", Price: 24, Course: "Mains", Photo: photo(429, 800, 600), Vegetarian: false },
        { Name: "Tiramisù", Description: "Espresso, mascarpone, cocoa", Price: 8, Course: "Desserts", Photo: photo(431, 800, 600), Vegetarian: true },
        { Name: "Lemon olive-oil cake", Description: "Crème fraîche, candied peel", Price: 7, Course: "Desserts", Photo: photo(493, 800, 600), Vegetarian: true },
        { Name: "Negroni", Description: "Gin, vermouth, bitter", Price: 10, Course: "Drinks", Photo: photo(75, 800, 600), Vegetarian: true },
        { Name: "House red, glass", Description: "Montepulciano d'Abruzzo", Price: 7, Course: "Drinks", Photo: photo(75, 800, 600), Vegetarian: true },
      ],
    },
    {
      key: "reservations",
      name: "Reservations",
      icon: "CalendarDays",
      access: ACCESS.inbox,
      fields: [
        { name: "Name", type: "text", required: true },
        { name: "Email", type: "email", required: true },
        { name: "Phone", type: "phone" },
        { name: "Date", type: "date", required: true },
        { name: "Time", type: "time", required: true },
        { name: "Guests", type: "number", min: 1, max: 12, required: true, defaultValue: "2" },
        { name: "Notes", type: "longText" },
      ],
      seed: [
        { Name: "Giulia R.", Email: "giulia@example.com", Phone: "+1 555 0101", Date: "2026-10-03", Time: "19:30", Guests: 4, Notes: "Birthday — a candle on dessert would be lovely!" },
        { Name: "Mark T.", Email: "mark@example.com", Phone: "+1 555 0144", Date: "2026-10-04", Time: "20:00", Guests: 2, Notes: "" },
      ],
    },
  ],
  build: () => {
    const HOME = "pg_home";
    const MENU = "pg_menu";
    const BOOK = "pg_book";
    const RES = "pg_reservations";
    const brand = "Casa Olivo";
    const nav = () => navBar(brand, { logo: "ChefHat", cta: { label: "Book a table", pageId: BOOK } });
    const dishRow = stack(
      "row",
      [0, 0, 540, 110],
      [
        { ...image("{{record.Photo}}", [0, 0, 96, 96], {}, { radius: 16 }), sizing: { w: "fixed", h: "fixed" } },
        {
          ...stack(
            "column",
            [0, 0, 400, 90],
            [
              stack("row", [0, 0, 400, 28], [{ ...text("{{record.Name}}", [0, 0, 300, 26], { fontSize: 18, fontWeight: 700, fontFamily: "$heading" }, "h3"), sizing: { w: "fill", h: "hug" } }, text("{{record.Price}}", [0, 0, 70, 26], { fontSize: 17, fontWeight: 800, color: "$primary", textAlign: "right" }, "p", { sizing: { w: "hug", h: "hug" } })], { gap: 10, align: "center" }, {}, { sizing: { w: "fill", h: "hug" } }),
              fill(text("{{record.Description}}", [0, 0, 400], { fontSize: 15, color: "$muted" }, "p")),
            ],
            { gap: 4, align: "stretch", justify: "center" },
          ),
          sizing: { w: "fill", h: "hug" },
        },
      ],
      { gap: 16, padding: 8, align: "center" },
    );
    const courseList = (course: string, y = 0, h = 560): ElementSpec =>
      recordList(`${course}List`, "dishes", [0, y, 1120, h], dishRow, { columns: 2, gap: 18, pageSize: 20, sortField: "createdAt", sortDir: "asc", filters: [{ field: "Course", op: "equals", value: course }] });
    const courses = ["Starters", "Mains", "Desserts", "Drinks"];
    const home = buildPage(
      "Home",
      "",
      [
        nav(),
        box([0, 84, W, 640], { fill: solid("#1c1410"), overflow: "hidden" }, [
          image(photo(513, 1600, 1000), [0, 0, W, 640], {}, { radius: 0, opacity: 0.55 }),
          box([0, 0, W, 640], { fill: grad(90, "rgba(20,12,8,0.85)", "rgba(20,12,8,0.1)") }, []),
          text("Since 1998 · Trattoria", [80, 170, 400, 26], { fontSize: 16, fontWeight: 700, letterSpacing: 3, color: "$accent", textTransform: "uppercase" }, "small"),
          text("Seasonal Italian, cooked with love.", [80, 210, 640, 180], { fontSize: 66, fontWeight: 800, color: "#ffffff", lineHeight: 1.05, fontFamily: "$heading" }, "h1"),
          text("Fresh pasta every morning, wine from small vineyards and a table waiting for you.", [80, 404, 520, 60], { fontSize: 19, color: "rgba(255,255,255,0.85)" }, "p"),
          stack("row", [80, 500, 520, 56], [button("Book a table", [0, 0, 200, 56], { fontSize: 16 }, { icon: "CalendarDays" }, { click: [go(BOOK)] }), button("See the menu", [0, 0, 190, 56], { fill: { type: "none" }, color: "#ffffff", borderWidth: 2, borderColor: "#ffffff", fontSize: 16 }, {}, { click: [go(MENU)] })], { gap: 14, align: "center" }),
        ]),
        image(photo(490, 900, 900), [80, 800, 520, 460], {}, { radius: 28 }),
        text("Our story", [680, 840, 400, 26], { fontSize: 15, fontWeight: 800, letterSpacing: 3, color: "$primary", textTransform: "uppercase" }, "small"),
        text("A little corner of Italy, around the corner.", [680, 876, 520, 120], { fontSize: 40, fontWeight: 800, lineHeight: 1.15, fontFamily: "$heading" }, "h2"),
        text("Nonna Rosa opened Casa Olivo with six tables and one rule: cook what's in season, and cook it well. Twenty-five years later we still make every sheet of pasta by hand.", [680, 1010, 500, 120], { fontSize: 18, color: "$muted", lineHeight: 1.65 }, "p"),
        button("Read the menu", [680, 1160, 190, 52], {}, { icon: "ArrowRight", iconPos: "right" }, { click: [go(MENU)] }),
        box([0, 1340, W, 700], { fill: solid("$surface") }, [
          text("From our kitchen", [80, 80, 700, 50], { fontSize: 40, fontWeight: 800, fontFamily: "$heading" }, "h2"),
          text("A taste of this week's mains.", [80, 140, 600, 28], { fontSize: 18, color: "$muted" }, "p"),
          { ...courseList("Mains", 200, 420), box: { x: 80, y: 200, w: 1120, h: 420 } },
        ]),
        box([80, 2100, 520, 360], { fill: solid("$background"), radius: 24, borderWidth: 1, borderColor: "$border" }, [
          text("Opening hours", [36, 36, 400, 34], { fontSize: 26, fontWeight: 800, fontFamily: "$heading" }, "h3"),
          text("Tuesday – Friday     12:00 – 22:30\nSaturday     11:30 – 23:00\nSunday     11:30 – 21:00\nMonday     closed", [36, 90, 440, 140], { fontSize: 17, lineHeight: 2 }, "p"),
          text("📍  Via Roma 12, Old Town  ·  ☎  +1 555 0199", [36, 280, 460, 26], { fontSize: 15, color: "$muted", fontWeight: 600 }, "p"),
        ]),
        { type: "map", name: "Map", box: { x: 640, y: 2100, w: 560, h: 360 }, style: { radius: 24 }, props: { address: "Trastevere, Rome", mapZoom: 15 } },
        footerBar(brand, 2540, "Buon appetito!"),
      ],
      { id: HOME, height: 2660 },
    );
    const menuTitle = titleBlock(130, "Our menu", "Everything is made in-house. Ask us about allergies — we're happy to help.", { size: 50 });
    const menu = buildPage(
      "Menu",
      "menu",
      [
        nav(),
        ...menuTitle.specs,
        {
          type: "tabs",
          name: "CourseTabs",
          box: { x: 80, y: 320, w: 1120, h: 700 },
          props: { tabs: courses.map((c, i) => ({ id: `tab${i}`, label: c })), activeTab: 0, variant: "pills" },
          style: { fontSize: 17 },
          children: courses.map((c) => ({ type: "box" as const, name: `${c}Panel`, box: { x: 0, y: 0, w: 1120, h: 640 }, children: [{ ...courseList(c, 24, 580), box: { x: 0, y: 24, w: 1120, h: 580 } }] })),
        },
        footerBar(brand, 1100, "Buon appetito!"),
      ],
      { id: MENU, height: 1220 },
    );
    const bookTitle = titleBlock(0, "Book a table", "Send a request and we'll contact you to confirm it. We use your details only for your booking.", { align: "left", size: 46, w: 440 });
    const book = buildPage(
      "Book a table",
      "book",
      [
        nav(),
        ...bookTitle.specs.map((s) => ({ ...s, box: { ...s.box, x: 80, y: (s.box?.y ?? 0) + 160 } })),
        image(photo(42, 900, 700), [80, 330, 440, 330], {}, { radius: 24 }),
        text("Groups over 12? Call us on +1 555 0199 and we'll set up something special.", [80, 690, 440, 56], { fontSize: 16, color: "$muted" }, "p"),
        formBox(
          "BookingForm",
          "reservations",
          [600, 140, 600, 820],
          [
            formField("text", "Name", "Name", { placeholder: "Your name", required: true }),
            formField("email", "Email", "Email", { placeholder: "you@example.com", required: true }),
            formField("phone", "Phone", "Phone", { placeholder: "+1 555 000 0000" }),
            stack("row", [0, 0, 540, 74], [{ ...formField("date", "Date", "Date", { required: true }), sizing: { w: "fill", h: "hug" } }, { ...formField("time", "Time", "Time", { required: true }), sizing: { w: "fill", h: "hug" } }], { gap: 12, align: "start" }, {}, { sizing: { w: "fill", h: "hug" } }),
            formField("number", "Guests", "Guests", { min: 1, max: 12, defaultValue: "2", required: true }),
            formField("textarea", "Anything we should know?", "Notes", { placeholder: "Allergies, a birthday, a high chair…" }, 110),
            submitButton("Request my table", {}, { icon: "CalendarCheck" }),
          ],
          { success: "Thank you {{form.Name}}! We'll contact you to confirm your table." },
        ),
        footerBar(brand, 1040, "Buon appetito!"),
      ],
      { id: BOOK, height: 1160 },
    );
    const resTitle = titleBlock(120, "Reservations", "Upcoming bookings, soonest first. Only staff (app admins) can see this page.", { align: "left", size: 38 });
    const reservations = buildPage(
      "Reservations",
      "reservations",
      [
        nav(),
        ...resTitle.specs,
        statCard("Bookings", "reservations", [80, 270, 260, 120], "Bookings"),
        statCard("Covers", "reservations", [360, 270, 260, 120], "Guests expected", { aggregate: "sum", field: "Guests" }),
        recordTable("ReservationsTable", "reservations", [80, 430, 1120, 520], [{ field: "Date" }, { field: "Time" }, { field: "Name" }, { field: "Guests" }, { field: "Phone" }, { field: "Notes" }], { sortField: "Date", sortDir: "asc" }),
      ],
      { id: RES, access: "admins", height: 1020 },
    );
    return makeDoc(
      [home, menu, book, reservations],
      makeTheme("earthy", { colors: { primary: "#a3361f", secondary: "#5c3d2e", accent: "#e0a458", background: "#fffaf4", surface: "#f7eee3" }, headingFont: "Playfair Display", bodyFont: "Lato" }),
    );
  },
};
