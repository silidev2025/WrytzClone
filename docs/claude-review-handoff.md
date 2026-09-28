# Craftbase / wrytz clone — complete change handoff for Claude

Project: `C:\Users\franc\OneDrive\Desktop\wrytz clone`

**2026-09-29 update:** The latest audit remediation, finding-by-finding changes, verification results and remaining deployment work are in [audit-remediation-2026-09-29.md](audit-remediation-2026-09-29.md). Review that document and the current Git diff first. The material below is a historical handoff; its statement that the folder is not a Git repository and its older Expo execution details no longer describe the current workspace.

This handoff covers both implementation batches in this conversation: the earlier audit fixes and the Android/iOS mobile testing deployment workflow. It describes 72 distinct application, configuration, test, and documentation files added or modified across those batches. Some files appear in both batches. This handoff itself is one additional documentation file; preparing it did not change application code.

The project is not a Git repository. The source inventory was reconstructed by comparing retained before/after snapshots and checking the implementation notes. At handoff preparation, the current `src` tree matched the source used for the last mobile-deployment verification. The verification results below are results from the implementation work, not a new rerun during handoff preparation.

## Instructions to Claude

Please perform a read-only senior software engineering review of the changes below in the actual project. Do not modify files, publish apps, start public tunnels, change configuration, or use real customer data during the review unless the user separately asks you to do so. Use isolated test data for any tests.

Do not assume the implementation or previous verification claims are sufficient. Check correctness, security, authorization, privacy, accessibility, responsive layout, error handling, concurrency, performance, maintainability, and regressions. Report confirmed findings by severity, with file/line references, reproduction steps or supporting evidence, impact, and a suggested correction. Distinguish confirmed bugs from unverified risks. State which tests you actually ran and which checks remain unperformed.

The business jurisdiction supplied by the user is the Philippines. These changes do not certify legal compliance. Review any new deployment-related disclosures against the actual implementation, and identify missing business decisions rather than inventing policy terms.

If you only receive this document, request access to the source files before claiming to have verified the code.

## Batch 1 — audit fixes

### Functional changes

1. **Runtime popups/dialogs:** dialogs mount independently of the mobile flow layout so they do not disappear when the layout omits them. Automatic dialog layouts fit narrow viewports without scaling their text down.
2. **Modal accessibility:** shared focus management traps keyboard focus, restores the opener, handles Escape, supports nested scopes and associated popovers, locks background scrolling, and makes background content inert. Shared modals expose accessible titles/descriptions.
3. **Responsive website runtime:** the mobile breakpoint changed from 700 to 1100 px. Automatically flowing website pages use available width, capped at 780 px. Authored phone apps and custom mobile layouts retain their intended dimensions. Small authored groups such as logo/name pairs retain their internal arrangement.
4. **Responsive editor:** toolbars wrap; narrow screens have explicit panel/inspector controls; the left panel initially closes on small screens; save-error/retry controls remain visible. Escape while renaming the app cancels without saving the cancelled name.
5. **Database UI:** added a mobile collection picker, corrected the responsive database layout and table scrolling, and rendered collection icons as icons instead of clipped icon-name text.
6. **Record-page states:** added explicit loading, missing-record and failed-record states. Record-dependent page actions wait for a valid record. Incomplete product links do not show an actionable checkout flow.
7. **Buttons and keyboard interaction:** form-submit buttons use native submit behavior; incomplete buttons without an action are disabled and explained in the editor. Added editable accessible names for icon-only buttons. Interactive cards/shapes/table controls support keyboard activation; sortable table headers expose sorting state. File inputs remain focusable and connect help/error text to their controls. Rating controls received larger touch targets. The closed mobile navigation drawer is inert.
8. **Checkout arithmetic and policy links:** added quantity multiplication and currency formatting using the product field's currency. The store template displays the item total and links to its existing policy page. Shipping/tax rules were not invented; the demo still does not collect payments.
9. **Order confirmations:** successful references are stored with the corresponding browser-history entry and scoped to the app and signed-in user. They survive refresh. Direct visits without a reference show an explanatory empty state. Customer contact/address details are not copied into that history metadata. Coffee orders also save a reference for their confirmation page.
10. **Habit check-ins:** replaced the template's create-and-increment action with an atomic server operation. It checks app/collection/record ownership and permissions, fixes a time zone on the habit's first check-in, and deduplicates by local date. Daily/weekday streaks follow scheduled days; three-per-week goals count consecutive qualifying Monday–Sunday weeks. Displayed streaks are recalculated from check-in history so missed days are reflected on reads.
11. **Local dates:** added `now.today` for a local `YYYY-MM-DD` date, corrected local-date display/default handling, and retained `now.iso` as an ISO timestamp. Runtime query/check-in calls send the browser's time zone.
12. **Template compatibility repairs:** added a pure, idempotent repair pass applied when loading saved template documents and building new templates. It groups navbar logo/brand pairs and roadmap heading/list columns; hides matched decorative mobile elements; repairs the feedback “All ideas” destination; corrects survey question-count copy; discloses that RSVP guest-list messages are public; adds icon-button accessible labels; adjusts habit streak explanations/actions; adds store/coffee confirmation behavior; and hides the coffee header's unconfigured cart icon. Repairs match original content/geometry and preserve custom copy and handmade mobile layouts. No bulk rewrite of saved documents or automatic publication was performed.

### New files — batch 1

| File | Purpose |
| --- | --- |
| `src/app/api/run/[appId]/habit-checkin/route.ts` | Runtime endpoint for the atomic habit check-in operation. |
| `src/components/ui/useMediaQuery.ts` | Shared responsive media-query hook. |
| `src/components/ui/useModalFocus.ts` | Shared modal focus, Escape, inert-background and scroll management. |
| `src/lib/shared/habits.ts` | Time-zone/date validation and scheduled habit streak calculations. |
| `src/lib/shared/templateRepairs.ts` | Compatibility repairs for unchanged portions of existing/new templates. |
| `scripts/ts-loader.cjs` | Loads project TypeScript for isolated Node regression tests without emitting application build files. |
| `scripts/test-regressions.cjs` | Eleven automated regression checks for the audit fixes. |
| `docs/fix-verification.md` | Audit-fix implementation notes, verification results and remaining configuration requirements. |

### Modified files — batch 1

| File | Change area |
| --- | --- |
| `src/app/api/run/[appId]/query/route.ts` | Pass query time-zone context to runtime record formatting/streak recalculation. |
| `src/app/editor/editor.css` | Responsive editor toolbar, panels and database presentation; save-error visibility. |
| `src/app/runtime.css` | Runtime responsive/accessibility styling, including inputs and touch targets. |
| `src/components/editor/Editor.tsx` | Initial narrow-screen panel state. |
| `src/components/editor/LeftRail.tsx` | Mobile inspector toggle and panel close controls. |
| `src/components/editor/Topbar.tsx` | Cancel app-name edits on Escape without committing on blur. |
| `src/components/editor/database/DatabaseView.tsx` | Mobile collection selection, database layout and collection icons. |
| `src/components/editor/inspector/ActionsEditor.tsx` | Configure and explain the habit check-in action. |
| `src/components/editor/inspector/BindingField.tsx` | Offer the local-date `now.today` binding. |
| `src/components/editor/inspector/ContentTab.tsx` | Accessible button names and unfinished-action explanation. |
| `src/components/editor/inspector/Inspector.tsx` | Narrow-screen inspector state and close buttons. |
| `src/components/editor/store.ts` | Store inspector-open state. |
| `src/components/runtime/AppRuntime.tsx` | Responsive runtime sizing, record states, confirmation history and page-action gating. |
| `src/components/runtime/ElementView.tsx` | Avoid duplicate live dialog rendering; keyboard activation for interactive elements. |
| `src/components/runtime/PageView.tsx` | Render runtime dialogs separately and use the available flow width. |
| `src/components/runtime/actions.ts` | Execute the dedicated habit check-in action and handle its result. |
| `src/components/runtime/api.ts` | Habit endpoint client and time-zone context for runtime queries. |
| `src/components/runtime/elements/ButtonEl.tsx` | Native submit behavior, accessible names and disabled unconfigured buttons. |
| `src/components/runtime/elements/DialogEl.tsx` | Viewport-aware popup layout and shared modal behavior. |
| `src/components/runtime/elements/GraphicEls.tsx` | Keyboard access and semantics for clickable shapes/graphics. |
| `src/components/runtime/elements/InputEl.tsx` | Focusable file inputs and accessible help/error associations. |
| `src/components/runtime/elements/TableEl.tsx` | Keyboard sorting/row activation and accessible sort state. |
| `src/components/runtime/store.ts` | Runtime record-loading state and supporting runtime state changes. |
| `src/components/ui/Modal.tsx` | Shared focus behavior and accessible dialog title/description. |
| `src/components/ui/Popover.tsx` | Associate portalled popovers with their owning modal. |
| `src/components/workspace/Shell.tsx` | Mobile drawer focus/inert handling. |
| `src/lib/client/lucideLibrary.ts` | Missing delivery/Truck icon support. |
| `src/lib/server/apps.ts` | Apply compatibility repairs when reading draft/published template documents. |
| `src/lib/server/data.ts` | Atomic permission-checked habit check-ins and read-time streak recalculation. |
| `src/lib/shared/doc.ts` | Sanitize and retain valid confirmation-variable metadata. |
| `src/lib/shared/expressions.ts` | Local-date binding, quantity multiplication and field-aware currency formatting. |
| `src/lib/shared/fields.ts` | Use local calendar dates for date-field defaults. |
| `src/lib/shared/layout.ts` | Preserve small free-layout groups in automatic mobile flow. |
| `src/lib/shared/types.ts` | Breakpoint, habit action, accessible-name and confirmation metadata types. |
| `src/lib/shared/util.ts` | Local calendar-date helper. |
| `src/lib/templates/index.ts` | Apply compatibility repairs when constructing bundled templates. |
| `package.json` | Add the `npm test` regression command. |

The individual template source files such as `src/lib/templates/mobile.ts` were not rewritten in this batch; the compatibility pass changes the documents produced/read from them.

## Batch 2 — Android APK / iOS live-tunnel workflow

### Functional changes

1. **Mobile publish controls:** mobile apps have a “Publish & test on a phone” section with Android APK and iOS live-tunnel radio choices. It shows setup availability, queued/building/ready/failed/stopped/expired states, deployment history, error messages and cancellation controls. State polling stops when the panel unmounts.
2. **Save/publish correctness:** publishing stops if saving fails or the document changes during the save. Requests include the expected draft revision; the server rejects a mismatch. Publication and creation of the mobile job happen in one transaction. The client prevents overlapping publish requests; the server rejects an already active job of the same target for that app. Mobile build requests are rate limited.
3. **Durable job storage:** added `mobileDeployments` and `mobileWorkers` tables/index definitions to the existing document store. The JSON store's table registry is derived from `INDEXES`. The implementation also uses the existing generic Postgres document/blob APIs; no standalone SQL migration was added.
4. **Owner access:** only the app owner can list, stop or download its deployments, consistent with existing publishing ownership. Client responses omit worker identity, lease tokens and artifact storage ids.
5. **Worker authentication/lifecycle:** a dedicated bearer secret authenticates the machine API; random per-job lease tokens authorize updates/uploads. A single persistent worker advertises installed capabilities, polls for jobs, compiles APKs and manages Expo processes. It allows one Android build and up to two iOS tunnels concurrently. Commands use argument arrays rather than user-composed shell commands.
6. **Android packaging:** added a minimal native Android WebView shell with app-specific package identity and retained per-app signing keys. The worker generates a signed, non-debuggable testing APK using AAPT2, Java compilation, D8, jar, zipalign and apksigner, then verifies the APK signature before upload. The app requires Android 8+ and targets API 35. It includes back navigation, file selection, loading/error/retry UI and system-inset handling; rejects insecure transport and opens permitted external links in the system browser. It uses a generic Craftbase launcher icon.
7. **APK delivery:** the signed APK goes into the existing blob store. The owner download endpoint sets the APK MIME type, attachment filename, content length, no-store caching and nosniff headers. The panel shows the size and SHA-256 hash. Uploads are limited to 20 MiB. “Remove download” revokes and deletes the stored artifact.
8. **iOS preview:** added an isolated Expo Go project using React Native WebView and safe-area handling. The worker creates a per-job project, starts Expo/ngrok, resolves the Expo Go URL through `/_expo/open`, checks that the iOS shell bundles and that the public tunnel responds, then reports readiness. It monitors health and terminates the Expo/ngrok process tree on stop/expiry.
9. **QR/link controls:** QR codes are generated locally in the browser with `qrcode`; links are not sent to a third-party QR service. Clients can scan the code, open in Expo Go, copy the link or stop the tunnel. Tunnel results must use an accepted Expo/ngrok hostname and `exp:`/`exps:` scheme.
10. **Privacy boundaries:** generated wrappers contain public app URLs rather than server secrets, session tokens or database contents. Expo gets a restricted environment instead of the server's full environment. A tunnel is public to anyone who receives its URL, while the wrapped app's login/data permissions still apply.
11. **Timeouts and cleanup:** pending jobs expire after 10 minutes; builds after 15 minutes; leases after 90 seconds without renewal; iOS sessions after one hour. APK downloads last seven days. Hourly maintenance removes expired blobs and old deployment history after 30 days. App/account deletion removes deployment records and server-side artifacts. Unpublishing or changing a slug stops existing deployments; republishing does not resurrect those stopped records. Completed/stopped worker job directories are removed with workspace-boundary checks.
12. **Responsive publish dialog:** added a scoped modal class, wrapping action rows, single-column phone choices, constrained grid widths, wrapping link fields and long-hash/URL handling. Fixed horizontal overflow at narrow phone widths.
13. **Setup/documentation:** added environment examples, worker/install/test commands, detailed operating instructions and explicit limitations. A public HTTPS app address and a continuously running worker are required to activate the feature.

### New files — batch 2

| File | Purpose |
| --- | --- |
| `src/lib/shared/mobile.ts` | Shared deployment target/status types and display labels. |
| `src/lib/server/mobile.ts` | Availability, queueing, ownership, leases, expiry, APK storage/downloads, tunnel validation and maintenance. |
| `src/app/api/apps/[appId]/deployments/route.ts` | Owner deployment-list and availability API. |
| `src/app/api/apps/[appId]/deployments/[deploymentId]/route.ts` | Owner stop/remove API. |
| `src/app/api/apps/[appId]/deployments/[deploymentId]/apk/route.ts` | Authenticated APK download API. |
| `src/app/api/mobile-worker/route.ts` | Bearer-authenticated claim/update/upload API. |
| `src/components/editor/dialogs/MobileDeploymentPanel.tsx` | Testing choices, status/history, polling, QR code, downloads and stop controls. |
| `mobile/android/MainActivity.java` | Android WebView testing shell. |
| `mobile/expo/App.js` | Expo Go iOS WebView testing shell. |
| `mobile/expo/index.js` | Expo root-component registration. |
| `mobile/expo/package.json` | Isolated Expo dependencies and dependency overrides. |
| `mobile/expo/package-lock.json` | Locked Expo dependency tree. |
| `scripts/mobile-worker.mjs` | Persistent worker, concurrency, heartbeats, cancellation and temporary-directory cleanup. |
| `scripts/mobile/android.mjs` | SDK discovery, package/manifest generation, app-specific signing keys, compilation and APK verification. |
| `scripts/mobile/expo.mjs` | Expo project preparation, environment filtering, tunnel readiness/health and process shutdown. |
| `scripts/test-mobile.cjs` | Ten isolated mobile deployment regression checks. |
| `docs/mobile-deployment.md` | Operator setup, client behavior, lifecycle/retention, limitations and verification details. |

### Modified files — batch 2

| File | Change area |
| --- | --- |
| `src/lib/server/apps.ts` | Revision checks; atomic publish-and-queue; deployment cleanup on deletion; stop deployments on unpublish/slug change. |
| `src/lib/server/maintenance.ts` | Run deployment/blob expiry cleanup. |
| `src/lib/server/store/types.ts` | New deployment/worker table names and index definitions. |
| `src/lib/server/store/json.ts` | Derive the table registry from the index definitions. |
| `src/app/api/apps/[appId]/publish/route.ts` | Accept expected revision/mobile target and rate-limit mobile publish requests. |
| `src/components/editor/dialogs/PublishDialog.tsx` | Integrate testing panel; prevent publishing after failed/incomplete saves; pass revision/target; responsive live-link/address rows. |
| `src/components/ui/Modal.tsx` | Optional scoped class name used by the publish dialog. |
| `src/app/globals.css` | Testing panel styling and narrow-screen publish-dialog overflow fixes. |
| `package.json` | QR dependencies and mobile test/install/worker commands. |
| `package-lock.json` | Root dependency lock changes for QR generation/types and their transitive packages. |
| `.env.example` | Mobile server, public URL, worker secret, working directory and Android SDK settings. |
| `.gitignore` | Ignore the Expo dependency directory and its local `.expo` metadata. |
| `README.md` | Describe APK/tunnel publishing and link to the setup guide. |

## Dependencies and commands changed

Root dependency additions:

- `qrcode`: `^1.5.4`.
- Development dependency `@types/qrcode`: `^1.5.6`.

Separate `mobile/expo` dependency additions:

- `expo`: `57.0.25`.
- `expo-constants`: `~57.0.19`.
- `react`: `19.2.3`.
- `react-native`: `0.86.3`.
- `react-native-safe-area-context`: `~5.7.0`.
- `react-native-webview`: `13.16.1`.
- `@expo/ngrok`: `4.1.3`.
- Nested `uuid` overrides for `@expo/ngrok` and `xcode`: `11.1.1`, addressing the dependency advisory while retaining their CommonJS `v4` usage.

The existing web app's Next.js/React versions were not upgraded for this feature. The separate Expo project has its own React version and lockfile. Root and Expo `node_modules` were populated by npm; their generated third-party files are represented by the lockfiles rather than individually enumerated here.

Commands added across the two batches:

```text
npm test                 -> node scripts/test-regressions.cjs
npm run test:mobile      -> node scripts/test-mobile.cjs
npm run mobile:install   -> npm --prefix mobile/expo ci
npm run mobile:worker    -> node scripts/mobile-worker.mjs
```

Environment examples added:

```text
CRAFTBASE_PUBLIC_URL
CRAFTBASE_MOBILE_WORKER_TOKEN
CRAFTBASE_MOBILE_SERVER_URL
CRAFTBASE_MOBILE_WORK_DIR
ANDROID_HOME
CRAFTBASE_ANDROID_BUILD_TOOLS
```

The scripts also use existing standard `JAVA_HOME`/Android SDK environment settings and optional `EXPO_TOKEN`. No actual public deployment address or production worker secret was written into the project's `.env.local` during this work. Temporary verification environments had their own synthetic credentials.

## Verification already performed

### Automated/build checks

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed.
- Existing audit-fix regression suite: 11/11 checks passed.
- Mobile deployment suite: 10/10 checks passed, using temporary JSON-store data.
- Production build: `next build --webpack` passed in an isolated copy with identical application source/configuration. Webpack was used because that copy shared `node_modules` through a junction outside its root; this is not a claim that the default Turbopack production command was separately verified.
- Worker/adapter JavaScript syntax checks passed.
- Root and Expo dependency audits reported zero known vulnerabilities at verification time. This is not a guarantee of security or a current audit result for a future review date.

### Earlier browser checks

- All 12 template home pages at 320, 768 and 1440 px, after hydration: 36 checks without horizontal page overflow.
- Editor toolbar at 320, 390, 768, 1024 and 1440 px; mobile panel controls and database layout.
- Checkout popup, quantity total, Enter submission, confirmation refresh and missing-product/direct-confirmation states.
- Dialog keyboard focus/Escape/restoration and mobile navigation behavior.
- Feedback popup/roadmap order, survey copy/decorations/touch targets, RSVP public-message disclosure, habit check-ins/repeated taps.
- Save-error visibility/recovery and Escape during app rename.

### Mobile deployment end-to-end checks

- Built a real APK using the installed Android SDK and verified its signature.
- Published a synthetic app through the dialog; the worker built/uploaded its APK; the authenticated download returned the correct MIME type, filename and nonempty APK data.
- Started an actual Expo/ngrok tunnel, bundled the iOS shell, checked public tunnel health, and displayed its QR code/link in the dialog.
- Stopped the tunnel through the UI; its public endpoint then returned 404, and the worker's temporary job directory was removed.
- Publish dialog at 320, 390, 768 and 1440 px: no page, dialog or dialog-body horizontal overflow after the fixes; no recorded browser exceptions.
- Simulated an HTTP 503 draft-save failure: the editor displayed a save error, and attempting publication sent zero publish requests.
- Verification used synthetic accounts/records on a separate local server and an isolated background Edge browser. The test browser, server, worker and tunnel were stopped. No real client app was published by these tests.

## Remaining setup, limitations and priority review targets

1. **Not activated for real clients:** a real public HTTPS address is still needed, together with server/worker configuration and a persistent worker process. The Expo tunnel exposes the iOS shell; it does not make a localhost Next.js app reachable from a phone.
2. **Physical devices not tested:** no real Android APK installation or iPhone Expo Go session was verified. Check authentication redirects/cookies, app navigation, keyboard/insets, uploads, external links, network failures, resume/rotation and installation updates on devices.
3. **Postgres concurrency not exercised:** the automated deployment/check-in tests ran against the JSON store. Independently test Postgres transactions, lock ordering, concurrent initial worker registration, duplicate claims/publishes, stop/upload races, deletion, and worker restart/disconnection. Windows was used for actual worker verification; macOS/Linux behavior remains unverified.
4. **Testing wrappers are not immutable releases:** packages load the current published web app. Future publishes change their content. They are not offline native exports or frozen copies of the recorded revision.
5. **iOS means Expo Go:** there is no generated IPA, TestFlight submission or Apple provisioning. Android output is a directly installable testing APK, not Play Store submission. Review whether that matches the intended client product experience.
6. **Signing-key retention:** server-side account/app deletion removes deployment records and APK blobs, but private worker signing keys/passwords remain until the operator removes them. Review retention/deletion procedures, key permissions/backups, and crash recovery.
7. **Worker/tunnel boundaries:** verify bearer/lease handling, public tunnel exposure, generated project contents, allowed URLs/origins, environment filtering, process-tree shutdown, timeouts, workspace-boundary cleanup and behavior when the worker or server restarts. The current worker architecture is deliberately single-worker with bounded concurrency; assess scaling needs before deployment.
8. **Native wrapper scope:** no new camera/microphone/location permissions, push notifications, payment integrations, store distribution or JavaScript blob-download support was implemented. APKs use a generic launcher icon. Links opened in the system browser have that browser's independent login session.
9. **Template preservation and performance:** examine repair matching/idempotence and preservation of custom layouts/copy. Review read-time habit streak calculation and collection scanning at larger data sizes, plus permission boundaries and the different schedule/time-zone cases.
10. **Legal/business content remains incomplete:** operator identity/contact details and real shop currency/tax/delivery/payment/refund/cancellation/dispute terms still need business-specific completion. Unconfigured starter buttons remain disabled until intended workflows are supplied. Deployment services, public tunnel sharing, retention and signing-key handling should be reflected in appropriate privacy/operating disclosures. No legal-compliance certification or full penetration test was performed.

## Retained snapshots for local comparison

If these temporary folders still exist on the same machine, use them as read-only comparison inputs:

```text
Before audit fixes (source snapshot):
C:\Users\franc\AppData\Local\Temp\craftbase-before-fixes-aebbd81723d545199784bac48ad300b7

After audit fixes / before mobile deployment:
C:\Users\franc\AppData\Local\Temp\craftbase-verify-d049774e33484d9fbdb21491cc48c34a

Mobile deployment verification copy:
C:\Users\franc\AppData\Local\Temp\craftbase-mobile-verify-334fbdcacceb4620aa78a47d71fdfb8a
```

Only compare source/configuration files needed for the review. These verification folders can contain temporary fixture credentials, test data and dependency junctions. Do not upload whole temporary directories, real `.data` folders, signing keys, `.env` files or session credentials to another service.

Existing supporting notes: `docs/fix-verification.md` and `docs/mobile-deployment.md`.
