---
type: memory
github: GH-8
tier: T3
tags: [user-management]
date: 2026-09-09
---

# Allow admins to promote and demote users safely

**GitHub**: #8

Merge facts (date, merge SHA, merger) live in the sealed attestation and the tracker's final
comment, never copied here: at write time this file predates the merge. The PR reference is left out
for the same reason, because the file is committed before the PR opens.

## What was built (capabilities NOT to recreate)

- **`User.role` is writable**, admin-only, through the existing `PUT /api/users/:id`. No new route,
  no new middleware, no migration — `User.role` and the `Role` enum already existed.
- **`role` is a required field on `updateUserSchema`.** A `PUT` omitting it is a 400. This was a
  deliberate breaking change to the endpoint's contract, agreed with the issue author before build.
- **An admin cannot change their own role** — 403, ordered before the email-uniqueness check so an
  authorization refusal is never masked by a 409.
- **Demotion (`admin → agent`) drops that user's sessions**, batched into the same `$transaction` as
  the role write. Promotion deliberately does not, so a promoted user gains access on their existing
  session with no re-login.
- **The `PUT` handler loads its target before writing.** It never did before, which is why an
  unknown id used to reach Prisma as a `P2025` and surface as a **500** despite the wiki claiming
  404. It is now a real 404.
- **First API-level authorization assertions in the repo.** Before this story every authorization
  assertion anywhere was a UI observation ([[11-testing]] §Authorization coverage today).
- **The E2E suite no longer inherits its previous run's job queue** — see Patterns.

## Canonical locations

- `core/schemas/users.ts` — `updateUserSchema`, the single source of the role contract for both
  client and server. `createUserSchema` deliberately has no `role`.
- `server/src/routes/users.ts` — the `PUT` handler is the **only** thing in the product that mutates
  `role`. Check order: validate → load target (404) → self-role guard (403) → email uniqueness (409)
  → transactional write.
- `client/src/pages/UserForm.tsx` — the role `Select`, rendered in **edit mode only**.
- `client/src/pages/UsersPage.tsx` — `EditingUser` must carry `role` for it to reach the form.
- `e2e/tests/users.spec.ts` — the `Role management` describe, 22 scenarios, organised by AC.
- `e2e/clear-job-queue.sql` + `e2e/global-setup.ts` — the job-queue reset.

## Patterns established

- **Two independently-authenticated sessions are two browser contexts.** `signIn(browser, email)` in
  `e2e/tests/users.spec.ts` — needed no fixture changes. This is how AC4/AC5 prove a role change
  binds an already-live session.
- **A second principal is created per test through `POST /api/users`**, not seeded. The seed creates
  exactly one user, an admin. This exercises AC6 as a side effect and needs no seed change — but it
  does **not** unblock the two disabled tests in `auth.spec.ts` that need an agent at seed time.
- **API-level authorization assertions use Playwright's `request` fixture**, following
  `webhook-inbound-email.spec.ts`. Assert the response **body** (`"Forbidden"`) as well as the
  status when several rules return the same code, or the test cannot tell which one fired.
- **Pair every negative case with a follow-up read** proving nothing was persisted. A status
  assertion alone does not prove the write was skipped.
- **`prisma migrate reset` does not clear pg-boss.** It recreates `public`; pg-boss owns a separate
  `pgboss` schema. Global setup now truncates `pgboss.job` — never `pgboss.queue`, which holds the
  registrations a reused worker depends on.
- **A webhook-created ticket is not quiescent.** The `auto-resolve-ticket` job ends by writing
  `{ status: "open", assignedToId: null }`, so a test that sets a status or assignment too early has
  it silently reverted. Wait for a terminal status, then set what you need — see
  `settleTicketAndOpen` in `e2e/tests/ticket-detail.spec.ts`. Do not stand a manual `PATCH` in for
  that wait: it produces the same state without proving the job is finished.
- **A test barrier needs its own time budget.** Playwright's default per-test timeout is 30s; a 30s
  poll inside it leaves nothing for the assertions.

## Tests (regression baseline)

- **E2E**: `e2e/tests/users.spec.ts` — 29 scenarios (22 new). `e2e/tests/ticket-detail.spec.ts` — 4
  (2 modified). Full suite **91 passed / 5 files**.
- **Component**: `client/src/pages/UserForm.test.tsx` — 28 tests. Suite **142 passed / 8 files**.
- **No server suite exists** and none was introduced (`solvo.json → quality.tests.backend` is
  `n/a`). Every server-side claim above is proven through Playwright.
- Per-AC scenario identifiers: [[GH-8-spec]] §AC → scenario index.

## Future stories touching this area MUST

- Read this memory first.
- Follow these patterns or document why deviating.
- Verify these tests still pass.
- **Not assume `role` is only readable.** Much of the wiki said so before this story; every such
  claim was corrected, but older notes elsewhere may not have been.
- **Treat `session.cookieCache` as load-bearing.** Privilege *gain* on an existing session depends on
  Better Auth re-reading `role` from the row on every request, which holds only because this app
  configures no `session` block. Adding one — or `secondaryStorage` — would break AC5 silently.
  `users.spec.ts` has a live assertion of that property, so it should fail a test rather than
  regress quietly. Whether a cookie cache would stale `role` is **unverified in either direction**;
  treat it as a risk to test, not a reassurance ([[13-cross-cutting]]).

## Known limitations / follow-ups

- **No admin floor under concurrency.** Two admins demoting each other inside one request window
  both pass `requireAdmin` before either write commits, reaching zero admins with no in-product
  recovery (sign-up is disabled). Accepted by JB: no AC asked for a floor, and a real one needs a
  serializable transaction or row lock around a post-write admin count, not another `if`. The
  self-role-change guard closes every *sequential* path — do not mistake it for a guarantee.
- **No attribution.** A role change is a privilege transition that records who it happened to and
  when, but never who did it. No `modifiedBy` column exists anywhere ([[07-data-model]]); the issue
  put an audit-log subsystem out of scope.
- **[[tech-debt|TD-10]] narrowed, not closed.** The password write still sits outside the
  transaction, so a failure between them leaves the profile saved and the password unchanged.
- **[[tech-debt|TD-22]] raised.** `role` is writable on principals that cannot sign in — the AI
  pseudo-user and soft-deleted rows. Nothing is escalated, but the row ends up holding an unintended
  role and stops being deletable. A guard was written and **reverted** on JB's decision as
  out-of-scope for T3; TD-22 records the three options for settling it.
- **QA pack never ran.** No `/qa-plan`, `/qa-cases` or `/qa-verify`, so there is no `qa` block, no
  canonical `QaRun`, and none of the three exploratory charter areas the issue asks for. Recorded in
  `.solvo/evidence/GH-8.md` §7, which is `INCOMPLETE` for exactly this reason.
- **The AI branches have no E2E coverage at all.** `server/.env.test` sets no `OPENAI_API_KEY`, so
  the suite only ever exercises the AI *failure* path. The `resolved`-by-AI, `ESCALATE` and
  reply-generation paths are untested, and the suite looked like it covered them ([[11-testing]]).
- **E2E cannot run unattended on Windows.** `playwright.config.ts:29` uses POSIX inline-env syntax
  `cmd.exe` cannot execute, so `webServer` fails before any test runs ([[12-build-deploy]]).

Links: [[GH-8-spec]] · [[GH-8-recon]] · [[user-management]] · [[auth]] · [[edit-user]] ·
[[11-testing]] · [[13-cross-cutting]] · [[tech-debt]]
