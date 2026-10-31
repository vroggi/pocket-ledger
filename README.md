# Pocket Ledger

A multi-user personal finance PWA with a private ledger per signed-in user with mobile installation and offline operation. English interface, EUR, calendar dates in Europe/Vilnius. It records your finances manually; it does not connect to banks or execute real payments.

## Stack and hosting

- React 19 + TypeScript; Next.js-compatible app routes supplied by the Sites Vinext starter (Vinext is beta, not an official Next.js runtime).
- Cloudflare Workers for the API; Cloudflare D1 (SQLite) for durable data; Drizzle schema and committed SQL migrations.
- Hosted authentication is provided by the **Sites ChatGPT gateway**. Anyone can open the public installation page and demo; signing in creates their own empty ledger. No passwords are stored by this application.
- Installable PWA with PNG icons, a standalone offline app shell, encrypted IndexedDB storage and an optimistic outbox. The service worker caches static application assets only; financial API responses and authenticated server HTML are never cached.

For independent Cloudflare hosting, Workers Free currently permits 100,000 requests/day and 10 ms CPU/request; D1 Free includes 5 million rows read/day, 100,000 rows written/day and 5 GB total storage. Paid Workers starts at US$5/month; usage beyond included quotas is billed separately. These are Cloudflare's direct-account prices, **not a claim about Sites billing**. Verify before choosing a plan: https://developers.cloudflare.com/workers/platform/pricing/ and https://developers.cloudflare.com/d1/platform/pricing/ . A larger ledger may exceed the free CPU allowance even at low request volume.

## Features

- Account creation, editing, opening balances and archiving. Archived money and history remain in totals.
- Income, expenses and own-account transfers; editing/deletion rebuild all derived figures. Text, period, account, category and non-essential filters.
- Simple dashboard; separate category, monthly, comparative and non-essential statistics.
- Per-category monthly budgets with remaining amounts and overspending.
- Savings jars for open-ended saving without a target or deadline, plus separate goal-based savings. Both support virtual reserves and dedicated accounts, with money-in/out history.
- Manual, income-percentage and confirmed monthly contributions, including combinations.
- Recurring weekly/monthly/yearly schedules; due and overdue views, confirm/skip/pause/edit. A future schedule does not affect real balances.
- CSV export; complete JSON backup and validated replacement restore with a before/after preview and explicit confirmation.
- Simpler, readable system-font UI, mobile navigation, quick-add, a visible Install app button, keyboard-accessible forms and saved light/dark appearance.
- Offline-extended mode: optimistic local changes, encrypted device snapshots/outbox, server-first conflict resolution and reviewable local drafts.
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
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_reflective_garia.sql
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

## Hosted accounts and database

1. Publish the multi-user version and apply its schema migration before setting the Site audience to **public**. Public access permits the landing page, `/install`, `/privacy` and `/demo`; it does not bypass financial API authentication.
2. Each visitor signs in through ChatGPT. Sites strips/replaces authenticated identity headers. Anonymous financial requests return 401. `user_ledgers.owner` is the stable authenticated Site user ID, not an email or a client-selected ID. Every query and write is scoped to this ID.
3. The private D1 binding (`DB`) is server-only. No browser database key is issued. Database checks require valid JSON/schema/revisions, unique ownership and immutable owner IDs. An operator with infrastructure access can administer the database; this is not cloud end-to-end encryption.
4. The original singleton `ledger` is retained. The original user's first request copies its existing payload and revision to their own `user_ledgers` row idempotently. Other users always start empty, including when they arrive before that original user. This bounded lazy migration leaves the original row intact; it is never a fallback for someone else's identity.
5. Open on another device with the same ChatGPT account to sync. Every POST must also carry the account ID last verified by GET. It is compared with server identity, never used to choose another user's row. Older unscoped clients must reload before saving. Account switches stop the old tab's queue instead of replaying it into a different account.
6. Offline snapshots, encryption keys, queues and drafts are keyed by user in IndexedDB v2. Only the server-confirmed original owner may import the previous unscoped offline snapshot. The last verified account is the offline fallback. A browser profile is a device trust boundary, not a multi-user security vault: sign out before sharing it. Use separate OS/browser profiles for shared devices.

A service token without visitor identity cannot operate the financial API. Never trust arbitrary identity headers at a directly exposed Worker origin. Outside Sites, replace `app/chatgpt-auth.ts` with verified origin-side authentication (for example verified Access JWTs) before publishing. Bare `wrangler deploy` does not provide Sites identity verification. Hosted migrations are applied during Sites publication.

## Data model and atomicity

D1 stores one versioned **ledger document per user** in `user_ledgers` (`owner` primary key, `revision`, `payload`, `updated_at`). The original singleton remains a migration source for its original owner only. The document contains typed collections:

| Collection | Purpose |
| --- | --- |
| accounts | Name, kind, opening cents, archived flag |
| categories | Editable income/expense categories |
| transactions | Actual income, expense and transfer records |
| goals | Optional kind (`goal` or `jar`), target, method, account, deadline and contribution rules. Existing records without kind remain goals. |
| allocations | Signed reserve entries; history of contributions/releases |
| applications | Captured percentage rules per eligible income/goal pair |
| budgets | Category/month limit in cents |
| recurring | Payment details, cadence, anchor day, next date, paused flag |
| occurrences | Unique schedule/date confirmations and skips |
| fixedConfirmations | Unique goal/month confirmations |
| processed | Mutation request IDs, including restores |

All calculations happen in `lib/finance.ts` and are repeated **on the server**. The browser cannot submit authoritative balances. A mutation validates a complete next state, then atomically updates it using `WHERE owner=? AND revision=?`. Only one of two writes based on the same revision succeeds. Conflicts return HTTP 409; the UI loads the new version and asks you to review and save again. A lost response retains the same command ID; a retry recognizes an already committed command. Before replay, per-record fingerprints detect edits from another device, including forms opened before a refresh. The cloud record wins; the local change is retained as a reviewable draft and is not included in displayed balances until explicitly reapplied. Relative contributions are revalidated against current cloud funds. Already-confirmed recurring occurrences are removed from the queue without duplicates. Old monthly suggestions and changed full restores become drafts, rather than silently applying in another month or over newer data.

This document design deliberately trades large-ledger scalability for simple atomic accounting per user. Validation caps the document at **1.5 million JSON characters** and each collection at 20,000 entries. The whole document is read/polled, so large ledgers should migrate to normalized tables or a transactional Durable Object before reaching these limits. Never silently prune idempotency or confirmation history.

## Financial rules

- All money is a safe integer number of **eurocents**. Inputs accept at most two decimal places. Negative opening balances are supported; expense/income/transfer amounts must be positive.
- Opening balances do not count as income. Transfers have a negative leg and positive leg and do not affect income/expense statistics.
- `Available to Spend = sum(account balances) − sum(goal reserves)`. Dedicated savings accounts remain in total balance and are **not subtracted again**. Upcoming bills are not deducted from this metric.
- A contribution cannot exceed unreserved money. A dedicated account cannot spend or transfer money still reserved for goals. An edit/deletion that would leave an unfunded reserve is rejected; release the reserve first.
- Dedicated contributions may transfer from another active account, or reserve money already in the goal's account by selecting that same account as the source. Releasing a reserve does not move cash: make a separate own-account transfer if needed.
- Open-ended jars use `kind: "jar"`, target `0` and an empty deadline. They never display completion progress or a projected finish date. Their optional percentage/monthly rules have no target cap, while the same available-funds and idempotency safeguards apply. This is an additive document change; existing goals and backups remain compatible.
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

The app itself does not send financial records to analytics or external services. Theme and the last chosen account ID are local preferences. D1 is the canonical store; the encrypted device copy permits offline use after a first successful online sign-in. The PWA worker does not cache private server HTML/API data. Offline snapshots and the outbox are encrypted with AES-GCM in IndexedDB, using a non-extractable device key stored in the same browser profile. This is not a separate PIN/biometric lock: anyone with access to that browser profile may be able to view the offline ledger. Signing out clears that account’s device snapshot and encryption key after all queued changes and drafts are resolved. Previous accounts’ copies remain separate; do not share a browser profile without signing out. A shared device should be signed out after use.

## Public GitHub source

Only application source, schema/migrations, tests, static icons, lockfile, documentation and `.env.example` belong in the public repository. Never commit `.env`, `.dev.vars`, `.wrangler`, `.sites-runtime`, database files or backups. `.gitignore` excludes these. No personal ledger is seeded; sample data exists only in `lib/demo.ts`.

Public source: https://github.com/vroggi/pocket-ledger. Clone it with `git clone https://github.com/vroggi/pocket-ledger.git` and follow the setup instructions above. The included GitHub Actions workflow runs financial tests, TypeScript checks and a production build. GitHub pushes do not automatically deploy the Site.

## Testing and known limits

The automated tests exercise exact cents, both transfer legs, opening balances, account archiving, expense edits/deletes, month/year boundaries, virtual/dedicated savings, double allocation prevention, income rules and edits/deletion after release, fixed contributions, recurring deduplication/skip/pause, month-end/leap-year dates, forecasts, CSV escaping, backup validation, immutable owner and versioned database writes across two devices.

Offline-extended mode requires opening the ledger online once on each device so the app shell and encrypted snapshot can be prepared. Keep the app open after reconnection to flush queued changes; background sync while the app is closed is not promised. Browser storage can be evicted; keep backups. Full backup restores require a connection and an empty outbox. Exports made while changes are queued include those unconfirmed optimistic changes. No bank integrations, investments, multi-currency, shared household ledgers, email reminders or automatic charges. Sync is polling rather than instantaneous push. Backups are manual downloads; no unattended off-site backup job is configured. Browser/PWA installation and end-to-end hosted sign-in/save checks must be verified on the final deployed URL. An untested demo or local preview must never be reported as working cloud synchronization.

## Mobile and offline build

Use **Install app** in the header. On iPhone, open in Safari and use Share → Add to Home Screen; on Android use Chrome’s Install app option. The installed app uses the same ChatGPT login and D1 database as the desktop site. Open once online on each device before expecting offline access.

`pnpm run build` first builds `offline/index.html` and its React client into ignored `public/offline/`, creates a content-versioned asset list, then builds the hosted Worker. Both UI entrypoints reuse the same Ledger component and financial/sync logic. Never commit device storage or generated offline bundles; the production build recreates them.

`lib/sync.ts` contains pure queue/reconciliation and AES-GCM functions; `app/device-cache.ts` handles IndexedDB with revision checks; `app/use-ledger.ts` coordinates user-authenticated API access and retries. Web Locks serialize tabs when available; IndexedDB compare-and-swap prevents stale device writes. Tests cover optimistic balances, acknowledgements, same-record conflicts, dependency order, underfunded reserves, stale forms, old monthly suggestions/restores and authenticated encryption.

### Install on iPhone

Open the public `/install` page in Safari. Sign in before opening your private ledger. Choose Share → Add to Home Screen,
keep **Open as Web App** enabled when offered, and tap Add. Open the new icon
online, sign in again if necessary, and wait for **Synced**. The installation guide
checks whether app files and an encrypted ledger copy exist in the current browser;
repeat the check in the installed app because its storage may be separate.
Installation requires the iPhone owner's action in Safari. No App Store account or
IPA download is needed for this web app. Device storage can still be removed by iOS;
keep backups and sync pending changes while the app is open.
