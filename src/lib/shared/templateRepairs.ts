import type { AppDoc, El, Page } from "./types";

/**
 * Compatibility repairs for unedited parts of the bundled templates. Pure and
 * idempotent: old saved copies benefit without rewriting data or replacing a design.
 * Match the original names, content and geometry so customized content is retained.
 */
export function repairTemplateDoc(source: AppDoc, templateId?: string): AppDoc {
  if (!templateId) return source;
  const doc = structuredClone(source);
  for (const page of doc.pages) {
    for (const el of Object.values(page.elements)) {
      if (el.name === "BackButton" && el.props.icon === "ChevronLeft" && !el.props.ariaLabel) el.props.ariaLabel = "Go back";
      if (templateId === "habits" && el.name === "HeaderButton" && el.props.icon === "Plus" && !el.props.ariaLabel) el.props.ariaLabel = "Add a habit";
      if (!page.mobileCustom && el.name === "Navbar" && el.type === "box") repairNavbar(page, el);
      if (!page.mobileCustom && el.type === "shape" && el.props.shape === "ellipse" && (el.style.opacity ?? 1) <= 0.25 && !el.events?.click?.length && el.hideOn?.mobile === undefined)
        el.hideOn = { ...el.hideOn, mobile: true };
      if (templateId === "feedback" && !page.mobileCustom) {
        if (el.type === "icon" && el.props.icon === "Lightbulb" && el.box.w === 100 && el.style.opacity === 0.8 && el.hideOn?.mobile === undefined) el.hideOn = { ...el.hideOn, mobile: true };
        if (el.props.label === "All ideas" && el.events?.click?.length === 1 && el.events.click[0].type === "goBack")
          el.events.click[0] = { id: el.events.click[0].id, type: "navigate", pageId: doc.homePageId };
      }
      if (templateId === "survey" && el.props.text === "📝  2 minutes · 5 questions") el.props.text = "📝  A few quick questions";
      if (templateId === "rsvp" && el.type === "input" && el.props.name === "Message" && el.props.label === "A note for the hosts") {
        el.props.label = "Message for the guest list (public)";
        el.props.helpText = "Your name and this message will be visible on the guest list. Don't include private information. Leave this blank if you don't want to post a message.";
      }
      if (templateId === "habits") {
        repairHabitActions(el);
        if (el.props.text === "🔥 {{record.Streak}} day streak") el.props.text = "🔥 {{record.Streak}} streak · {{record.Goal}}";
        if (el.type === "input" && el.props.name === "Goal" && !el.props.helpText) el.props.helpText = "Daily and weekday streaks count scheduled days. A 3-times-a-week streak counts consecutive weeks with at least 3 check-ins (Monday–Sunday).";
      }
      if (templateId === "store") {
        if (el.props.text === "{{Qty.value}} × {{record.Name}} · {{record.Price}} each")
          el.props.text += "\nItem total: {{record.Price | multiply:Qty.value | currency:record.Price}}";
        if (el.props.text === "Demo shop: no payment is taken. By ordering you accept our shop policies.") {
          el.props.text = "Demo shop: no payment is taken. Read the shop policies before ordering.";
          const policy = doc.pages.find((p) => p.path === "policies");
          if (policy) { el.props.link = { pageId: policy.id }; el.style.underline = true; }
        }
        if (page.path === "thank-you" && Object.values(page.elements).some((e) => e.props.text === "Order reference: {{vars.orderRef}}")) page.confirmationVariable = "orderRef";
      }
      if (templateId === "coffee") {
        // The template has no cart; remove its unconfigured accessory from phone headers.
        if (el.type === "button" && el.props.icon === "ShoppingBag" && !el.props.label && !el.events?.click?.length) el.hidden = true;
        for (const action of el.events?.submit || []) {
          if (action.type === "createRecord" && action.mapping?.Drink === "{{record.id}}" && !action.saveIdTo) action.saveIdTo = "orderRef";
        }
        if (page.path === "order-placed") page.confirmationVariable = "orderRef";
      }
    }
    if (templateId === "feedback" && page.path === "roadmap" && !page.mobileCustom) repairRoadmap(page);
  }
  if (templateId === "coffee" && !doc.variables.some((v) => v.name === "orderRef")) doc.variables.push({ id: "var_orderref", name: "orderRef", type: "text", initial: "" });
  return doc;
}

function repairNavbar(page: Page, navbar: El) {
  const children = (navbar.childIds || []).map((id) => page.elements[id]);
  const logo = children.find((e) => e?.name === "Logo" && e.box.x === 48 && e.box.w === 40);
  const brand = children.find((e) => e?.name === "Brand" && e.box.x === 100 && e.box.w === 300);
  if (!logo || !brand) return;
  const id = `${navbar.id}_brand`;
  if (page.elements[id]) return;
  page.elements[id] = {
    id, name: "BrandGroup", type: "box", parentId: navbar.id, childIds: [logo.id, brand.id],
    box: { x: 48, y: 22, w: 352, h: 40 }, style: {}, sizing: { w: "fixed", h: "hug" },
    props: { layout: { mode: "row", gap: 12, padding: 0, align: "center", justify: "start", wrap: false, columns: 1 } },
  };
  for (const el of [logo, brand]) {
    el.parentId = id;
    el.box.x -= 48;
    el.box.y -= 22;
  }
  logo.sizing = { w: "fixed", h: "fixed" };
  brand.sizing = { w: "fill", h: "hug" };
  navbar.childIds = navbar.childIds!.flatMap((child) => child === logo.id ? [id] : child === brand.id ? [] : [child]);
}

function repairRoadmap(page: Page) {
  for (const list of Object.values(page.elements)) {
    if (list.parentId || list.type !== "list" || list.box.y !== 330 || list.box.w !== 360 || ![80, 460, 840].includes(list.box.x)) continue;
    const header = page.rootIds.map((id) => page.elements[id]).find((el) => el.type === "box" && el.box.x === list.box.x && el.box.y === 250 && el.box.w === 360 && el.box.h === 64);
    if (!header) continue;
    const id = `${list.id}_column`;
    if (page.elements[id]) continue;
    page.elements[id] = {
      id, name: `${list.name}Column`, type: "box", parentId: null, childIds: [header.id, list.id],
      box: { x: list.box.x, y: 250, w: 360, h: 580 }, style: {}, sizing: { w: "fixed", h: "hug" },
      props: { layout: { mode: "column", gap: 16, padding: 0, align: "stretch", justify: "start", wrap: false, columns: 1 } },
    };
    header.parentId = list.parentId = id;
    header.box = { ...header.box, x: 0, y: 0 };
    list.box = { ...list.box, x: 0, y: 80 };
    header.sizing = { w: "fill", h: "fixed" };
    list.sizing = { w: "fill", h: "hug" };
    page.rootIds = page.rootIds.flatMap((child) => child === header.id ? [id] : child === list.id ? [] : [child]);
  }
}

function repairHabitActions(el: El) {
  const actions = el.events?.click;
  if (!actions) return;
  const index = actions.findIndex((a) => a.type === "transaction" && a.steps?.length === 2 &&
    a.steps[0].kind === "create" && a.steps[0].mapping?.Habit === "{{record.id}}" && a.steps[0].mapping?.Day === "{{now.iso}}" &&
    a.steps[1].kind === "adjust" && a.steps[1].fieldName === "Streak" && a.steps[1].amount === "1");
  if (index < 0) return;
  const old = actions[index];
  actions[index] = { id: old.id, type: "habitCheckIn", collectionId: old.steps![0].collectionId, recordId: "{{record.id}}", condition: old.condition };
  el.events!.click = actions.filter((a) => !(a.type === "notify" && a.message === "Nice! Streak +1 🔥"));
}
