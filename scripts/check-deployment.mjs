import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const failures = [];
const present = (key) => !!process.env[key]?.trim();
for (const key of ['DATABASE_URL', 'CRAFTBASE_SECRET', 'CRON_SECRET', 'OPERATOR_IDS', 'NEXT_PUBLIC_OPERATOR_NAME', 'NEXT_PUBLIC_OPERATOR_ADDRESS', 'NEXT_PUBLIC_SUPPORT_EMAIL'])
  if (!present(key)) failures.push(`${key} is missing.`);
for (const key of ['CRAFTBASE_SECRET', 'CRON_SECRET']) if (present(key) && process.env[key].trim().length < 32) failures.push(`${key} needs at least 32 characters.`);
if (!present('RESEND_API_KEY') || !present('MAIL_FROM')) failures.push('Configure RESEND_API_KEY and MAIL_FROM for customer password recovery.');
if (!present('CRAFTBASE_PUBLIC_URL') && !present('VERCEL_PROJECT_PRODUCTION_URL') && !present('VERCEL_URL')) failures.push('Configure CRAFTBASE_PUBLIC_URL or a Vercel public HTTPS deployment URL.');
if (!present('CRAFTBASE_MOBILE_WORKER_TOKEN')) failures.push('Mobile testing is unavailable until CRAFTBASE_MOBILE_WORKER_TOKEN and a persistent worker are configured.');
// Never print environment values, connection strings, passwords or tokens.
if (failures.length) { for (const message of failures) console.error(`Missing setup: ${message}`); process.exitCode = 1; }
else console.log('Required values are present. Also verify email delivery, cron execution, backup restoration and physical-phone testing.');
