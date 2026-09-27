export interface GuideTopic {
  id: string;
  icon: string;
  title: string;
  sub: string;
  /** steps may use `code` */
  steps: string[];
}

export const GUIDE: GuideTopic[] = [
  {
    id: "start",
    icon: "Rocket",
    title: "Create an app",
    sub: "Start from a blank canvas or a ready-made template.",
    steps: [
      "Open **My apps** and choose **Create new app**. Give it a name and pick *Blank canvas* or a template.",
      "Templates are complete, working apps — pages, a database and buttons are already connected. Use **Preview** to see how they work, then change anything.",
      "The editor has three areas: the **left panel** (add things, layers, pages, theme, data), the **canvas** in the middle, and the **inspector** on the right for whatever you selected.",
      "Your work saves automatically. Watch the save status next to the undo buttons, or press `Ctrl+S` to save right away.",
    ],
  },
  {
    id: "elements",
    icon: "Plus",
    title: "Add text, buttons, images and more",
    sub: "Drag anything from the Add panel onto the page.",
    steps: [
      "Open **Add** in the left panel. Drag an element onto the canvas, or click it to drop it in the middle of your view.",
      "The **Text** tab has ready-made heading, subheading and body styles, plus font pairings you can drop in with one click.",
      "The **Media** tab has free photos, icons, emoji stickers and your own uploads. Drag an image onto an image element to swap it.",
      "Select a container (like a Card or Row) before clicking an element to put the new element inside it.",
    ],
  },
  {
    id: "arrange",
    icon: "Move",
    title: "Move, resize and arrange",
    sub: "Smart guides, snapping, alignment and layers — like Figma.",
    steps: [
      "Drag to move. Pink **smart guides** appear when edges or centres line up, and elements snap into place. Hold `Alt` while dragging to turn snapping off.",
      "Drag a corner or edge handle to resize. Hold `Shift` to keep the proportions. Use the round handle above an element to rotate it.",
      "Arrow keys nudge by 1px, `Shift` + arrow by 10px.",
      "Select several elements by `Shift`-clicking or dragging a box around them, then use the **Align** buttons in the inspector to line them up or space them evenly.",
      "`Ctrl+G` groups a selection into a box; `Ctrl+Shift+G` ungroups. Right-click anything for layering (bring forward / send backward), locking, hiding and more.",
    ],
  },
  {
    id: "design",
    icon: "Palette",
    title: "Style anything",
    sub: "Colours, gradients, fonts, borders, shadows, effects and animations.",
    steps: [
      "Select an element and open the **Design** tab. Change the fill (solid colour, gradient or image), corners, border, shadow and opacity.",
      "Text has font, size, weight, spacing, alignment, highlight, outline and shadow options.",
      "Images can be masked into circles, blobs, stars and more, zoomed and repositioned, and adjusted with brightness, contrast and filters.",
      "**Hover** effects make buttons and cards react when visitors point at them. **Animate** adds entrance effects that play when the page opens or when the element scrolls into view.",
      "Copy a style with `Ctrl+Alt+C` and paste it onto another element with `Ctrl+Alt+V`.",
    ],
  },
  {
    id: "theme",
    icon: "SwatchBook",
    title: "App theme (your brand kit)",
    sub: "One place for colours, fonts and corner style.",
    steps: [
      "Open **Theme** in the left panel. Pick a ready-made style or set your own primary, secondary, background and text colours.",
      "Choose a heading font and a body font, a corner roundness and a button style (filled, soft, outline or pill).",
      "Colours picked from the **Theme** row of any colour picker stay linked: change the theme later and everything using it updates.",
    ],
  },
  {
    id: "layout",
    icon: "LayoutGrid",
    title: "Boxes, rows, columns and grids",
    sub: "Group content and let it arrange itself.",
    steps: [
      "A **Box** holds elements anywhere you place them — great for cards and sections.",
      "**Row**, **Column** and **Grid** arrange their children automatically, with a gap and padding you control. Add or remove children and everything re-flows.",
      "Inside a Row or Column, each child can be *Fixed* size, *Hug* its content, or *Fill* the space left.",
      "**Scroll area** keeps a lot of content inside a fixed-size frame that scrolls.",
    ],
  },
  {
    id: "pages",
    icon: "Files",
    title: "Pages and navigation",
    sub: "Build multi-page apps with menus and links.",
    steps: [
      "Open **Pages** to add, rename, duplicate, reorder or delete pages. Use the page switcher at the top of the editor to jump between them.",
      "Add a **Navigation menu** — it lists your pages automatically, or you can choose the items yourself. On phones it becomes a tidy menu button.",
      "To link a button to a page, select it, open **Events**, and add **Go to page**.",
      "A page can show a single record (a *detail page*). In page settings choose *Shows one record from*, then send visitors there from a list with **Go to page** and *pass this record*.",
    ],
  },
  {
    id: "devices",
    icon: "Smartphone",
    title: "Phones, tablets and desktops",
    sub: "Design once, fine-tune for phones.",
    steps: [
      "Switch between **Desktop** and **Mobile** at the top of the editor. Content and styles are shared; positions and sizes can differ per device.",
      "Until you change it, the mobile layout arranges itself automatically, top to bottom. Move or resize something on mobile and that arrangement becomes yours to edit.",
      "Use **Hide on mobile** / **Hide on desktop** in the Design tab for device-only content. **Reset mobile layout** brings back the automatic arrangement.",
      "In **Preview**, try the desktop, tablet and phone sizes before you publish.",
    ],
  },
  {
    id: "data",
    icon: "Database",
    title: "Your database",
    sub: "Collections, fields and records — like a spreadsheet.",
    steps: [
      "Click **Database** at the top of the editor. A *collection* is a table, such as Tasks, Orders or Subscribers.",
      "Each column is a *field* with a type: text, number, money, yes/no, date, email, single or multiple choice, image, file, link to another record, rating and more.",
      "Click a cell to edit it. Add rows and fields with the + buttons, search and sort from the toolbar, and import or export CSV files.",
      "Open **Access** to choose who can see, add, edit and delete rows — anyone, signed-in users, only the person who added it, or admins. Presets cover the common cases.",
      "Mark a field **Private** so visitors never see it unless they're an admin or added that row themselves.",
    ],
  },
  {
    id: "show-data",
    icon: "LayoutList",
    title: "Show data on a page",
    sub: "Repeating lists, tables, stats and charts.",
    steps: [
      "Add a **Repeating list**, open its **Data** tab and choose a collection. The first card inside repeats once for every record.",
      "Inside the card, text like `{{record.Title}}` shows that record's value. Use **Insert data** in the Content tab so you never have to type it.",
      "Filter (for example *Status is Done*), sort, and set how many records appear per page. Turn on **Search** to give visitors a search bar.",
      "Filters can use inputs too — for example `{{CategoryPicker.value}}` makes a dropdown filter the list.",
      "**Table**, **Stat card** and **Charts** connect the same way to count, total and visualise your records.",
    ],
  },
  {
    id: "forms",
    icon: "ClipboardList",
    title: "Forms that save to your database",
    sub: "Collect sign-ups, orders, feedback and more.",
    steps: [
      "Add a **Form**. In its **Data** tab, choose which collection submissions are saved to — or click **Create a collection from this form** to make one that matches.",
      "Each input's *Field name* decides which column its answer goes into. Mark inputs **Required** to make them compulsory.",
      "Buttons inside a form submit it. After saving, the form shows your success message and clears. Add more steps in the form's **Events** tab (for example, go to a thank-you page).",
      "Want the fastest start? Select a Form and use **Generate inputs from collection**.",
    ],
  },
  {
    id: "logic",
    icon: "Zap",
    title: "Actions, conditions and variables",
    sub: "Make buttons and inputs do things.",
    steps: [
      "Select a button (or image, card, input…) and open **Events**. Add actions in the order they should run: go to a page, show a message, open a pop-up, save or update a record, change a variable and more.",
      "Turn on **Only if…** to run an action only when a condition is true, for example *`{{Qty.value}}` is greater than 0*.",
      "Create **Variables** (text, number or yes/no) to remember things while someone uses your app. Show them with `{{vars.score}}` and change them with **Set variable**.",
      "Everything a binding can read: `{{vars.name}}`, `{{InputName.value}}`, `{{record.Field}}`, `{{user.name}}`, `{{user.email}}`, `{{page.params.id}}` and `{{now.date}}`. Add formatting with a pipe: `{{record.Price | currency}}`.",
    ],
  },
  {
    id: "popups",
    icon: "AppWindow",
    title: "Pop-ups and tabs",
    sub: "Show more without leaving the page.",
    steps: [
      "Add a **Pop-up**. It's hidden until a button runs **Open pop-up**. Buttons inside it can **Close pop-up**.",
      "While designing, a pop-up is visible only when it (or something inside it) is selected. Use **Show pop-ups** in Layers to see them all.",
      "Add **Tabs** to switch between panels. Click a tab label on the canvas to design that panel.",
    ],
  },
  {
    id: "users",
    icon: "Users",
    title: "Sign-in, users and admins",
    sub: "Private pages, personal data and admin tools.",
    steps: [
      "In **Pages**, set a page's access to *Everyone*, *Signed-in users* or *Admins*. Visitors who aren't allowed are asked to sign in.",
      "Visitors sign in with a free account and choose whether to share their name and email with your app. Buttons can run **Sign in** and **Sign out**, and text can greet them with `{{user.name}}`.",
      "Invite admins with a link from **Publish → App admins** (it works once and expires in 7 days). Admins can open admin pages and manage all records.",
      "For personal data (like a to-do list), use the *Personal data* access preset so each person only sees their own rows.",
    ],
  },
  {
    id: "publish",
    icon: "Globe",
    title: "Preview, publish and share",
    sub: "Put your app on the web with its own link.",
    steps: [
      "**Preview** runs your draft exactly like the real app, using your real database. Only you can open it.",
      "**Publish** gives your app a public link. Choose the link name, add a description, and optionally list it in **Explore**.",
      "Keep editing after publishing — visitors see the last published version until you click **Publish update**.",
      "**Versions** saves named snapshots of your design so you can go back to them (your 50 most recent are kept). **Unpublish** takes the link offline without deleting data. Database changes — rows, fields and access rules — are live as soon as you make them.",
    ],
  },
  {
    id: "keys",
    icon: "Keyboard",
    title: "Keyboard shortcuts",
    sub: "Work faster on a computer.",
    steps: [
      "`Ctrl+Z` undo · `Ctrl+Shift+Z` redo · `Ctrl+S` save · `Delete` remove selection",
      "`Ctrl+C` copy · `Ctrl+V` paste · `Ctrl+X` cut · `Ctrl+D` duplicate · `Ctrl+A` select all",
      "`Ctrl+G` group · `Ctrl+Shift+G` ungroup · `Ctrl+]` bring forward · `Ctrl+[` send backward",
      "`Ctrl+Alt+C` copy style · `Ctrl+Alt+V` paste style · `Enter` edit text · `Esc` deselect",
      "`Ctrl` + mouse wheel or pinch to zoom · `Space` + drag to pan · `Shift+1` zoom to fit · `Ctrl+0` 100%",
      "`T` text · `B` button · `R` rectangle · `O` circle · `I` image",
    ],
  },
];
