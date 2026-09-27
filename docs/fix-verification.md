# Audit fixes and verification

The changes address the confirmed functional, responsive-layout and accessibility findings. They do not certify legal compliance or supply business details that the owner has not provided.

## Implementation

- Runtime dialogs mount independently of mobile flow. Auto-layout dialogs fit the viewport without shrinking their text. Shared modal handling traps focus, restores it, supports nested dialogs and their popovers, locks background scrolling, and makes the background inert.
- Website layouts reflow below 1100px; auto-flow pages use the available width up to 780px rather than shrinking a 1280px desktop design. Authored phone apps and custom mobile layouts retain their intended dimensions.
- Editor toolbars wrap, small-screen panels have explicit open/close controls, save errors stay visible, and the database has a mobile collection picker plus scrolling tables. Collection icons render as icons rather than truncated icon names.
- Missing, loading and failed record pages have explicit states. Incomplete product links cannot expose an enabled checkout button.
- Native submit buttons support Enter without duplicate submission. Clickable cards, shapes and table controls are keyboard reachable; file inputs remain focusable; rating targets are at least 44px; the closed mobile sidebar is inert. App-name Escape cancels without saving.
- Checkout shows the calculated item total using the product's currency and links to shop policies. Successful order references are bound to their browser-history entry and survive refresh. Direct confirmation links show an explanatory empty state. History references contain no customer contact/address data and are scoped to the app and signed-in user.
- Habit check-ins run atomically on the server, enforce app/owner/field access, use a fixed local time zone per habit, and deduplicate by date. Daily/weekday streaks count scheduled days; the three-per-week goal counts completed Monday–Sunday weeks. Displayed streaks are recalculated from history so missed days reset them. `now.today` supplies a local date key; `now.iso` remains a timestamp.
- `repairTemplateDoc` is a pure, idempotent compatibility pass used when loading saved templates and generating new ones. It groups roadmap columns and navbar branding, hides original decorative circles on mobile, repairs template navigation/icons/copy, adds checkout confirmation behavior, and replaces the old habit counter action. It matches original content/geometry, preserves custom copy and handmade mobile layouts, and does not bulk rewrite saved JSON or publish drafts.

## Automated checks

Run `npm test` and `node node_modules/typescript/bin/tsc --noEmit --incremental false`.

The regression suite uses a fresh OS temporary data directory, never the project's real records. It covers Philippine midnight, checkout arithmetic/currency, streak schedules and duplicates, template validity/idempotence/customization preservation, grouped mobile layouts, confirmation metadata, icons, native submit/disabled buttons, concurrent server check-ins and access boundaries.

An optimized production build was verified using `next build --webpack` in an isolated copy. Webpack was used because the test copy shares dependencies through a junction outside its directory; Turbopack does not permit that junction. No dependency installation or production data changes were needed.

## Browser checks

An isolated Edge session and a separate local server with synthetic accounts/records were used for:

- All 12 template home pages at 320, 768 and 1440px: no horizontal page overflow after hydration.
- Editor toolbar at 320, 390, 768, 1024 and 1440px: no overlapping or clipped controls. Mobile panel open/close and full-width database layout.
- Mobile checkout: popup sizing, quantity total, Enter validation/submission, successful reference after refresh, and direct confirmation/missing-product empty states. The test order affected only the synthetic store.
- Dialog focus cycling, Escape, focus restoration, accessible names and the mobile navigation drawer.
- Feedback popup and roadmap heading/card order, survey copy/decorations/touch targets, RSVP public-message disclosure, habit check-ins and repeated taps.
- Simulated draft-save failure: visible Retry save at 320px, then successful recovery. Escape during app rename leaves the name unchanged.

## Configuration still required

- Starter buttons with no configured action are disabled and explained in the editor. Their intended destinations/workflows must be supplied; the repair does not invent them.
- Shop policy placeholders still require the business's real identity/contact details, currency/tax/delivery terms, payment process, cancellation/refund conditions and complaint process. The checkout remains explicitly identified as a demo with no payment taken. The displayed item total does not invent shipping charges or taxes.
- This is not a fresh legal assessment or a complete penetration test. Business-specific legal/privacy content and operational obligations require review against the actual business practices and applicable Philippine requirements.
