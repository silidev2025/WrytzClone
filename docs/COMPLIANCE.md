# Before real people use your Craftbase

The software gives you the tools; these steps are for the person or business running the site. This is a checklist, not legal advice — have a lawyer review your final Terms and Privacy notice.

## 1. Say who you are

- [ ] Fill in `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_OPERATOR_ADDRESS`, `NEXT_PUBLIC_SUPPORT_EMAIL` and `NEXT_PUBLIC_PRIVACY_EMAIL` (see `.env.example`), then rebuild. The Terms, Privacy and Contact pages show a "Template — not yet complete" banner until these are set.
- [ ] Fill in every highlighted `[…]` gap on `/terms` and `/privacy` (hosting provider and location, backup retention, complaint response time). They live in `src/app/terms/page.tsx` and `src/app/privacy/page.tsx`.
- [ ] If you run this as a business, register it and show your registration details (`NEXT_PUBLIC_BUSINESS_REGISTRATION`). Check the current BIR rules on displaying your Certificate of Registration and registration seal.

## 2. Data privacy (Republic Act No. 10173)

- [ ] Appoint a Data Protection Officer (`NEXT_PUBLIC_DPO_NAME`) and publish a privacy contact.
- [ ] Check whether you must register with the National Privacy Commission (it depends on things like the number of people whose data you handle and whether it includes sensitive information — being small doesn't automatically exempt you).
- [ ] Do a privacy impact assessment of the service, and keep a short record of what data you process, why, where it is stored and for how long (the Privacy notice lists the retention periods the software enforces).
- [ ] Sign data-processing agreements with the companies you rely on (hosting, database, email).
- [ ] Decide how you verify people's identity before acting on privacy requests, and how quickly you answer them.

## 3. If something goes wrong (incident response)

1. **Contain it** on `/operator`: take affected apps offline, suspend accounts that are abusing the service, and if accounts may be at risk press **Sign everyone out**. If server settings leaked, change the database password and `RESEND_API_KEY`. Change `CRAFTBASE_SECRET` only if it leaked itself: everyone then gets new ids inside apps.
2. **Find out what happened** in the security log: sign-ins (and failed ones), password changes, admin and access-rule changes, deletions, takedowns and suspensions. Each app's entries are in **Publish › Activity**; everything is in the `audit` data (`.data/audit/` with file storage).
3. **Notify:** if personal information was (or likely was) exposed and it could lead to harm, the NPC and the affected people must generally be told **within 72 hours** of knowing about it. Write down what happened, when you found out, and what you did.
4. **Restore** if data was lost or damaged: stop the server and run `npm run restore -- backups/<folder>` (with Postgres, use your provider's backups). The current data folder is kept next to it, not deleted.
5. **Fix and review:** close the hole, and note what you'll change.

Practise step 4 once before you need it: `CRAFTBASE_DATA_DIR=./restore-test npm run restore -- backups/<folder>` restores into a spare folder without touching the live one.

## 4. Safety and abuse

- [ ] Put your account id in `OPERATOR_IDS` (Settings shows it) so you can open `/operator`.
- [ ] Check `/operator` regularly. There you review reports, take apps offline (they stay offline until you allow them again; the owner sees your reason and your support email), suspend accounts, and create password-reset links.
- [ ] Decide what you allow on the service (the Terms list what's not allowed) and answer appeals sent to your support email.
- [ ] If you let people sell through apps built here, check whether the Internet Transactions Act (RA 11967) treats you as an online platform or marketplace, and what that requires (merchant identification, complaint handling, takedown process).

## 5. Running the server

- [ ] Run behind HTTPS with a proxy and set `TRUST_PROXY=1`.
- [ ] Keep the data folder out of cloud-synced folders (OneDrive, Dropbox…) or use Postgres.
- [ ] With Postgres, set `CRAFTBASE_SECRET` (otherwise it is derived from `DATABASE_URL`).
- [ ] Schedule `npm run backup` daily (cron or Task Scheduler) and keep copies off the server. Backups older than `CRAFTBASE_BACKUP_KEEP_DAYS` (default 30) are deleted — put that number in your privacy notice.
- [ ] Set up email (`RESEND_API_KEY`, `MAIL_FROM`) so people can reset their own passwords.
- [ ] Keep dependencies up to date (`npm audit`, `npm outdated`).

## Known limits of the software

- No two-factor sign-in yet.
- Uploaded files are checked by type but not scanned for viruses. Files visitors attach (other than images) are always downloaded, never opened inside the site.
- Rate limits are kept in memory per server; with several servers, use a shared limiter at your proxy.
- Content policies, identity checks for sellers, and payments are not built in.
