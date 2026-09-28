---
name: Craftbase
description: Design it. Store it. Share it. A no-code app builder drawn as a one-bit stack of cards.
colors:
  paper: "#ffffff"
  ink: "#000000"
  ink-soft: "#1a1a1a"
  muted: "#555555"
  faint: "#737373"
  hover-wash: "#ededed"
  hairline: "#c2c2c2"
  night-paper: "#000000"
  night-ink: "#ffffff"
  night-hover-wash: "#1f1f1f"
typography:
  display:
    fontFamily: "Pixelify Sans, Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "clamp(38px, 4.2vw, 60px)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Pixelify Sans, Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.15
  title:
    fontFamily: "Pixelify Sans, Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.15
  label:
    fontFamily: "Pixelify Sans, Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1
  body:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    fontFeature: "tnum"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.hover-wash}"
    textColor: "{colors.ink}"
  button-secondary-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 11px"
    height: "38px"
  badge:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 7px"
    height: "22px"
  badge-inverted:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  nav-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    height: "38px"
  menu-item-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  window-title-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.title}"
    height: "38px"
---

# Design System: Craftbase

## Overview

**Creative North Star: "The Shoebox of Stacks"**

Craftbase's own interface is a HyperCard stack: black ink on white paper, pages as cards, every app a stack of them lying on a dotted desk. The chrome has no hue at all. That is deliberate: the apps people build are full of colour, and a colourless builder lets their work be the only colour on screen. Greys exist only as one-bit dither patterns, or as a single flat hover wash where a pattern would fight text.

The world is dense and tool-like in the editor and calm and legible everywhere a beginner reads. Frames are drawn, not implied: 2px ink lines with small corners. Selection is shown by inversion, the way a stack highlights a button or a list row. Depth comes from hard 2px offsets on things that float and from stacked card edges on things that have pages, never from blur. Three moments of motion carry the personality: dialogs zoom out of the control that opened them as outline rectangles, canvas selections march, and the landing's cards dissolve through the dither densities.

It rejects the builder category's defaults: purple gradients, icon-tile card grids, soft-shadow SaaS chrome and kicker labels above headings.

**Key Characteristics:**
- One-bit chrome: ink (#000000) on paper (#ffffff); dark mode is the same world inverted.
- Greys only as ordered dither (12%, 25%, 50%, 75%) plus one flat hover wash.
- 2px ink frames, 4/6/8px corners, inverted selected and pressed states.
- Pixelify Sans for menus, buttons and titles; Atkinson Hyperlegible for reading; its mono for numbers.
- Pages sit as titled windows on a dithered desk; apps show their page count as card edges.
- Signature motion: zoom rects, marching ants, dither dissolve. All three leave under reduced motion.

## Colors

A strict one-bit palette: two inks, a family of greys used for text only, and dither for every surface grey.

### Primary
- **Stack Ink** (#000000): every frame, rule, icon and primary fill, the fill of anything selected, pressed or active, and the title bars of windows and dialogs. In dark mode it becomes Night Ink.

### Neutral
- **Card Paper** (#ffffff): every window, panel, field and card. The desk under the windows is paper with a 12% ink dither.
- **Soft Ink** (#1a1a1a): secondary reading text, descriptions and hints that must stay near full contrast.
- **Graphite** (#555555): quiet text such as breadcrumbs, captions and counts (7.4:1 on paper).
- **Pencil** (#737373): the faintest text and disabled labels (4.7:1 on paper); nothing quieter carries meaning.
- **Hover Wash** (#ededed): the single flat grey, used for hover backgrounds where a dither would sit under text.
- **Hairline** (#c2c2c2): disabled borders only. Live dividers are dotted ink, not grey lines.
- **Night Paper** (#000000), **Night Ink** (#ffffff), **Night Hover Wash** (#1f1f1f): the inverted world for dark mode. Dithers flip to white dots on black.

### Named Rules
**The One-Bit Rule.** Craftbase's chrome is ink and paper. Greys are dither patterns or the one hover wash; hue belongs to the apps people build (their canvas, previews, thumbnails and chosen icons) and never to Craftbase itself.

**The Inversion Rule.** Selected, pressed, active and hovered-menu states invert to ink fill with paper text. They never tint.

**The Dashed-Means-Trouble Rule.** A dashed frame or dotted underline marks something destructive, locked or wrong: delete buttons, the danger zone, invalid fields, locked canvas items. Dashes are never decoration.

## Typography

**Display Font:** Pixelify Sans (with Atkinson Hyperlegible Next, system-ui)
**Body Font:** Atkinson Hyperlegible Next (with system-ui, Segoe UI, Roboto, Arial)
**Label/Mono Font:** Atkinson Hyperlegible Mono (with ui-monospace)

**Character:** a bitmap display face gives every menu, button and title the voice of a classic stack, while Atkinson Hyperlegible, designed for low-vision readers, carries every sentence a beginner has to understand.

### Hierarchy
- **Display** (700, clamp(38px, 4.2vw, 60px), 1.05, balanced wrapping): the landing headline only.
- **Headline** (600, 36px, 1.15): page titles in the workspace; 28px on phones. Section heroes run 38px, the auth heading 30px.
- **Title** (600, 17–22px, 1.15): dialog and window title bars (17px), card-stack and database titles (22px), settings section heads (19px).
- **Label** (500, 15px; 14px small, 18px large): buttons, menus, tabs, nav items (16px), badges (13px). Always Pixelify.
- **Body** (400, 14.5px, 1.5): all reading text; landing and marketing copy at 16–18px/1.55 within 50–64ch; documents at a 70ch measure.
- **Mono** (400, 11–13px, tabular numerals): counts, sizes, zoom levels, coordinates, keycaps and web addresses. Never running text.

### Named Rules
**The Three Voices Rule.** Pixelify Sans speaks for menus, buttons and titles. Atkinson Hyperlegible Next carries everything people read. The mono appears only on counts, sizes and addresses.

**The No-Kicker Rule.** Headings carry themselves. Nothing sits above a heading except a window's own title bar.

## Layout

The workspace is a desk. On computers a 52px menu bar runs across the top (logo, colour mode, account menu), a 248px contents panel lists My apps, Templates and Explore with counts, and every page opens as a window (max 1180px) on a 12% dither desk, 28px from the bar, with 32px × 36px of inner padding. The window's title bar is the page's breadcrumb. On phones (900px and below) the menu bar collapses to a compact header with a menu button, the contents panel becomes a full-height drawer over a 50% dither scrim, and page windows sit 10px from the screen edge with 22px × 16px padding.

The landing is the same desk: a menu bar, then windows with inverted title bars stacked with 28–48px gaps. The Welcome window splits 1.2 : 1 between copy and the card-stack demo, collapsing to one column at 960px. Single-column and page-level grids use `minmax(0, 1fr)` so content can never force a page wider than the phone (checked at 320, 360 and 390px).

The editor is a tool layout: a framed top bar, a tool palette rail, a left panel (260–300px), the canvas on a dither desk, and the inspector on the right. Below 860px the panels float over the canvas; below 560px the top bar compacts to one row.

**The Desk Rule.** Pages, dialogs and cards sit on the dithered desk; the desk itself never carries text.

## Elevation & Depth

Flat by default. Only things that float cast a shadow, and it is a hard offset with zero blur: windows, dialogs, popovers, the floating canvas zoom control and cards lifted on hover. Things with pages show their depth as stacked card edges. Nothing inside a window casts a shadow.

### Shadow Vocabulary
- **Window** (`box-shadow: 2px 2px 0 #000000`): windows, dialogs and popovers.
- **Stack edge, two cards** (`box-shadow: 4px 4px 0 -2px #ffffff, 4px 4px 0 0 #000000`): an app with two pages; a third card adds the same pair at 8px.
- **Default ring** (`box-shadow: inset 0 0 0 2px #ffffff`): the primary button on hover, the classic default-button ring.
- **Focus thickening** (`box-shadow: 0 0 0 1px #000000, inset 0 0 0 1px #000000`): focused fields grow a heavier frame instead of a glow.
- **Canvas page** (`box-shadow: 0 0 0 2px #000000, 5px 5px 0 2px #000000`): the page being edited, lying on the canvas desk.

### Named Rules
**The Floating-Only Rule.** A shadow means "this floats". Framed groups inside a window stay flat.

**The Stack Edge Rule.** Depth that means "more pages" is drawn as offset card edges, at most three, never as blur.

## Shapes

Everything is drawn with a 2px ink frame (1.5px on dense inner controls, 1px in the inspector) and small corners: 4px for fields, badges, menus and nav items, 6px for buttons and segmented controls, 8px for windows, dialogs and cards. Dense inspector fields drop to 2–3px. Dividers inside windows are 1px dotted ink. Circles are kept for avatars and knobs (the rotate handle, colour-picker knobs); the six collaborator avatar styles mix circles and squares. Device mockups in Preview keep realistic hardware corners because they picture real devices.

**The Frame Rule.** If it is a control or a container, it has a visible ink frame. Borderless controls appear only inside an already-framed group: segmented controls, menus and toolbars.

## Components

### Buttons
Tactile and literal, like stack buttons.
- **Shape:** 6px corners (4px on small buttons), 2px ink frame, 36px tall (30px small, 48px large).
- **Primary:** ink fill, paper Pixelify label, 0 14px padding. Hover draws the inset paper default ring.
- **Secondary:** paper fill, ink frame and label. Hover shows the hover wash; pressing inverts it.
- **Danger:** dashed frame, inverting on hover. A quieter danger link uses a dotted underline.
- **Disabled:** Pencil label on paper with a Hairline frame.

### Chips
- **Style:** 2px ink frame, 4px corners, Pixelify label, paper fill.
- **State:** a selected filter chip inverts to ink fill with paper text.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** Card Paper.
- **Shadow Strategy:** flat at rest; app cards show stack edges for 2–3 pages and lift 2px on hover (see Elevation & Depth).
- **Border:** 2px ink frame; the picture area is split from the text by a 2px ink rule.
- **Internal Padding:** 12–14px in card footers, 22px in settings groups.

### Inputs / Fields
- **Style:** 2px ink frame, 4px corners, paper fill, 38px tall, 11px side padding.
- **Focus:** the frame thickens by 1px inside and out; no glow, no colour.
- **Error / Disabled:** an invalid field switches to a dashed frame; disabled fields use a Hairline frame and Graphite text.

### Navigation
- **Menu bar:** 52px, paper with a 2px ink bottom rule; Pixelify items that invert on hover.
- **Contents panel:** Pixelify 16px items with a Lucide icon and a mono count; the current page is an inverted row.
- **Phones:** a compact header with a menu button opens the panel as a full-height drawer.

### Windows and Dialogs
- **Title bar:** an ink band (38–40px) with a Pixelify title in paper; dialogs add a close box on the right.
- **Body:** paper, 2px frame, 8px corners, window shadow; dialogs sit on a 50% dither backdrop, no blur.
- **Opening:** four outline rectangles step from the opening control to the dialog (60ms each, 32ms apart).

### Canvas Selection (signature)
- **Selection:** marching ants, alternating ink and paper dashes that crawl at 0.6s per cycle; locked items use a still dashed outline.
- **Handles:** 9px black squares with a paper border (13px on touch screens); the rotate handle is a round paper knob.
- **Collaborators:** told apart by line and fill (solid, double, dotted, heavy, ringed, inset) with an inverted name tag, never by colour.

## Do's and Don'ts

### Do:
- **Do** draw every control and container with a 2px ink frame and 4/6/8px corners.
- **Do** show selected, pressed and active states by inverting to ink fill and paper text.
- **Do** open workspace pages as windows on the 12% dither desk, with the breadcrumb as the title bar.
- **Do** keep the apps people build in their own colours on the canvas, in previews, in thumbnails and in their chosen icons.
- **Do** set counts, sizes and addresses in the mono with tabular numerals.
- **Do** keep hover and state transitions at 120ms; only the three signature motions run longer, and reduced motion turns them off.

### Don't:
- **Don't** use hue, gradients, blurred shadows or glass anywhere in the chrome.
- **Don't** put a kicker or eyebrow label above a heading.
- **Don't** use emoji or Unicode glyphs as chrome icons; icons are Lucide line icons. An app's own chosen emoji is content, not chrome.
- **Don't** set running text in Pixelify Sans or in the mono.
- **Don't** use dashed lines for decoration; dashes mean destructive, locked or invalid.
- **Don't** give a shadow to anything that sits inside a window.
