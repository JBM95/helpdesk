---
tags: [testing, coverage, vitest, playwright]
---

# Testing Landscape

> Mapped by `explore-12-test-coverage-mapper` via `/setup-05-explore` — `client/` on 2026-09-07, then `server/`, `core/` and a deep `e2e/` pass on 2026-09-08.
> Scope: full-stack. Client component tests, server and core verification, and a per-test E2E inventory including fixtures, config and auth setup.
> **No tests were run.** Nothing here is a measured coverage figure.

## Frameworks

### Component tests

**Vitest 4.0.18 + React Testing Library 16.3.2.** Run with `cd client && bun run test`, or `bun run test:watch`.

Config is embedded in `client/vite.config.ts:41-50` — there is no separate `vitest.config.ts`:

```ts
test: {
  globals: true,
  environment: "jsdom",
  setupFiles: "./src/test/setup.ts",
  server: { deps: { inline: ["@tanstack/react-table"] } },
}
```

`client/src/test/setup.ts:1` imports `@testing-library/jest-dom/vitest`.

`client/src/test/render.tsx:5-14` exports `renderWithQuery(ui)`, wrapping the tree in a `QueryClient` with **retries disabled** for determinism, plus `MemoryRouter`.

Mocking convention: `vi.mock("axios")` at module top, `vi.mocked(axios, { deep: true })`, `vi.resetAllMocks()` in `beforeEach`. Used in 7 of 8 files.

### E2E

**Playwright 1.58.2.** `bun run test:e2e` from root, plus `test:e2e:ui` and `test:e2e:headed`.

From `playwright.config.ts`:
- `testDir: ./e2e/tests`, `baseURL: http://localhost:5174`
- `fullyParallel: true`
- `retries: 2` in CI only, 0 locally
- `webServer` starts both the server (port 3001, waited on via `/api/health`) and the client (5174), with `reuseExistingServer: !process.env.CI`
- Projects: chromium only
- Report to `./e2e/playwright-report`, results to `./e2e/test-results`

`e2e/global-setup.ts` runs `prisma migrate reset --force` then `bun prisma/seed.ts` against a `helpdesk_test` database using `server/.env.test`, before all tests. Teardown is a deliberate no-op — the database is left intact for debugging.

### The auth fixture — per-test login, no storage state

`e2e/fixtures/auth.ts` exports:
- `TEST_USERS.admin` — `{ email: "admin@example.com", password: "password123", name: "Admin", role: Role.admin }`. **The only user the seed creates.**
- `login(page, credentials)` — fills the form and clicks Sign In
- `loginAsAdmin(page)` — logs in and waits for the redirect to `/`
- `logout(page)` — clicks Sign Out and waits for `/login`
- `expectLoginPage(page)`, `expectHomePage(page)` — assertion helpers

The absence of shared `storageState` is the load-bearing detail: **every test authenticates its own page**, so two independently-authenticated sessions in one test are a matter of opening two contexts, not of new fixtures. See [Can the suite express a two-session test?](#can-the-suite-express-a-two-session-test) below.

## Server and core: verified absent

**`server/`** — zero test files (a glob for `**/*{test,spec}.{ts,js}` returns none), no test script in `package.json`, no test framework in its dependencies. `solvo.json`'s claim, `"backend": "n/a: no server test suite exists in this repo"`, is **confirmed accurate.** The API, the queue workers, the auth middleware and the webhook handler have no unit or integration coverage at the server layer. Everything in [[05-api-surface]] is exercised only through full-stack E2E calls.

**`core/`** — zero test files, no scripts, no test dependencies. The shared Zod schemas and constants are untested in isolation; they are exercised only transitively.

That matters for anything that needs to prove server behaviour: the only mechanisms available are a Playwright E2E spec and, for pure request/response assertions, Playwright's `request` fixture — which the webhook specs already use to call the API directly.

## Coverage threshold

**None configured, anywhere.** Verified independently across `client/vite.config.ts` (no `coverage` key in the `test` block), `playwright.config.ts`, every `package.json`, and the absence of `.nycrc` or any standalone vitest config.

**No measured line or branch percentage exists for this repo.** `solvo.json` records this honestly as `"coverageArtifact": "n/a: not measured at install — no coverage script detected"` with a `coverageWaiver` explaining why. The file-ratio table near the end of this document counts *files*, not lines, and must never be read as a coverage percentage.

## Component test inventory

Eight files, all co-located as `*.test.tsx`.

### `pages/TicketsPage.test.tsx` — 400 LOC, the largest test file in the repo

Loading skeletons; full table render (subject, sender, status badge, category label, formatted dates); empty state; error state (alert shown, table hidden); default request params (`sortBy: createdAt`, `sortOrder: desc`, `page: 1`, `pageSize: 10`); column-header sorting including the toggle on a second click; search input and its resulting `search` param; filter dropdowns rendering; pagination info with First/Previous/Next/Last and their disabled states; navigating to page 2.

Mocks `axios.get` with `{ tickets, total, page, pageSize }`. Three tests (lines 307-336) render `TicketsTable` directly to assert filter params in isolation.

**Not covered:** actually selecting a value in the status or category dropdown — only the resulting API param is asserted, not the interaction — and sort preservation across a filter change.

### `pages/TicketDetailPage.test.tsx` — 479 LOC

Loading skeletons; detail render; HTML body when `bodyHtml` is present; 404 distinguished from a generic error; ticket and agent fetches on mount; the assignment dropdown including "Unassigned" → `assignedToId: null`; the status dropdown and its `PATCH`; the category dropdown including "None" → `category: null`; the back-link href.

Carries a **jsdom PointerEvent polyfill at lines 13-28**, required for any test that drives a Radix `Select`. Reuse it rather than rediscovering the need.

### `pages/UserForm.test.tsx` — 28 tests

*Create mode:* field rendering; validation for a short name, a short password and a missing email; `aria-invalid`; `POST /api/users`; `onSuccess`; form reset; a 409 surfaced from `data.error`; a generic non-Axios error; the "Creating…" disabled state; and, since GH-8, that no role control renders and no `role` reaches the POST body.
*Edit mode:* pre-population; the "Save Changes" label; the password placeholder; an empty password permitted; `PUT` both with and without a password; `onSuccess`; the "Saving…" state; validation still enforced; update errors displayed.
*Role control* (GH-8): pre-selection from the stored role for an agent and for an admin; exactly two options offered; promotion and demotion each reaching the `PUT` payload; the chosen role reflected in the control before submitting.

**See the PointerEvent warning in [[04-features/edit-user]] §Tests before copying the Radix
polyfill from `TicketDetailPage.test.tsx` into this or any other form test.**

### `pages/UsersPage.test.tsx` — 273 LOC

Loading skeletons; table render and date formatting; fetch error; empty table; `GET /api/users`; the "New User" dialog opening; dialog close on Escape and on overlay click; the per-row edit dialog with a pre-populated form; **the delete button present on agent rows and absent on admin rows** (line 190); the delete confirmation dialog; cancel not calling delete; confirm calling `DELETE /api/users/:id`; the list refreshing afterwards.

### `components/ReplyForm.test.tsx` — 256 LOC

*Reply:* textarea and both buttons render; both disabled when empty or whitespace-only; enabled with text; `POST …/replies`; textarea cleared on success; "Sending…" state; Axios and non-Axios error paths; no alert before the first submit.
*Polish:* `POST …/replies/polish`; textarea replaced with the polished text; "Polishing…" state; each button disabled while the other mutation runs; error on failure; **the draft preserved when polish fails**; the polished text can then be sent.

### `components/ReplyThread.test.tsx` — 160 LOC

Loading skeletons; "No replies yet"; fetch on mount; fetch error; agent replies with name and "Agent" label; customer replies with sender name and "Customer" label; the fallback to "Agent" when an agent reply has no user; multiple replies.

### `components/TicketSummary.test.tsx` — 104 LOC

Button render; no card before the first click; `POST …/summarize`; summary displayed; "Summarizing…" state; error path; regeneration on a repeat click.

### `components/TicketDetail.test.tsx` — 66 LOC

Subject heading; sender name and email; "Created:" and "Updated:" labels; plain-text body when `bodyHtml` is null; HTML body when present, with the plain text then absent. Purely presentational — no API, no interaction.

## E2E inventory

**Five specs, 89 tests** — counted with `bunx playwright test --list` on 2026-09-08:
`auth.spec.ts` 31 · `users.spec.ts` 27 · `webhook-inbound-email.spec.ts` 22 ·
`tickets.spec.ts` 5 · `ticket-detail.spec.ts` 4.

> **Correction.** This section previously claimed 102 tests, with 63 in `auth.spec.ts` and
> 23 in `webhook-inbound-email.spec.ts`. Those numbers were never right — the real
> pre-GH-8 total was 69. The per-describe counts below were written by reading the source
> rather than running the lister, and the describe-level figures should be treated with the
> same suspicion until re-counted.

### `auth.spec.ts` — 31 tests across 8 describes

**Login Page** (11) — form elements visible; valid admin login redirecting home with the name in the nav; client validation for invalid email format, empty email, empty password and both empty; server validation for a non-existent user and a wrong password; the "Signing in…" disabled state via a route intercept; an already-authenticated visit to `/login` redirecting home; a server error clearing on resubmission.

**Session Persistence** (3) — session survives a reload; direct navigation to `/users` while authenticated; multiple navigations keeping the user name.

**Logout** (4) — successful logout redirects to login; `/` and `/users` both inaccessible afterwards; login required again.

**Protected Routes** (4) — unauthenticated access to `/` and to `/users` both redirect to login (one duplicated at line 304); logging in after a redirect reaches home.

**Admin Route Protection** (4 live, **2 commented out**) — admin can reach `/users`; the "Users" nav link is visible; clicking it navigates; navigating back home works.
**Lines 384-397 hold two disabled tests, commented out awaiting a seeded agent user:** *"should redirect agent to home when accessing admin route"* and *"should not show 'Users' link in navigation for agent"*. Any work that seeds an agent user can enable both.

**URL Handling** (2) — an unknown route redirects home when authenticated, to login when not.

**Navigation Bar** (3) — user name and Sign Out visible; branding visible; admin sees the "Users" link, with the agent case noted as future work.

### `users.spec.ts` — 27 tests across 11 describes

> 7 of these predate GH-8; the 20 in the `Role management` describe arrived with it and are
> summarised under Authorization coverage below.

**View Users** (1) — the table renders columns Name, Email, Role, Created, Actions. Note it asserts the **Role column exists**, so role is already displayed and column-tested.

**Create User** (2) — the dialog opens with a "Create User" heading and name/email/password fields; a successful creation returns 201 and the new row shows the correct name, email, the **`agent` role**, and both edit and delete buttons (lines 139-149).

**Edit User** (2) — the dialog opens with an "Edit User" heading, pre-populated name and email, an empty password with a "leave blank to keep current" placeholder, and a "Save Changes" button; editing name and email together updates the table and the old values disappear.

**Delete User** (2) — the delete button opens a confirmation naming the user with Cancel and Confirm; confirming removes the row.

### `tickets.spec.ts` — 5 tests across 2 describes

**Navigation** (3) — the "Tickets" link is visible when authenticated; clicking it reaches `/tickets` with the heading; unauthenticated access redirects to `/login`.

**Integration with Webhook** (2) — a ticket created through the webhook appears in the list once patched to `open`; it survives a reload.

Helpers: `createTicketViaWebhook(request, payload)` posts to `/api/webhooks/inbound-email` with the `x-webhook-secret` header, expects 201 and returns the ticket; `createTestPayload(uniqueId, overrides)` builds a valid `InboundEmailInput` with a timestamp-unique sender, subject and body.

### `ticket-detail.spec.ts` — 4 tests

Unauthenticated access to `/tickets/:id` redirects to `/login`; update persistence across a reload (status Open → Resolved, category None → Technical, assignment Unassigned → Admin, all three verified after reload); reply persistence across a reload; and a full agent workflow from list → detail → updates → reply → "Back to Tickets".

### `webhook-inbound-email.spec.ts` — 22 tests across 4 describes

**Authentication** (6) — rejects a missing secret, a wrong secret in the header, and a wrong secret in the query param, each 401; accepts the correct secret in either the header or the query param, 201.

**Validation** (9) — rejects an invalid email format, a missing email, an empty or whitespace-only subject, and an empty body; falls back to the email address as `senderName` when `fromName` is empty or whitespace; accepts a missing optional `bodyHtml` as `null`.

**Ticket Creation** (2) — a valid payload returns 201 with the right fields, `status: new`, `category: null`, and an id and timestamps; supplying `bodyHtml` populates both bodies.

**Email Threading** (6) — the same sender and subject returns 200 with the same ticket id; `Re:`, `Fwd:`, repeated `Re: Re: Re:` and lower-case `re:` all thread; a different sender or a different subject creates a new ticket.

Helpers: `toMultipart(payload)` converts to SendGrid's multipart shape; `createValidPayload(overrides)` builds a unique payload.

**This spec is the pattern to copy for any API-level assertion**, because it drives the API directly through Playwright's `request` fixture rather than through the UI.

## What has no direct test

| File | LOC | Covered indirectly? |
|------|-----|--------------------|
| `pages/HomePage.tsx` | 204 | **No — nothing covers it.** No component test, and no E2E asserts dashboard content. The largest untested surface in the client. |
| `pages/TicketsTable.tsx` | 280 | Partly, via `TicketsPage.test.tsx`. Sort preservation across a filter change is asserted nowhere. |
| `pages/UsersTable.tsx` | 119 | Fully, via `UsersPage.test.tsx`. Not used elsewhere. |
| `pages/TicketsFilters.tsx` | 73 | Partly — resulting API params are asserted through the parent; dropdown interaction is not. |
| `pages/LoginPage.tsx` | 135 | By `auth.spec.ts`. A component test would largely duplicate it. |
| `components/UpdateTicket.tsx` | 123 | Fully, via `TicketDetailPage.test.tsx:190-441`. |
| `components/Layout.tsx` | 93 | Navigation and sign-out by E2E; **the admin-only nav condition is not asserted**. |
| `components/ProtectedRoute.tsx` | 20 | Happy path only, by `auth.spec.ts`. |
| `components/AdminRoute.tsx` | 21 | Happy path only, by `auth.spec.ts`. The non-admin branch is one of the two commented-out tests. |
| `components/StatusBadge.tsx` | 20 | Indirectly, via `TicketsPage.test.tsx:98-108`. Presentational. |
| `ErrorAlert.tsx`, `ErrorMessage.tsx`, `BackLink.tsx`, `TicketDetailSkeleton.tsx` | small | Indirectly, through every test that renders them. Presentational. |

`client/src/components/ui/*` is excluded — vendored shadcn primitives, not project code.

## Authorization coverage today

Worth its own section, because it is thinner than the test count suggests.

**What exists:**
- `UsersPage.test.tsx:190` — the delete button is absent on admin rows. The only test of role-conditional UI.
- `auth.spec.ts` — the admin *can* reach `/users`, and the link is visible. Positive cases only.
- `users.spec.ts` — a newly created user is an `agent`.
- **Since GH-8 (2026-09-08), API-level authorization is asserted.** The `Role management` describe in `users.spec.ts` closes most of the gap this section used to record:
  - `requireAdmin` refuses a non-admin `PUT`, asserted on the `"Forbidden"` body so it cannot be confused with a different 403.
  - An unauthenticated `PUT` is a 401.
  - `DELETE` against a stored admin is a 403 at the API, not merely a hidden button.
  - Both role transitions, in both directions, including their effect on an **already-authenticated session**: a demoted admin's live session gets 401, a promoted agent's live session gets 200 with no re-login.
  - Invalid, missing, null and wrong-case (`"Admin"`) roles are each rejected with the stored role left unchanged — `z.enum` is case-sensitive, asserted rather than left implied.
  - An admin changing **their own** role is refused with a 403, asserted both at the API and through the dialog, where the server's message has to reach the user rather than being swallowed.

**What still does not exist:**
- **No test covers the non-admin branch** of `AdminRoute` or the admin-only nav condition — still the two tests commented out at `auth.spec.ts:384-397`. GH-8 did **not** unlock them: it creates its principals through `POST /api/users` inside each test rather than seeding one, so there is still no agent user at seed time for those tests to log in as. Enabling them remains a seed change.
- **No server-layer unit or integration tests.** Everything above is full-stack E2E, because there is still no server suite.
- **No attribution test**, because there is nothing to attribute to — no `modifiedBy` column exists ([[07-data-model]]).

The original root cause was **the seed creating exactly one user, an admin** (`server/prisma/seed.ts`, and see [[07-data-model]]). That is still true. GH-8 worked around it per-test rather than fixing it, which is why the two disabled tests remain disabled.

### Can the suite express a two-session test?

**Yes, with no fixture changes.** Because auth is per-test login with no shared `storageState`, two independently-authenticated sessions are just two browser contexts:

```ts
const adminContext = await browser.newContext();
const adminPage = await adminContext.newPage();
await loginAsAdmin(adminPage);

const userContext = await browser.newContext();
const userPage = await userContext.newPage();
await login(userPage, userBCredentials);

// adminPage mutates user B; then userPage makes a request and the result is asserted
```

`login()` and `loginAsAdmin()` already operate per page. The only prerequisite is a second principal — seeded, or created through `POST /api/users` in test setup.

For assertions that must be about the API rather than the UI, `webhook-inbound-email.spec.ts` shows the pattern: drive `request` directly and assert the status code. Combining the two — an authenticated context's cookies plus a direct API call — is what makes a server-side authorization claim testable in this repo at all.

## File-ratio table

**Not a coverage percentage.** Test *files* per source *file*.

| Area | Source files | Test files | Ratio |
|------|-------------|-----------|-------|
| `client/src/pages/` | 9 | 4 | 0.44 |
| `client/src/components/` (excl. `ui/`) | 13 | 4 | 0.31 |
| `client/src/components/ui/` | 13 | 0 | vendored, excluded |
| `core/` | 9 | 0 | 0.00 |
| `server/src/` (excl. generated) | 23 | 0 | 0.00 — no suite exists |
| `e2e/tests/` | — | 5 | 2,051 LOC, 102 tests |

Client component testing is **selective rather than systematic**: the four highest-traffic surfaces are covered thoroughly and in depth, while guards, presentational components and the dashboard are covered indirectly or not at all. That is a defensible shape at this size; it is worth knowing rather than assuming uniformity.

## Distribution against the declared policy

[[08-standards/conflicts]] §3 records the E2E suite (2,051 LOC) at roughly 1.88× the server's logic (~1,091 LOC), inverting CLAUDE.md's "prefer component tests" preference. The caveat recorded there applies here: Playwright specs are verbose by construction, so the ratio overstates the gap and is a prompt to look rather than proof of duplication. The suite's genuinely full-stack scenarios — webhook integration, session persistence, email threading — justify the allocation. Note also that with no server suite at all, E2E is the *only* place server behaviour is exercised, which is a second reason the balance sits where it does.

## Patterns a new client test should follow

1. Co-locate as `ComponentName.test.tsx` beside the source.
2. Use `renderWithQuery` from `@/test/render` for anything touching TanStack Query or the router.
3. `vi.mock("axios")` at the top, `vi.mocked(axios, { deep: true })`, `vi.resetAllMocks()` in `beforeEach`.
4. Inline mock data at the top of the file — there are no shared factories, and adding one is only worth it once data is reused across three or more files.
5. Local render and fill helpers for complex setup, as in `UserForm.test.tsx:17-32` and `TicketDetailPage.test.tsx:49-62`.
6. Assert the loading state before the success and error states.
7. Cover both Axios errors (`response.data.error`) and non-Axios errors wherever the handling differs.
8. `waitFor` for async assertions.
9. Nest `describe` blocks when a file covers distinct modes — `UserForm.test.tsx` and `ReplyForm.test.tsx` do; the other six are flat, which tells in the 400-LOC `TicketsPage.test.tsx`.
10. For any Radix dropdown, stub the pointer-capture methods and `scrollIntoView` — copy the block at the top of `UserForm.test.tsx`, **not** the one in `TicketDetailPage.test.tsx:13-28`. The latter also overwrites `window.PointerEvent` with an `Event` subclass, which breaks native click-to-submit in any file that submits a form (Radix opens on `pointerdown`; a form submit needs a real `MouseEvent`). It is harmless in `TicketDetailPage.test.tsx` only because nothing there submits a form.

## Patterns a new E2E test should follow

1. Place in `e2e/tests/` as `feature.spec.ts`.
2. Import auth helpers from `../fixtures/auth`.
3. `loginAsAdmin(page)` in `beforeEach` or per test — there is no shared storage state to reuse.
4. For webhook-driven data, copy `createTicketViaWebhook(request, payload)` from `tickets.spec.ts`: post to `/api/webhooks/inbound-email` with `WEBHOOK_SECRET` from env, expect 201, return the ticket.
5. Generate unique identifiers per test (`Date.now()` or `crypto.randomUUID()`) — the suite runs `fullyParallel`, so collisions are real.
6. Wait for API responses explicitly where the UI gives no deterministic signal: `page.waitForResponse((r) => r.url().includes("/api/…") && r.status() === 200)`.
7. Database state: global setup resets and seeds `helpdesk_test` once before all tests, and teardown is a no-op. Tests must tolerate the seeded admin already existing, and should create and clean their own data where isolation matters.
8. For an API-level assertion, drive `request` directly rather than the UI — see `webhook-inbound-email.spec.ts`.
9. **A webhook-created ticket is not quiescent.** The webhook enqueues `classify-ticket` and `auto-resolve-ticket`, and `auto-resolve` ends by writing `{ status: "open", assignedToId: null }` (`auto-resolve-ticket.ts:67-69`). Any test that sets a status or assignment on such a ticket must wait for that write first, or the job will silently revert it — see `waitForAutoResolveToSettle` in `ticket-detail.spec.ts`. Do not stand a manual `PATCH` to `"open"` in for it: it looks like the same state but does not prove the job is finished.

### The AI jobs always fail under test, and the queue used to leak between runs

`server/.env.test` sets no `OPENAI_API_KEY`, so **every** `classify-ticket` and `auto-resolve-ticket`
job throws in E2E. Two consequences worth knowing before writing a test:

- **No AI behaviour is covered end to end.** Classification never writes a category (it only writes
  on success) and auto-resolve always takes its failure branch to `open`. The `resolved`-by-AI path,
  the `ESCALATE` path and the reply-generation path have no E2E coverage at all — the suite exercises
  the failure branch exclusively. That is a genuine gap, not a deliberate exclusion.
- **`classify-ticket` rethrows, so it retries** (`retryLimit: 3`, `retryDelay: 30`, `retryBackoff`),
  producing failing jobs and log noise on a 30s cadence throughout the run. `auto-resolve-ticket`
  swallows its error and runs once.

Until GH-8 (2026-09-08) those failed jobs accumulated across runs: `prisma migrate reset` recreates
`public`, but pg-boss owns a separate `pgboss` schema the reset never touched, so each run inherited
the previous run's jobs — carrying ticket ids that no longer existed. Measured on one checkout before
the fix: **364 pending and ~4,800 failed jobs**, growing with every run, with a fresh job queuing
behind the backlog. The visible symptom was `ticket-detail.spec.ts` failing roughly 1 run in 3 while
passing in isolation, and a ticket still reading status `new` thirty seconds after its webhook
returned 201. `global-setup.ts` now truncates `pgboss.job` (never `pgboss.queue`, which holds the
registrations a reused worker depends on) — see `e2e/clear-job-queue.sql`.

**The lesson generalises:** a suite whose reliability decays with use will look flaky and get blamed
on whichever test happens to expose it. Suspect shared state that the reset does not reach.

## CI integration

**None.** `.github/workflows/` holds a single workflow, `claude.yml`, which responds to `@claude` mentions. No push or pull-request trigger builds, type-checks, lints or runs a test.

Per [[00-scope]]: an absent pipeline is not a green pipeline. Every gate here is local and unenforced — the gate is whoever remembers to run the command.

## Run commands

From root: `bun run test:e2e` (89 tests, full-stack), plus `test:e2e:ui` and `test:e2e:headed`.
From `client/`: `bun run test` (8 files, 142 tests), `bun run test:watch`.
From `server/`: nothing — no suite exists.

### `bun run test:e2e` does not work on Windows as configured

Found while running the suite for GH-8 on 2026-09-08. `playwright.config.ts` starts the client
dev server with a POSIX inline-env prefix:

```ts
command: "VITE_API_URL=http://localhost:3001 bun run --cwd client vite --port 5174",
```

Playwright spawns `webServer` commands through the platform shell, which on Windows is
`cmd.exe`. `cmd.exe` has no `VAR=value cmd` form, so it silently runs nothing, the client
never binds 5174, and the whole run dies with
`Error: Timed out waiting 60000ms from config.webServer` — before a single test executes.
Nothing in the failure names the real cause.

**Workaround** (what GH-8 used): start both servers by hand in a POSIX shell, then run
Playwright, which reuses them via `reuseExistingServer`.

```bash
bun run --cwd server --env-file=.env.test src/index.ts &
VITE_API_URL=http://localhost:3001 bun run --cwd client vite --port 5174 &
bun run test:e2e
```

**Real fix** — not applied, because it fell outside GH-8's agreed blast radius: use
Playwright's cross-platform `env` option instead of the shell prefix.

```ts
{
  command: "bun run --cwd client vite --port 5174",
  env: { VITE_API_URL: "http://localhost:3001" },
  url: "http://localhost:5174",
  reuseExistingServer: !process.env.CI,
}
```

Worth pairing with a longer `timeout`: cold Vite start-up was measured at ~22s here, which is
uncomfortably close to the 60s default once the server's own boot is added.

## Related

- [[08-standards/declared]] — the declared testing policy
- [[08-standards/conflicts]] — §3 distribution, §4 absent thresholds, §5 absent CI
- [[05-api-surface]] — exercised by E2E only; no server-level tests
- [[07-data-model]] — the single-admin seed that shapes every authorization gap above
- [[13-cross-cutting]] — the guards these tests do and do not reach
- [[03-domains/auth]] · [[03-domains/user-management]] · [[03-domains/tickets]]
- [[06-frontend-map]] — component inventory
- [[12-build-deploy]] — exact commands and environments
- [[00-scope]] — verification is intentionally local this horizon
