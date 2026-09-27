# Craftbase

Build websites and phone apps visually — no code. Drag elements onto a canvas, style them like in Figma or Canva, connect a built-in database, and publish to your own address (`https://your-app.yourdomain.com`).

- **Editor:** drag and drop, snapping guides, layers, undo/redo, auto-save, version history, a separate phone layout, 15 website blocks and 15 phone blocks.
- **Database:** collections with 17 field types, a spreadsheet view, CSV import/export, and access rules (who can read, add, edit, delete).
- **Logic without code:** buttons and forms run actions — go to a page, save or update a record, add +1 to a number, run several changes together as one step, show a pop-up, and more.
- **Publishing:** one click to a public link. Phone apps can be installed on the home screen.
- **12 templates:** launch page, online store, portfolio, feedback board, survey, restaurant, blog, event RSVP, task tracker, resource library, and two phone apps (habit tracker, coffee shop).

## Run it on your computer

Needs [Node.js](https://nodejs.org) 20.9 or newer.

1. Install packages: `npm install`
2. Start: `npm run dev`
3. Open http://localhost:3000 and create an account.

Every person who signs up gets their own apps. To open the operator page (`/operator`: reports, takedowns, account recovery), put your account id from **Settings** in `OPERATOR_IDS` and restart.

> **OneDrive / Dropbox tip:** cloud-synced folders make `npm install` and the dev server slow, and can lock files while the app saves data. Move the project to a plain folder (for example `C:\dev\craftbase`), or at least set `CRAFTBASE_DATA_DIR` to a folder outside OneDrive.

## Settings

Copy `.env.example` to `.env.local` and fill in what you need. For trying it out everything is optional; before real people sign up, fill in who runs the site (see [Before real people use it](#before-real-people-use-it)).

| Setting | What it does |
| --- | --- |
| `NEXT_PUBLIC_OPERATOR_NAME`, `…_ADDRESS`, `NEXT_PUBLIC_BUSINESS_REGISTRATION` | Who runs the site. Shown on the Terms, Privacy and Contact pages. |
| `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_PRIVACY_EMAIL`, `NEXT_PUBLIC_DPO_NAME` | Where people get help and send privacy requests. |
| `NEXT_PUBLIC_MINIMUM_AGE` | Youngest age allowed to sign up (default 18). |
| `OPERATOR_IDS` | Account ids (comma-separated) that may open `/operator`. |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Your main domain, e.g. `example.com`. Published apps get `https://<app>.example.com`. Empty: apps live at `/app/<app>`. |
| `NEXT_PUBLIC_APP_PROTOCOL` | `https` (default) or `http`. Only if the automatic guess is wrong. |
| `TRUST_PROXY` | `1` when a proxy (Cloudflare, Caddy, Nginx) sits in front, so rate limits and HTTPS detection see the real visitor. Automatic on Vercel. |
| `DATABASE_URL` | Postgres connection string. Required on serverless hosts (Vercel). Empty: data is stored in files. |
| `DATABASE_URL_UNPOOLED` | A direct (non-pooled) Postgres address for live collaboration across servers, when `DATABASE_URL` goes through a pooler. |
| `DATABASE_POOL_SIZE` | Database connections to keep open (default 5). |
| `CRAFTBASE_SECRET` | 32+ random characters for server-side hashing. Set it with Postgres; file storage creates one itself. |
| `CRAFTBASE_DATA_DIR` | Folder for file storage when there's no database (default `./.data`). Keep it out of OneDrive/Dropbox. |
| `CRAFTBASE_BACKUP_DIR`, `CRAFTBASE_BACKUP_KEEP_DAYS` | Where `npm run backup` writes, and how many days backups are kept (default `./backups`, 30). |
| `RESEND_API_KEY`, `MAIL_FROM` | Send password-reset emails through [Resend](https://resend.com). Without them, operators create reset links on `/operator`. |

`NEXT_PUBLIC_…` values are built into the app. Set them **before** `npm run build`, and rebuild after changing them.

## Apps on subdomains of your domain

With `NEXT_PUBLIC_ROOT_DOMAIN=example.com`:

- `example.com` — the builder (sign in, editor, templates).
- `bakery.example.com` — the published app named `bakery`.

**Try it locally first:** set `NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000`, restart `npm run dev`, publish an app named `bakery`, then open http://bakery.localhost:3000. Chrome, Edge and Firefox send `*.localhost` to your own computer automatically.

**On a real domain you need two DNS records** (at your domain registrar or Cloudflare):

| Type | Name | Value |
| --- | --- | --- |
| `A` | `@` | your server's IP address |
| `A` | `*` | your server's IP address |

The `*` record sends every subdomain to your server. You also need an HTTPS certificate that covers `*.example.com` — see the deploy options below. Names like `www`, `api`, `admin`, `blog` and `help` are reserved and can't be used as app names.

## Deploy

### Option A: your own server (VPS) — simplest for subdomains

Works on any Linux server (DigitalOcean, Hetzner, Lightsail…).

1. Install Node.js 20+ and copy the project to the server.
2. Create `.env.local` with at least `NEXT_PUBLIC_ROOT_DOMAIN=example.com`, `TRUST_PROXY=1` and the operator details.
3. Build: `npm ci && npm run build`
4. Start: `npm start` (port 3000). Keep it running with `pm2` or a systemd service.
5. Put Cloudflare in front for HTTPS:
   1. Move your domain's DNS to Cloudflare (free plan).
   2. Add the two `A` records above with the orange cloud (proxied) on. Cloudflare's free certificate covers `example.com` and `*.example.com`.
   3. SSL/TLS mode: **Full**. Create an Origin Certificate for `example.com, *.example.com` and use it in the web server below.
6. Web server in front of Node (Caddy example, `/etc/caddy/Caddyfile`):

   ```
   example.com, *.example.com {
     tls /etc/ssl/origin.pem /etc/ssl/origin.key
     reverse_proxy localhost:3000
   }
   ```

File storage works well here: all data lives in `.data/` (or `CRAFTBASE_DATA_DIR`). Every change is written to a journal before it is confirmed, so a crash or power cut loses nothing that was saved. File storage is for **one** server process (a second one refuses to start on the same folder); for several servers, use Postgres.

**Backups:** run `npm run backup` daily (cron: `0 3 * * * cd /srv/craftbase && npm run backup`) and copy the `backups/` folder off the server. It works while the site runs. To restore: stop the server, run `npm run restore -- backups/craftbase-<date>`, start it again (the old data folder is kept next to it).

### Option B: Vercel

1. Create a Postgres database (Neon, Supabase or Vercel Postgres) and set `DATABASE_URL` and `CRAFTBASE_SECRET`. File storage does **not** work on Vercel — its disk is read-only and resets. Turn on your database provider's backups.
2. Set `NEXT_PUBLIC_ROOT_DOMAIN` in the project's environment variables, then deploy.
3. Add both `example.com` and `*.example.com` under Project → Domains. Vercel requires its own nameservers for wildcard domains; it then issues the certificates for you.

Tables are created automatically on the first request.

## Working together

Open an app and press **Share** (top bar) to invite people with a single-use link:

- **Can edit** — they open the app in the builder and edit the design and database with you, live. Everyone sees who's here (avatars in the top bar; click one to jump to where they are), what they've selected and where their pointer is. Changes save on their own a moment after you make them and appear on everyone's screen. **Undo** only undoes your own changes.
- **Live-app admin** — they manage records and see admin-only pages in the published app, but can't open the builder.

Only the owner invites people, changes roles, deletes the app or starts phone builds. Removing someone (or changing an editor to admin) ends their editing at once. Apps shared with you are listed under **Shared with you** in *My apps*.

How it works: design changes are sent per element (not the whole page), numbered by the server, and streamed to every open editor with Server-Sent Events; a tab that was offline catches up on its own. With one server nothing else is needed. With several servers (Vercel, or more than one Node process) use Postgres: servers pass changes to each other with `LISTEN/NOTIFY`. `LISTEN` needs a direct connection, so if `DATABASE_URL` goes through a pooler (Neon's `-pooler` address, PgBouncer), also set `DATABASE_URL_UNPOOLED` (Vercel's Neon integration sets it for you). On Vercel each live connection reconnects every few minutes; nothing is lost when it does.

## Editing on a phone or tablet

The editor works with touch: drag with one finger to scroll the canvas (an element only moves once it's selected — tap it first), pinch to zoom, or use the scrollbars and the zoom buttons at the bottom right of the canvas.

## Testing on devices

**Preview** opens your app in the device of your choice — iPhone, Android phones, iPads and other tablets, laptops and desktop monitors, or a custom size — at that device's real screen size, in portrait or landscape. **On a real device** shows a QR code that opens the preview on your own phone (it has to reach this site's address, so publish the app or run the site on your network first).

## Phone apps

Mobile apps also offer **Publish & test on a phone** in the Publish dialog: build a signed Android APK for direct download or start an iOS live tunnel in Expo Go. This needs a public HTTPS address and the mobile worker. See [mobile deployment setup](docs/mobile-deployment.md) for installation, testing, signing keys and session limits.

1. Create an app and choose **Mobile app** (or start from the Habit tracker / Coffee shop template).
2. Design on the phone-sized screen. Pin a header or tab bar with **Design › Stay on screen**.
3. Publish, then open the link on a phone:
   - **Android:** tap **Install** when asked, or browser menu › *Add to Home screen*.
   - **iPhone:** in Safari tap **Share** › *Add to Home Screen*.

It opens full screen with its own icon and works offline for pages already visited. To list it in the Play Store or App Store, paste the published link into [pwabuilder.com](https://www.pwabuilder.com), which packages installable web apps for the stores.

## Security and privacy

- **Admins:** the person who creates an app owns it. Add admins with an invite link (**Publish › App admins**); an email address alone never grants access.
- **Pages** can be open to everyone, signed-in people, or admins only — restricted pages are never sent to people who can't see them.
- **Data:** new collections are private (admins only) until you choose otherwise, and the Publish dialog shows who can read and add what. Fields can be **Admins only** (visitors can't set them) or **Counter** (visitors can only add or take away 1, e.g. votes). Online-store orders take stock and copy prices on the server.
- **Files** attached through forms are private to the people who can read the record, and are deleted with it.
- **Visitors' identity:** a published app sees a signed-in person's name and email only after they press *Continue*, and gets a different id for them than other apps do.
- **Accounts:** passwords are hashed (scrypt), sessions are HTTP-only cookies listed in Settings (sign out other devices), password resets by email or operator link, data download and full account deletion in Settings.
- **Records of what happened:** sign-ins, admin, access-rule and publishing changes, deletions and takedowns go into a security log (kept 365 days, shown per app in **Publish › Activity**).
- **Moderation:** every live app has a *Report* link. Operators take apps offline (they stay offline until allowed again), suspend accounts, and can sign everyone out in an emergency.

## Before real people use it

1. Fill in the operator settings (name, address, support and privacy emails, DPO) and rebuild — the Terms, Privacy and Contact pages show a warning until you do.
2. Fill in the `[…]` gaps in `src/app/terms/page.tsx` and `src/app/privacy/page.tsx`, and have a lawyer review both.
3. Work through [docs/COMPLIANCE.md](docs/COMPLIANCE.md): Data Privacy Act duties, incident response, backups, business registration.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the editor locally with live reload |
| `npm run build` | Build for production |
| `npm start` | Run the production build |
| `npm run typecheck` | Check the code for type errors |
| `npm run backup` | Copy the data folder to `backups/` (file storage; safe while running) |
| `npm run restore -- <folder>` | Put a backup back in place (stop the server first) |

## Where things are

| Folder | Contents |
| --- | --- |
| `src/app` | Pages and API routes (Next.js App Router) |
| `src/components/editor` | The visual editor: canvas, panels, inspector, database view |
| `src/components/runtime` | Renders apps: preview, live apps and thumbnails |
| `src/lib/shared` | The app model, layout rules, bindings and validation (used everywhere) |
| `src/lib/server` | Accounts, apps, data, storage (files or Postgres) |
| `src/lib/templates` | The 12 templates |
| `src/lib/blocks.ts`, `src/lib/mobileBlocks.ts` | Ready-made blocks for websites and phone apps |
| `src/app/terms`, `privacy`, `contact`, `report`, `operator` | Legal pages, the report form and the operator page |
| `scripts` | Backup and restore |
| `docs/COMPLIANCE.md` | What the site's operator needs to do before going live |
