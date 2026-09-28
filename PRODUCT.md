# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: students and beginners learning to build their first website or app. They have no coding background and are often working on a phone, a tablet or a shared computer (the editor must work by touch as well as with a mouse).

Secondary, confirmed through features already built: the people they invite to edit with them (classmates, collaborators, clients) and the visitors who use the apps they publish.

## Product Purpose

Craftbase lets someone with no coding experience design a website or a phone app visually, give it a real database, add behaviour without code, and publish it on its own address. Success is a beginner getting from a blank page or a template to a published, working app they can share, and coming back to improve it.

## Positioning

- Design and a real database in one editor: a Canva/Figma-style canvas plus collections with typed fields, access rules and no-code actions.
- Websites and installable phone apps from the same editor, published on a subdomain of the site's domain.
- Build together live: invite people to edit with you in real time, like Google Docs.
- Free to start and beginner-friendly: plain language, no code, no cost to begin.

## Operating Context

- Learners start from one of 12 templates or a blank page, then edit on a zoomable canvas with Design and Database views, preview on chosen devices, and publish.
- Work happens alone or with invited editors in the same app at the same time; changes save continuously.
- Published apps are used by the public; app owners and invited admins manage records from inside the app.
- The operator runs the service from the Philippines and handles reports, takedowns and account recovery on /operator.

## Capabilities and Constraints

- Next.js 16 / React 19 web app. Storage is JSON files on one server or Postgres (Neon on Vercel).
- Capabilities: visual editor (layers, auto-layout, undo, versions), database with CSV import/export and access rules, actions, publishing, PWA phone apps, templates, sharing roles (owner, editor, live-app admin), live collaboration, device preview, account and privacy tools, legal pages, moderation.
- The builder's own interface (landing, workspace, editor, dialogs) is separate from the look of the apps people build; apps carry their own themes.
- Terminology in use: app, page, element, collection, field, record, template, publish, Explore, editor, live-app admin.
- Undecided: pricing or paid plans (Terms promise 30 days' notice before any charge), operator identity and business details.

## Brand Commitments

- Tagline: "Design it. Store it. Share it."
- Current name in use: Craftbase (kept in `src/lib/shared/brand.ts` so it can change); not marked as a fixed commitment.
- Everything else visual (colours, type, logo, shapes) is open to replace.

## Evidence on Hand

- 12 working templates (`src/lib/templates`) and their sample data are the only product demonstrations.
- No testimonials, customer names, usage numbers, press or awards exist: never invent them.
- Terms, Privacy and Contact pages exist but still contain operator details to fill in.

## Product Principles

1. A beginner should never need to know a technical word to succeed; say what things do in plain language.
2. Design, data, logic and publishing live in one place; never send the learner to another tool.
3. It must work on the device the learner actually has, phones and shared computers included.
4. Mistakes are cheap: everything saves, can be undone, or can be restored.
5. Building with other people is as natural as sharing a document.
