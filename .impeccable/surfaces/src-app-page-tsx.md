---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/(workspace)/apps/page.tsx","src/app/editor/[appId]/page.tsx"]
---

Scope: the Craftbase builder's own interface — landing, auth and simple pages, workspace (My apps, Templates, Explore, Settings, Guide), editor chrome, database view and dialogs. Apps people build keep their own themes. Mode: Operate (the landing page is Persuade inside the same world).

Audience and job: students and beginners building their first site or app, often on a phone or shared computer; they need to know where they are, what each tool does, and how to get back.

## Direction contract

THESIS: Craftbase is a shoebox of stacks: every app is a stack of cards (its pages) you browse and edit in place. It refuses the builder category's purple gradients, icon-tile card grids and soft-shadow SaaS chrome.

OWN-WORLD: #000 ink on #FFF paper with stipple-dither greys as the only shading and no hue anywhere in the chrome (user content keeps its colour). 2px black frames, 6px corners, inverted title bars and selected rows, black filled primary buttons, marching-ants selection on the canvas, 2px hard window shadows. Pixelify Sans for menus, buttons and titles; Atkinson Hyperlegible Next for text; Atkinson Hyperlegible Mono only for counts, addresses and sizes.

STORY: A beginner sees their apps as stacks on a desk, opens one, finds every tool one menu or palette away, flips between browsing and making the same card, and shares by adding people to the stack.

FIRST VIEWPORT: Landing: menu bar; a Welcome window with the pixel headline and a black "Start building" button on the left, and on the right a three-card stack (Design it / Store it / Share it) with a "1 of 3" card navigator. Workspace: menu bar, a Stack contents panel (My apps, Templates, Explore with counts), a window of app stacks whose edge depth shows their page count.

FORM: HyperCard Stack, a dealt challenger the user chose over the assigned direction; seed key b2335f05. Signature interaction: dialogs open with outline "zoom rects" from the control that opened them; canvas selections march; landing cards dissolve on flip. Everything else is instant or 120ms; reduced motion removes all three.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
