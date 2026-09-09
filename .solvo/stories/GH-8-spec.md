---
type: story
github: GH-8
tier: T3
tags: [user-management, auth]
date: 2026-09-08
---

# GH-8 — Allow admins to promote and demote users safely

> **Tier** T3 (confirmed by JB) · **Domains** [[user-management]] · [[auth]] · **Feature** [[edit-user]]
> **Recon** `.solvo/reconnaissance/GH-8-recon.md` (7/7) · **Blast radius** 6 files / 10 callers

## Intent

Make `User.role` writable through the existing admin-protected Edit User flow, with the server as
the authority, so an admin can move an existing user between `agent` and `admin`. The privilege
*transition* is the deliverable, not the dropdown.

`User.role` sits on the seam [[user-management]] and [[auth]] share: user-management mutates the
`User` row, auth owns the column and reads it at `require-admin.ts:5` to make an authorization
decision. That is why this lands in both T3 domains at once.

## Resolved ambiguities

The spec-phase ambiguity scan flagged one AC and two questions no AC covered. All three were put
to the issue author (JB) and answered before build — recorded here because the answers change
observable behaviour.

| # | Question | Decision |
|---|----------|----------|
| 1 | AC3: how should `PUT /api/users/:id` treat a payload with **no** `role` key? | **`role` is required.** Absent → 400, nothing written. Follows AC3's literal "Missing or unsupported role values are rejected". |
| 2 | Not in any AC: may an admin change **their own** role? | **No — 403.** `req.user.id === :id` and a requested role differing from the caller's current role is refused. |
| 3 | AC4: is session invalidation needed on top of the verified fresh role read? | **Yes, on demotion only.** `admin → agent` also deletes that user's sessions. Promotion does not. |

Decision 1 is a **breaking change to the `PUT` contract**: today all three of `name`/`email`/
`password` must be present and any extra key — `role` included — is silently stripped
(`updateUserSchema` has no `.strict()`, see [[edit-user]] §Server trace). After this story a `PUT`
without `role` returns 400. The only caller in the repo is `UserForm.tsx:44`, which this story
updates, so the blast radius of the break is contained to this diff.

Decision 2 also closes every **sequential** path to zero admins: demoting the final admin can only
be done by that admin, and the guard refuses it. With two admins it still holds, because once A
demotes B, B's next request reads its fresh role and fails `requireAdmin`.

**Corrected at self-review — it is not a floor under concurrency.** Two admins demoting each other
inside the same window both pass `requireAdmin` before either write commits, reaching zero admins
with no in-product recovery. Accepted rather than fixed: no AC asks for a floor, and enforcing one
properly needs a serializable transaction or row lock around a post-write admin count, which is a
larger change than this story agreed. Recorded in [[user-management]] §Open questions so the guard
is not mistaken for a guarantee. An earlier draft of this spec overstated it as absolute.

`ambiguityScan: cleared` — after these answers each AC has exactly one honest reading. Recorded as
`cleared`, not as a `resolved-with-stakeholder` self-resolution, because the author was reachable
and answered directly rather than the cycle deciding on its own authority.

## Verified fact: role freshness (was the AC4 blocker)

Recon left one unknown that gated AC4 — whether `auth.api.getSession()` serves a cached `role`.
[[auth]] §How a role reaches an authorization decision reasoned it out from three repo facts but
recorded the conclusion as **"inference, not verified behaviour"**. It is now verified against the
installed library source:

- `better-auth@1.4.18` · `getSession` reads the cookie cache only when
  `options.session.cookieCache.enabled` (`dist/api/routes/session.mjs:93`). This app configures no
  `session` block at all, so that branch is dead.
- It therefore falls through to `internalAdapter.findSession(token)`
  (`dist/api/routes/session.mjs:181`), which — with no `secondaryStorage` configured — runs a live
  `findOne` on `session` with `join: { user: true }`
  (`dist/db/internal-adapter.mjs:208-215`) and returns the joined `user`.

So `session.user.role`, and hence `req.user.role`, is re-read from the `User` table on **every
request**. Role changes reach an already-authenticated session with no middleware change. AC4 and
AC5 are both satisfiable without touching `require-auth.ts` or `require-admin.ts` — which is why
neither appears in files-to-touch below, and why recon's "conditional" middleware change is now
resolved as *not needed*.

Decision 3 adds invalidation on demotion anyway, so AC4 holds **by construction** rather than
resting on a library internal that a future `session.cookieCache` setting would silently break.
Note the consequence for test assertions: a demoted user's next request returns **401** (session
gone), not 403 (session valid, role insufficient).

## Design

### Server is the authority

Role is accepted only at `PUT /api/users/:id`, already behind `requireAuth` + `requireAdmin`
(`users.ts:71`). No new route, no new middleware, no schema migration — `User.role` and the
`Role` enum already exist (`schema.prisma:46`, `:16-19`).

Order of checks in the handler, chosen so nothing is written on a rejected request:

1. `validate(updateUserSchema, …)` → 400 on a missing or unsupported `role`.
2. Load the target user once (needed for both the self-change guard and the demotion test).
   Absent → 404. *This read is new: the handler currently never loads the target.*
3. Self-change guard → 403 when `req.user.id === id` and `data.role !== targetUser.role`.
4. Existing email-uniqueness check → 409.
5. `prisma.user.update` now includes `role`.
6. When `targetUser.role === admin && data.role === agent`, delete that user's sessions —
   **batched into the same `prisma.$transaction` as step 5**, so the role write and the session
   drop cannot disagree. A demoted user is never left holding live session rows.

Step 6 reuses the only existing precedent for invalidating sessions on a change of standing,
the `session.deleteMany` in the delete handler ([[user-management]] §Delete protection). It goes
further than that precedent by making the pair atomic: the delete handler's three writes are still
unbatched ([[tech-debt|TD-09]]), and this story did not change them.

**The password write stays outside that transaction.** Folding it in would close [[tech-debt|TD-10]],
which is a pre-existing item this story did not agree to fix — so the profile/password divergence
TD-10 describes still stands, and TD-10 is updated to say so rather than being marked closed.

### Demote-then-delete is permitted, deliberately

AC7 is explicit that the delete rule protects "a user whose **current stored role** is `admin`".
The rule at `users.ts:115-118` reads the stored role at delete time, so demoting an admin and then
deleting them is two individually-legal steps reaching an outcome the rule blocks in one. AC7 asks
that the protection not be *weakened* — it does not ask that this path be closed. Left open, and
recorded here as the reading being built. This answers the **demote-then-delete** open question in
[[user-management]] §Open questions as "intended".

### Not changing

- `POST /api/users` — still hardcodes `role: Role.agent` (`users.ts:45`). AC6.
- `createUserSchema` — no `role` key. AC6.
- `require-auth.ts` / `require-admin.ts` — untouched; see the verified fact above.
- `users.ts:115-118` delete protection — untouched. AC7.
- No `.strict()` on `updateUserSchema`. Rejecting *unknown* keys is a wider contract change than
  any AC asks for; other extra keys stay silently stripped.
- No attribution. There is no `modifiedBy` column anywhere ([[auth]], [[user-management]] §Open
  questions) and the issue puts an audit-log subsystem out of scope, so a role change leaves no
  record of who made it. **Accepted gap, carried forward, not closed by this story.**
- `server/prisma/seed.ts` — untouched. Test principals are created through the API instead; see
  the test map.

## Files to touch

| # | File | Change |
|---|------|--------|
| 1 | `core/schemas/users.ts` | Add required `role: z.enum([Role.agent, Role.admin])` to `updateUserSchema` only. Import `Role` from `core/constants/role.ts` per the house rule against hardcoded strings. |
| 2 | `server/src/routes/users.ts` | `PUT` handler: destructure `role`, load the target user, self-change guard, include `role` in the update, invalidate sessions on demotion. |
| 3 | `client/src/pages/UserForm.tsx` | Add a shadcn `Select` for role in **edit mode only**; add `role` to `UserData`; default it from the passed user; include it in the `PUT` payload. |
| 4 | `client/src/pages/UsersPage.tsx` | Add `role` to `EditingUser` so it reaches `UserForm`. |
| 5 | `client/src/pages/UserForm.test.tsx` | New role-control cases; existing edit-mode `PUT` assertions now carry `role`. |
| 6 | `e2e/tests/users.spec.ts` | Role-transition and API-level authorization cases (AC2–AC5, AC7). |

**Six files, corrected after the fresh review.** An earlier draft of this table listed eight,
including `client/src/pages/UsersTable.tsx` and `client/src/pages/UsersPage.test.tsx`. Neither
needed changing and neither was changed: `UsersTable` already passes the whole row through
`onEdit` (so `role` was flowing before this story — only `UsersPage`'s `EditingUser` interface
narrowed it away), and `UsersPage.test.tsx`'s mock users already carried `role`. Recon's
conditional file (`require-auth.ts` / `require-admin.ts`) is **not** needed either — resolved
above. Anything beyond this list is scope drift and, at T3, a hard pause.

## AC → test map

No server test suite exists and none is being introduced ([[11-testing]] §Server and core: verified
absent — `solvo.json` records `backend: "n/a"`). Every server-side claim is therefore proven by
Playwright, using the `request`-fixture pattern that `webhook-inbound-email.spec.ts` already
establishes for API-level assertions. This matches CLAUDE.md's policy rather than bending it: these
are genuinely full-stack authorization claims, not rendering checks.

**Second principal.** The seed creates exactly one user, an admin ([[11-testing]] §Authorization
coverage today) — so no negative authorization case is expressible without another. Test setup
creates one through `POST /api/users` with a unique email, which needs no seed change and exercises
AC6 as a side effect. Two independently-authenticated sessions are two browser contexts; the suite
needs no fixture changes for this ([[11-testing]] §Can the suite express a two-session test?).

| AC | Claim | Test | Layer |
|----|-------|------|-------|
| AC1 | Edit dialog exposes current role and can change it | role `Select` renders in edit mode, pre-selected from the user, absent in create mode; changing it puts `role` in the `PUT` body | component (`UserForm.test.tsx`) |
| AC1 | Same, end to end | admin edits a user's role in the dialog and saves | E2E |
| AC2 | Only the admin-protected API mutates role | agent's authenticated context `PUT`s a role → **403**; unauthenticated `PUT` → **401** | E2E (`request`) |
| AC3 | Strict validation | `role: "superuser"` → 400 · `role` omitted → 400 · `role: null` → 400 · `role: "Admin"` → 400 (`z.enum` is case-sensitive); in each case a follow-up `GET` shows the stored role **unchanged** | E2E (`request`) |
| AC4 | Demotion binds an active session | admin context demotes an admin user who already has a live session; that user's next `GET /api/users` → **401** (session invalidated) | E2E (two contexts) |
| AC5 | Promotion binds an active session | admin context promotes an agent who already has a live session; that same session's next `GET /api/users` → **200**, no re-login. *This is the test that proves the fresh role read.* | E2E (two contexts) |
| AC6 | Creation policy unchanged | `POST /api/users` returns `role: "agent"`; no role control in create mode | E2E (extends `users.spec.ts:137-149`) + component |
| AC7 | Delete protection preserved | `DELETE` on a user whose stored role is `admin` → **403** at the API, not merely a hidden button | E2E (`request`) |
| AC8 | List reflects canonical role | after a role change the table badge shows the new role without a manual refresh (`["users"]` invalidation already exists at `UserForm.tsx:51`) | component + E2E |
| AC9 | Regression coverage | satisfied by the seven rows above; the negative and transition cases are the point |  |
| — | Self-change guard (decision 2) | admin `PUT`s their own id with the other role → **403**, own role unchanged; and the same refusal driven **through the dialog**, asserting the server's message reaches the user rather than being swallowed | E2E (`request` + UI) |

AC7's row is a genuine coverage gain: [[11-testing]] §Authorization coverage today records that
**no test anywhere asserts authorization at the API level** — every current authorization assertion
is a UI observation. This story adds the first ones.

## Anti-regression plan

Existing tests that must stay green, and why each is at risk:

| Test | Risk from this change |
|------|----------------------|
| `UserForm.test.tsx` — edit-mode `PUT` cases (287 LOC) | `role` becomes required, so every edit-mode submit assertion changes shape. Highest-churn existing file. |
| `UserForm.test.tsx` — create-mode cases | Must be **unaffected**. If a create test changes, `createUserSchema` was touched and AC6 is broken. |
| `UsersPage.test.tsx` (273 LOC) | Mock users need `role`; the edit-dialog case now asserts a pre-selected role. |
| `UsersPage.test.tsx:190` — delete button absent on admin rows | The only existing test of role-conditional UI. Must stay green. |
| `users.spec.ts` — Edit User (2 tests) | Editing name+email now also submits a role; must still update the table. |
| `users.spec.ts` — Create User (2) / Delete User (2) | Must be unaffected. |
| `auth.spec.ts` (63 tests) | Should be untouched — nothing here changes login or the guards. Any failure here means the middleware was modified, which this spec says not to do. |

Command gates: `cd client && bun run test` and `bun run test:e2e` both green before self-review,
per `solvo.json → quality.tests`. A pre-existing failure is a full stop, not a baseline.

Baselines measured, not assumed: **134 client tests / 8 files** and **69 E2E tests / 5 files** before
this story. ([[11-testing]] claimed 102 E2E tests; that was wrong and is corrected there.)

Two Radix/shadcn specifics that will otherwise cost a cycle: the role control is a `Select`, so any
component test driving it needs the **PointerEvent polyfill** from
`TicketDetailPage.test.tsx:13-28`, and E2E must generate unique emails per test because the suite
runs `fullyParallel` ([[11-testing]] §Patterns).

## Rollback

No migration, no feature flag, no data backfill — `User.role` already exists and is already
populated. Reverting the commit restores the prior behaviour completely: role becomes unwritable
again and `PUT` stops requiring the key.

The one non-reversible residue is **data**, not schema: any role already changed in a real
environment stays changed, and any session already invalidated by a demotion stays invalidated
(the user simply logs in again). Neither blocks a revert.

Forward-fix preference if a problem surfaces post-merge: drop the role control from `UserForm` and
make `role` optional in `updateUserSchema`, which disables the feature while leaving the server
tolerant of both payload shapes.

## Grounding

- [[user-management]] — the as-is role handling, the delete-protection reading, and three of the
  open questions this spec closes
- [[auth]] — the guard chain, the Better Auth config, and the freshness inference this spec upgrades
  to a verified fact
- [[edit-user]] — the as-is baseline table for role mutation, and the `.strict()` absence
- [[11-testing]] — the single-admin seed, the absent server suite, the API-assertion pattern, and
  the two-context recipe

Also read directly: `better-auth@1.4.18` installed source (`dist/api/routes/session.mjs`,
`dist/db/internal-adapter.mjs`) for the freshness verification above.

## Related

- [[GH-8-recon]] · [[user-management]] · [[auth]] · [[edit-user]] · [[create-user]] ·
  [[delete-user]] · [[view-users-list]] · [[11-testing]]
