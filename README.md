# Pocket Ledger

Source repository: https://github.com/vroggi/pocket-ledger

Hosted app (owner-only): https://pocket-ledger-poul.lilac-nova-3380.chatgpt.site/

A private, single-owner personal finance PWA. English interface, EUR, calendar dates in Europe/Vilnius. It records your finances manually; it does not connect to banks or execute real payments.

## Stack and hosting

- React 19 + TypeScript; Next.js-compatible app routes supplied by the Sites Vinext starter (Vinext is beta, not an official Next.js runtime).
- Cloudflare Workers for the API; Cloudflare D1 (SQLite) for durable data; Drizzle schema and committed SQL migrations.
- Hosted authentication and owner-only access are provided by the **Sites ChatGPT gateway**. There is no public registration and no password to store in source.
- Installation manifest, PNG icons and a network-only service worker. No financial API response, authenticated HTML, transaction or backup is cached by the service worker.

For independent Cloudflare hosting, Workers Free currently permits 100,000 requests/day and 10 ms CPU/request; D1 Free includes 5 million rows read/day, 100,000 rows written/day and 5 GB total storage. Paid Workers starts at US$5/month; usage beyond included quotas is billed separately. These are Cloudflare's direct-account prices, **not a claim about Sites billing**. Verify before choosing a plan: https://developers.cloudflare.com/workers/platform/pricing/ and https://developers.cloudflare.com/d1/platform/pricing/ . A larger ledger may exceed the free CPU allowance even at low request volume.

## Features

- Account creation, editing, opening balances and archiving. Archived money and history remain in totals.
- Income, expenses and own-account transfers; editing/deletion rebuild all derived figures. Text, period, account, category and non-essential filters.
- Simple dashboard; separate category, monthly, comparative and non-essential statistics.
- Per-category monthly budgets with remaining amounts and overspending.
- Multiple savings goals, virtual reserves and dedicated savings-account transfers; contribution and release history.
- Manual, income-percentage and confirmed monthly contributions, including combinations.
- Recurring weekly/monthly/yearly schedules; due and overdue views, confirm/skip/pause/edit. A future schedule does not affect real balances.
- CSV export; complete JSON backup and validated replacement restore with a before/after preview and explicit confirmation.
- Responsive layout, mobile navigation, quick-add, keyboard-accessible forms and saved light/dark appearance.
- `/demo` is a clearly labelled sample ledger held only in memory. Reload resets it. It never calls the financial database API or syncs sample records to your private ledger.

## Local development

Use **Node.js 24 LTS** (Node 22.13+ supports the framework; the tests use Node's built-in SQLite module) and pnpm. No database credential is required for a local D1 emulator.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run db:generate  # only when changing schema; committed migrations already exist
pnpm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_magenta_wallflower.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_owner_guard.sql
pnpm dev
```

Apply **each pending local migration once**, in order; do not replay `CREATE TABLE` or `CREATE TRIGGER` migrations. The local database is under ignored `.wrangler/state/`; it is separate from the hosted database. `db:generate` is not needed for a fresh clone unless schema changes.

On an ordinary local machine the starter selects the portable execution profile. Its loopback-only development sign-in route `/signin-with-chatgpt?return_to=/` creates a synthetic local identity (`local_seedy`). This is a development convenience, **not production authentication**. It is excluded from production builds and disabled in the managed Linux preview. In that managed preview, `/demo` permits visual testing without pretending to be signed in. The supplied helper scripts choose the local environment and cache configuration; retain them.

```bash
pnpm test
pnpm run typecheck
pnpm run build
```

`pnpm start` previews the built worker locally; it does not simulate hosted sign-in. Use `pnpm dev` for the portable local sign-in workflow.

## Hosted owner account and database

1. Keep the Site's access policy **owner-only**. The first real owner opens `/` and signs in with their ChatGPT account. No extra account registration is required.
2. Sites strips/replaces its authenticated identity headers. The API rejects requests without identity. The first authorized owner initializes the singleton ledger; other user IDs receive no ledger data and cannot update it.
3. The database is accessible only through the server's private D1 binding (`DB`), never through a browser database key. Every read/write binds the authenticated owner. SQLite enforces a single ledger, valid JSON, schema version and immutable ownership.
4. Publishing through Sites provisions `DB` and applies committed schema migrations. The hosting manifest enables `d1: "DB"`; do not add real database files or financial records to Git.
5. Open on a second device using the same owner account. Successful saves update D1 before the UI reports success. Visible clients refresh every 8 seconds and on focus/reconnection.

A service-access token without visitor identity cannot operate this financial API. Do not share the Site or widen its access policy. Never treat an `oai-authenticated-user-id` header from an untrusted direct internet request as authentication.

### Independent hosting is an additional integration

The source is open and reusable, but its **current production authentication depends on Sites**. A bare `wrangler deploy` outside Sites is not a secure substitute: configure Cloudflare Access with your owner email allowlist **and implement/verify Access JWTs at the Worker origin**, replacing `app/chatgpt-auth.ts`. Do not expose the worker until that integration is in place. The current implementation does not claim to supply standalone Access JWT verification. Do not simply forward arbitrary identity headers.

## Data model and atomicity

For this one-owner version, D1 stores one versioned **ledger document** in a `ledger` row (`id=1`, `owner`, `revision`, `payload`, `updated_at`). The document contains typed collections:

| Collection | Purpose |
| --- | --- |
| accounts | Name, kind, opening cents, archived flag |
| categories | Editable income/expense categories |
| transactions | Actual income, expense and transfer records |
| goals | Target, method, account, deadline and contribution rules |
| allocations | Signed reserve entries; history of contributions/releases |
| applications | Captured percentage rules per eligible income/goal pair |
| budgets | Category/month limit in cents |
| recurring | Payment details, cadence, anchor day, next date, paused flag |
| occurrences | Unique schedule/date confirmations and skips |
| fixedConfirmations | Unique goal/month confirmations |
| processed | Mutation request IDs, including restores |

All calculations happen in `lib/finance.ts` and are repeated **on the server**. The browser cannot submit authoritative balances. A mutation validates a complete next state, then atomically updates it using `WHERE owner=? AND revision=?`. Only one of two writes based on the same revision succeeds. Conflicts return HTTP 409; the UI loads the new version and asks you to review and save again. A lost response retains the same command ID; a retry recognizes an already committed command.

This document design deliberately trades large-ledger scalability for simple atomic accounting in a single-owner app. Validation caps the document at **1.5 million JSON characters** and each collection at 20,000 entries. The whole document is read/polled, so large ledgers should migrate to normalized tables or a transactional Durable Object before reaching these limits. Never silently prune idempotency or confirmation history.

## Financial rules

- All money is a safe integer number of **eurocents**. Inputs accept at most two decimal places. Negative opening balances are supported; expense/income/transfer amounts must be positive.
- Opening balances do not count as income. Transfers have a negative leg and positive leg and do not affect income/expense statistics.
- `Available to Spend = sum(account balances) − sum(goal reserves)`. Dedicated savings accounts remain in total balance and are **not subtracted again**. Upcoming bills are not deducted from this metric.
- A contribution cannot exceed unreserved money. A dedicated account cannot spend or transfer money still reserved for goals. An edit/deletion that would leave an unfunded reserve is rejected; release the reserve first.
- Dedicated contributions may transfer from another active account, or reserve money already in the goal's account by selecting that same account as the source. Releasing a reserve does not move cash: make a separate own-account transfer if needed.
- Matching income rules are captured once at first income creation. Percentages round **down** to cents, stop at the goal target and are capped by available funds (and source-account funds for dedicated transfers). Goals are processed in creation order. Insufficient funds can produce a partial/zero allocation, not an overdraft.
- Editing income recalculates **its original captured percentage/category rules**, replacing linked entries/transfers rather than appending duplicates. Newly added/edited rules are not retroactive. If an old reserve has already been released, explicit adjustment history keeps its remaining reserve nonnegative. Deleting income removes linked automatic entries/transfers and records any necessary released-reserve adjustment. Current goal method/account are used for recalculated contributions.
- Total configured percentages across all goals may not exceed 100%, even when category selections differ. Manual contributions remain available.
- Fixed monthly proposals are suggestions, confirmed once per goal/calendar month. They are capped at the remaining target; insufficient available funds are rejected. Past unconfirmed monthly proposals are not silently accumulated.
- Needed monthly contribution = remaining target divided by inclusive calendar months until the deadline, **rounded up** to cents. An overdue deadline gets a warning, not a negative installment. Completed goals show complete. Estimated completion uses only a positive fixed monthly plan, with the first contribution in the current month; future percentage income is unknown. Zero plan means no estimated date.
- Recurring occurrence keys are `schedule ID + due date`. Confirmation records an expense **dated on that due date**, then advances the schedule. Skip advances without expense. Repeated confirmations, including after edits or on another device, cannot create another expense for the same occurrence. Deleting its expense does not reset the confirmation marker.
- Month-end schedules clamp to the last valid day and preserve the original anchor day (31 Jan → 28 Feb → 31 Mar). Yearly leap-day payments clamp to February's last day.
- Statistics use stored calendar dates (`YYYY-MM-DD`); date defaults are computed in Europe/Vilnius. Future actual transactions are rejected. Future commitments belong in Recurring Payments. Previous-month zero baselines show “New”/“No change”, never Infinity or NaN.

## Backups, restore and privacy

In Settings choose **Download full backup**. It includes every financial collection and the confirmation/idempotency markers, but no owner identity, authentication secret, password or service credential. Backups are **not encrypted**; keep them in a private encrypted location. CSV is for transactions, not a complete restore source.

Before restore, download a current backup. Select the JSON file, review counts and total balances before/after, then explicitly confirm replacement. The server validates it again and replaces the document atomically against the current revision. The current authenticated owner remains unchanged. A conflict requires reloading/reviewing. A restore intentionally replaces all financial history, including confirmation history, with the backup's version.

The app itself does not send financial records to analytics or external services. Theme and the last chosen account ID are the only local preferences; financial records remain in memory while the page is open and in D1. The PWA worker does not cache private HTML/API data. A shared device should be signed out after use.

## Public GitHub source

Only application source, schema/migrations, tests, static icons, lockfile, documentation and `.env.example` belong in the public repository. Never commit `.env`, `.dev.vars`, `.wrangler`, `.sites-runtime`, database files or backups. `.gitignore` excludes these. No personal ledger is seeded; sample data exists only in `lib/demo.ts`.

This public repository is `vroggi/pocket-ledger`. Clone it with `git clone https://github.com/vroggi/pocket-ledger.git`, then follow the local development instructions above. The included `.github/workflows/check.yml` runs tests, type checking and a production build on pushes and pull requests. Publishing source to GitHub does not itself redeploy the private hosted app.

## Testing and known limits

The automated tests exercise exact cents, both transfer legs, opening balances, account archiving, expense edits/deletes, month/year boundaries, virtual/dedicated savings, double allocation prevention, income rules and edits/deletion after release, fixed contributions, recurring deduplication/skip/pause, month-end/leap-year dates, forecasts, CSV escaping, backup validation, immutable owner and versioned database writes across two devices.

This is an online-first v1: no offline write queue, bank integrations, investments, multi-currency, shared users, email reminders or automatic charges. Sync is polling rather than instantaneous push. Backups are manual downloads; no unattended off-site backup job is configured. Browser/PWA installation and end-to-end hosted sign-in/save checks must be verified on the final deployed URL. An untested demo or local preview must never be reported as working cloud synchronization.
