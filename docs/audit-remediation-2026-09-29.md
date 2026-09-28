# Production-readiness remediation — 2026-09-29

Workspace: `C:\Users\franc\OneDrive\Desktop\wrytz clone`.

These changes address findings F01–F49 from the production-readiness audit. The working tree started at `f820569`; the existing visual polish and pre-existing `.impeccable/` files were preserved. No production database, hosting settings, customer account, GitHub branch or deployment was changed. This is a local implementation and verification handoff, not a production-readiness or legal-compliance certification.

## Changes by audit finding

“Implemented” refers to the code correction; operational prerequisites and remaining limits follow the table. Review the actual diff as well as this summary.

| Finding | Changes / status |
| --- | --- |
| F01 — Attachment authorization | Implemented fail-closed missing-field checks, record/field binding validation, and rebinding/cleanup when fields move, disappear or change type. One attachment cannot bind to both a public and private field. |
| F02 — Malformed documents | Added structural/type/complexity/size validation before saving, safe handling of malformed legacy previews, and a thumbnail error boundary. |
| F03 — Saves crossing app boundaries | Added per-app generations and abort signals to save/resync callbacks; stale responses cannot update the next editor. |
| F04 — Rate limits | Moved buckets to the shared store with atomic PostgreSQL updates. Ignore client-supplied Cloudflare IPs; use Vercel's forwarded IP or an explicitly configured trusted proxy header. |
| F05 — Redirect validation | Reject raw controls, whitespace, backslashes and external redirects before URL normalization. |
| F06 — Password/session races | Session creation rechecks the verified password hash transactionally; sessions carry a credential version. Reset/profile/account flows check fresh account state. |
| F07 — Password hashing | New hashes use scrypt N=16384, r=8, p=5. Existing hashes remain verifiable and upgrade on successful login. |
| F08 — Password-reset delivery | Generate absolute HTTPS links from validated configuration; reject unavailable delivery and record delivery outcomes. Added a mail request timeout. Actual mail setup/delivery remains an operator task. |
| F09 — Error exposure | Unexpected failures return a generic server error; expected document errors become safe validation errors. Import failures no longer expose arbitrary exception messages. |
| F10 — Explore disclosures | Cards omit restricted home pages and inaccessible field definitions. Listing/remixing requires explicit design-sharing consent explaining that restricted designs/settings/schema are shared; records and their attachments remain excluded from remixes. |
| F11 — Stale authorization / lost updates | Mutations re-read account, owner, app, schema and permissions inside serializable PostgreSQL transactions. JSON reads are serialized with writes. |
| F12 — Account deletion | Revoke access first, fence new writes, and persist resumable deletion jobs. Bounded cleanup retries unfinished work; runtime/media access rejects deleting owners. |
| F13 — Unique-field lifecycle | Validate/backfill unique claims during schema changes; release removed/disabled scopes. PostgreSQL also checks legacy rows without reservations. |
| F14 — Collection races | Name uniqueness and collection limits are checked transactionally. |
| F15 — Copy quotas | Reserve copied-file quota transactionally, including private record attachments, with cleanup of failed copies. |
| F16 — Blob cleanup | Queue deletion before removing metadata, retain failed deletion jobs, and reserve cleanup for pending uploads/copies/APKs. Historical orphan inventory was not run against production. |
| F17 — Duplicated attachments | Copies receive independent file IDs, blobs, app ownership and record bindings. Deleting the source no longer removes the copy's file. |
| F18 — Duplicate submissions | Store idempotency results with database writes, verify payload hashes, and retain client retry keys through lost responses/reloads. A successful save followed by a failed action is reported as saved and does not invite duplicate submission. |
| F19 — Deadlocks / transaction order | Removed blanket read locks, reworked reversed account/app/invite ordering and added bounded serialization/deadlock retries. Busy retry exhaustion returns 503. |
| F20 — Database reliability | Bound pool size, connection/query/statement timeouts; handle idle errors; reconnect LISTEN and force clients to resynchronize. |
| F21 — Missed live events | Cold writers publish independently of subscriber state. Durable draft/runtime-write outboxes survive notification failure. Client invalidations accumulate schema and data changes; reconnect refreshes both. |
| F22 — Notification size / committed saves | Measure UTF-8 bytes, spill large events into database storage, and retry delivery independently from acknowledging the committed save. |
| F23 — Adjusted acknowledgements | Return and apply canonical values for adjusted changes, including no-change acknowledgements. |
| F24 — Draft recovery | Preserve recovery snapshots instead of discarding the draft after repeated validation failures. Flush before internal navigation; retain a downloadable recovery copy on save/access failures. |
| F25 — Invalid values | Reject non-finite numbers, impossible calendar dates and invalid 12-hour/seconds inputs. |
| F26 — Preview/live mismatch | Share filter operators, numeric aggregation, sort comparison and chart ordering. Correct empty filters, boolean labels and reference-label handling. Server authorization remains separate. |
| F27 — Runtime cache | Namespace by app/viewer/mode; expire data and errors, periodically revalidate, cap storage and invalidate after writes. Ignore obsolete in-flight results. |
| F28 — Hosting transport | Align ordinary files to 4 MiB and JSON to 4,000,000 bytes. APKs retain their 20 MiB limit through authenticated, retryable 1 MiB parts and final SHA-256 verification. Downloads stream bounded reads with byte-range support. Hosted verification remains necessary. |
| F29 — Query/import cost | Added indexed counts, owner/date pagination and direct ID queries. Expand only referenced rows from the requested page. Bound workspace/Explore read concurrency; stream indexed account exports. Imports use 50-row transactions with row-level fallback after rollback. Complex filters, aggregates, habit decoration and legacy unique checks still need scale profiling; see limits below. |
| F30 — Live resource bounds | Bound channels, global/per-app history bytes, subscriber counts and stream queues. Avoid retaining unrelated-app events or opening LISTEN connections for writers; close slow streams and clean up initialization failures. |
| F31 — Maintenance scheduling | Added authenticated `/api/maintenance`, shared leases, durable cursors/jobs and persisted run metrics. Vercel has a daily fallback; active installations need a frequent authenticated scheduler. |
| F32 — Mail / operators | Added setup checks and documented required values. Verified sender, provider key and selected operator account IDs still require operator configuration. |
| F33 — Legal identity | Readiness now requires operator name, postal address and contact email. Actual business/contact/registration details were not supplied and were not invented. |
| F34 — Hosted defaults | Vercel refuses missing PostgreSQL configuration; production refuses missing/short signing secrets. `pg` is required. Isolated Preview configuration still needs to be supplied in Vercel. |
| F35 — Mobile setup | Resolve HTTPS origin from explicit configuration or Vercel deployment metadata. Worker token, persistent worker and available build tools must still be configured. |
| F36 — Public Metro isolation | Public iOS sessions use a constrained Docker container without host mounts, signing keys or server secrets. Added a restricted Docker build context. Docker was unavailable here; this new execution path is not yet runtime-verified. |
| F37 — Data export | Stream all pages of owned designs, versions, databases, upload metadata, readable contributions and audit history. Include counts/completion marker and record metadata. Explain live consistency and separate file-download links in Settings and the export. |
| F38 — Backups | `backup` now invokes real `pg_dump`, keeps passwords out of arguments, fails nonzero on errors, retains only completed dumps and applies retention. Backup/restore scripts load project environment settings. Verified an actual PostgreSQL dump/restore of synthetic JSON and binary bytes. Provider backups/PITR are not verified. |
| F39 — Truncated icons | Preserve supported longer collection icon names. |
| F40 — Phone preview overlap | Position the preview badge above authored bottom navigation and safe-area padding. |
| F41 — Accessibility | Give the phone Preview button a stable accessible name; keep the noninteractive toast announcer outside modal inert subtrees. |
| F42 — PWA cache | Version/scope caches, bound entries/age, await writes and cleanup, and preserve anonymous-only caching and identity-change invalidation. |
| F43 — Script policy | Replace production inline-script permission with per-response nonces, including Next.js hydration. Inline styles remain necessary for authored layouts. |
| F44 — File validation | Check Office ZIP structure and bounded XML members; reject traversal/duplicate/encrypted/macro entries and excessive expansion. Check audio/video signatures. This is format validation, not malware scanning. |
| F45 — Environment files | Ignore `.env*` except the example template. Existing secrets were not printed, rotated or committed. |
| F46 — Database dependency | Move `pg` from optional to required dependencies and update the lockfile. |
| F47 — Terms renewal | Require explicit acceptance of the current version for protected workflows; record acceptance transactionally. Account export/deletion/session management remain accessible without accepting revised terms. |
| F48 — Automated verification | Added security, collaboration, real PostgreSQL and browser checks plus GitHub Actions for install/typecheck/tests/audit/build/browser. Remote CI has not run because changes are not pushed. |
| F49 — Duplication / dead code | Removed confirmed unused symbols, centralized shared HTTP/cookie/email/query policies, and extracted focused export/blob/validation helpers. No broad module rewrite or speculative dependency removal. |

## Deliberate behavior changes

- Ordinary uploads are limited to **4 MiB**, including on self-hosted installations; JSON requests are limited to **4,000,000 bytes** and saved designs to **3,000,000 UTF-8 bytes**. These limits avoid accepted payloads failing at the Vercel transport. APKs still support **20 MiB** through chunked upload.
- Existing malformed/oversized designs may need recovery or correction before they can be saved again. Their shared thumbnails fail closed instead of crashing Explore.
- Explore listing requires the new design-sharing consent. Existing listings must be republished with consent before others can remix them.
- Public iOS tunnels require **Docker**, not just locally installed Expo packages. No new container image or public tunnel was built/launched in this environment.
- Production requires an explicit stable `CRAFTBASE_SECRET`. Do not replace an existing production secret casually: it controls app-specific user IDs and keyed hashes.
- Nonce-based CSP makes pages render per request. The production browser tests validate hydration; performance should be measured on the actual host.

## Verification

The regression suites use synthetic accounts/files and isolated temporary storage. PostgreSQL tests use a disposable loopback PostgreSQL **17.11** database, a separate random schema per run, real concurrent connections and an intentional LISTEN disconnect.

| Check | Result |
| --- | --- |
| TypeScript, including unused locals/parameters | Passed |
| Existing regression suite | 11/11 passed |
| Security/data/export/import suite | 28/28 passed |
| Collaboration race reproductions | 3/3 passed |
| Mobile API/lifecycle/chunk upload suite | 11/11 passed |
| Real PostgreSQL concurrency/integration suite | 9/9 passed |
| Production build | Passed |
| Production browser smoke | Passed using headless Edge: signup/hydration, script CSP, private draft rejection, editor/Publish at 320/390/768/1440px, modal announcement availability, phone badge/nav separation |
| PostgreSQL backup roundtrip | Passed: restored synthetic JSON and binary values match |
| Root and mobile dependency audits | Zero reported known vulnerabilities at check time |
| Whitespace diff check | Passed |

The concurrency checks initially exposed retry exhaustion under an eight-writer burst; bounded retry attempts/backoff were adjusted and the database suite rerun successfully. Browser-test setup mistakes were corrected before the passing run. Passing checks are evidence for the exercised paths, not proof that every possible race or provider behavior is covered.

To repeat: `npm ci`, `npm run typecheck`, `npm test`, `npm run test:security`, `npm run test:collaboration`, `npm run test:mobile`. For PostgreSQL set `TEST_DATABASE_URL` to a disposable **local** database named `wrytz_test`, then `npm run test:postgres`. Run `npm run build`, `npx playwright install chromium`, then `npm run test:browser`; Windows can use installed Edge with `BROWSER_CHANNEL=msedge`. Use Node 22.13+ for the full test/worker toolchain.

## Required deployment work and remaining limits

1. **Supply real configuration.** `npm run check:deployment` currently reports missing local database/secret, cron, operator IDs, legal contact fields, mail and worker settings. This checks local presence only; Vercel settings were not changed or revalidated. Set independent Production and Preview databases/secrets and rebuild after changing `NEXT_PUBLIC_*` values. Use verified business details for the Philippine operator; no legal compliance conclusion is implied.
2. **Activate and verify services.** Test real password-reset email delivery, intentionally grant operator access, monitor reports, configure a persistent mobile worker and test on physical Android/iOS devices. Build/run the new Docker image first; the historical host-Expo test does not validate it.
3. **Schedule cleanup.** Use `Authorization: Bearer <CRON_SECRET>` for `/api/maintenance` every 1–5 minutes on active deployments. The daily Vercel fallback alone may lag retention/job queues. Work is bounded to a page per table/run and a time budget; monitor `jobs/maintenance_status`, queue age and cursor progress, and size scheduling capacity for traffic. Existing file orphans from before this deployment were not inventoried against customer storage.
4. **Profile remaining data paths.** Arbitrary filters/search/sorts, aggregates, habit decoration and fallback legacy-uniqueness checks still inspect collection data. The existing 20,000-row collection cap remains. The indexed common paths and bounded imports reduce work, but production load/query plans were not measured and this change does not claim unlimited scale. Further SQL query/index specialization should preserve private-field and owner predicates.
5. **Verify hosting and recovery.** Exercise chunk uploads, large streaming downloads/exports, connection loss and recovery on the actual Vercel plan and database pooler. Budget pool connections plus one direct LISTEN connection per listening instance. Verify provider backups/PITR, private backup permissions and restore procedure separately. The exporter is a live traversal, not a transactionally consistent database backup; downloaded file contents are separate.
6. **Release carefully.** Store initialization creates additive tables/indexes and backfills the record-owner index once. Back up and rehearse this against a staging copy first; very large existing tables can make startup migration/index creation expensive. The previous release's source is not a sufficient rollback for data deleted under retention/account requests. Deploy only after checking the configuration and operational items above.

## Review map

- Authorization/storage: `src/lib/server/{auth,account,admins,data,media,reset,http}.ts`, `src/lib/server/store/*`, affected API routes.
- Collaboration/cache: `src/lib/server/live.ts`, `src/components/editor/{live,saving}.ts`, `src/components/runtime/{api,actions,hooks}.ts`.
- Mobile/transport: `src/lib/server/{mobile,blob-response}.ts`, `scripts/mobile-worker.mjs`, `scripts/mobile/*`, `mobile/expo/Dockerfile`, `.dockerignore`.
- Validation/export/maintenance: `src/lib/shared/{doc-validation,fields,aggregate}.ts`, `src/lib/server/{export,maintenance,office-file,blob-cleanup}.ts`.
- Browser/configuration: `src/proxy.ts`, `src/lib/shared/csp.ts`, `src/app/layout.tsx`, `.env.example`, `vercel.json`, `scripts/check-deployment.mjs`.
- Verification: `scripts/test-{security,collaboration,postgres,browser}.cjs`, updated existing tests and `.github/workflows/verify.yml`.

Use `git diff --stat`, `git diff` and `git ls-files --others --exclude-standard` for the exact inventory, including new files. `.impeccable/` predates this remediation and is not part of it. Nothing has been committed, pushed or deployed by this pass.
