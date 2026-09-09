---
type: testplan
github: GH-8
tier: T3
tags: [user-management, auth]
date: 2026-09-09
---

# GH-8 Test Cases — Allow admins to promote and demote users safely

Plan: [[GH-8-plan]] · Story: [[GH-8-spec]] · Domains: [[user-management]] · [[auth]] ·
Feature: [[edit-user]] · Suites: [[11-testing]]

Generated from plan revision 3 (`9388c8cd…`), approved by JB. Scope record:
`.solvo/evidence/qa/GH-8-scope.json`. Candidate commit
`1f64131310b807b27980af8113fa254d1be0f8c2`.

## Curation at the cases gate

One case pruned by **JB**, by id, through `qa-scope curate`:

| Pruned | AC | Instance | Reason |
|---|---|---|---|
| `CASE-f01844cd5517` | AC9 | AC-to-scenario citations re-resolve mechanically after any `users.spec.ts` change | Citation re-resolution is evidence-pack and provenance verification, not product behaviour and not a GH-8 test obligation. **The check itself is preserved in evidence verification** — it is not being dropped, only moved off the product QA case set. |

Nothing else was pruned and nothing was added. Everything else generated stays in the set
deliberately, including the blocked agent-navigation case, all seven concurrency cases, the runnable
database-unavailable failure case and the three currently unexecutable injected-fault cases.

The standing citation-drift requirement itself still holds and is unchanged in
[[GH-8-plan]] §The citation-drift trap: any change to `users.spec.ts` invalidates every line
citation below the insertion point, and they are re-derived from `bunx playwright test --list`,
never by hand.

## How to read the columns

- **Mode** — `automated` means an existing asserting scenario covers it, named in Evidence.
  `manual` means no scenario covers it and a human must perform it. `manual (blocked)` means a
  known prerequisite is missing. `manual (unexecutable here)` means the case is well-formed but
  cannot be run in this repo as configured — see §The failure class, decomposed.
- **Evidence** — where the claim currently rests. Line numbers drift on any `users.spec.ts` edit;
  the `describe` names are the stable anchors. Review-round probes cited here are **prior
  evidence** and discharge no obligation.
- **Result** — left at `pending` for every row. Execution truth lives in the canonical `QaRun`
  that `/qa-execute` writes; nothing projects results back into this file.

## AC1 — Edit existing roles

| Case ID | Class | Behaviour instance | Title | Mode | Evidence | Result |
|---|---|---|---|---|---|---|
| `CASE-fc8aff9c9eb4` | happy | edit dialog pre-selects the target's stored role | Edit dialog pre-selects the stored role | automated | automated: client/src/pages/UserForm.test.tsx role-control cases | pending |
| `CASE-763d0c3390df` | happy | promote an agent to admin through the edit dialog | Promote agent to admin via the edit dialog | automated | automated: e2e/tests/users.spec.ts 'AC1, AC8' describe (:461) | pending |
| `CASE-0e2f63ee36ad` | happy | demote an admin to agent through the edit dialog | Demote admin to agent via the edit dialog | automated | automated: users.spec.ts (:491) | pending |
| `CASE-b5e6921caab8` | boundary | the role control offers exactly the two supported roles | Role control offers exactly agent and admin | automated | automated: UserForm.test.tsx | pending |
| `CASE-79358ba5c239` | negative | no role control is rendered in create mode | Create mode renders no role control | automated | automated: users.spec.ts (:528) + UserForm.test.tsx | pending |
| `CASE-1e4a6c9fdc8a` | authz | an agent cannot reach the Users page to see the role control | Agent is kept off the Users page | manual (blocked) | BLOCKED: needs an agent at seed time; e2e/tests/auth.spec.ts:384-397 are disabled — TD-20, TD-21 | pending |
| `CASE-edf03387ba38` | concurrency | the edit dialog is submitted twice in quick succession | Double-submit of the edit dialog | manual | manual — no scenario asserts this | pending |

## AC2 — Server-side authorization

| Case ID | Class | Behaviour instance | Title | Mode | Evidence | Result |
|---|---|---|---|---|---|---|
| `CASE-0f38f165a4ad` | authz | an authenticated agent calling PUT /api/users/:id directly | Agent's direct PUT is refused | automated | automated: users.spec.ts (:546) | pending |
| `CASE-33d4aba6820d` | authz | an unauthenticated caller calling PUT /api/users/:id directly | Unauthenticated PUT is refused | automated | automated: users.spec.ts (:581) | pending |
| `CASE-a5a745e5297f` | authz | an agent attempting to promote themselves through the API | Agent self-promotion is refused | automated | automated: users.spec.ts (:601) | pending |
| `CASE-b683066b00fe` | negative | a refused non-admin request leaves the stored role unchanged | Refused non-admin requests persist nothing | automated | automated: the persistence-read pairing on :546, :581, :601 | pending |

## AC3 — Strict role validation

| Case ID | Class | Behaviour instance | Title | Mode | Evidence | Result |
|---|---|---|---|---|---|---|
| `CASE-3b1757f8e02a` | negative | an unsupported role value is rejected | Unsupported role value rejected | automated | automated: users.spec.ts (:629) | pending |
| `CASE-034cd07d8f18` | negative | the role key omitted from the payload is rejected | Omitted role key rejected (D1) | automated | automated: users.spec.ts (:651) | pending |
| `CASE-da3fe3982fe3` | boundary | a supported role in the wrong case is rejected | Wrong-case role rejected | automated | automated: users.spec.ts (:669) | pending |
| `CASE-01b7f6eaf3fa` | boundary | a null role is rejected | Null role rejected | automated | automated: users.spec.ts (:686) | pending |
| `CASE-2cdbd6772869` | negative | a request rejected on another field writes no role | Rejection on another field writes no role | automated | automated: users.spec.ts (:705) | pending |
| `CASE-cf76e6f8a1d0` | negative | a request rejected on an email conflict writes no role | 409 email conflict writes no role | automated | automated: users.spec.ts (:732) | pending |
| `CASE-bd320a8da365` | boundary | a role of the wrong JSON type is rejected | Wrong-typed role rejected | manual | manual — exercised as a round-5 review probe only (prior evidence, no scenario) | pending |
| `CASE-4c5cbc978ea4` | boundary | a whitespace-padded role string is rejected | Padded role string rejected | manual | manual — round-5 review probe only | pending |
| `CASE-dec13d846e40` | negative | unknown keys in the payload are stripped rather than rejected | Unknown payload keys are stripped, not refused | manual | manual — no scenario; deliberate design, charter CH-e0ea51e09abb probes the consequences | pending |
| `CASE-33db39bcc728` | failure | the $transaction throws part-way through the role write | Role write abandoned when the transaction throws | manual (unexecutable here) | UNEXECUTABLE: needs an injected DB fault; no fault-injection harness exists in this repo | pending |

## AC4 — Demotion takes effect for an active session

| Case ID | Class | Behaviour instance | Title | Mode | Evidence | Result |
|---|---|---|---|---|---|---|
| `CASE-1e431bc94459` | authz | a demoted admin's live session is refused on its next admin request | Demoted admin's live session stops authorizing | automated | automated: users.spec.ts (:755) | pending |
| `CASE-bc3649af0803` | authz | a non-demoting save leaves the target's live session authorized | Non-demoting save keeps the session alive | automated | automated: users.spec.ts (:801), added in c50c4f3 after the round-5 mutation probe | pending |
| `CASE-52a1c92ec305` | authz | demotion drops every session the demoted user holds, not only the observed one | All of a demoted user's sessions are dropped | manual | manual — no scenario; named by charter CH-5089a9bf18a8 | pending |
| `CASE-bd7b13b3a9a0` | boundary | demoting a user who holds no live session | Demotion with no live session | manual | manual — no scenario | pending |
| `CASE-f56472d7b045` | concurrency | a request already in flight from the target when the demotion commits | In-flight request racing the demotion | manual | manual — no scenario; named by charter CH-5089a9bf18a8 | pending |
| `CASE-968a16efa056` | failure | a failed role write leaves the target's session rows intact | Failed write does not orphan the session drop | manual (unexecutable here) | UNEXECUTABLE: needs an injected DB fault; no harness exists | pending |
| `CASE-82d42468371a` | failure | the database is unavailable when the role change is submitted | Role change with the database down | manual | manual — executable here by stopping Postgres; no scenario and never attempted | pending |

## AC5 — Promotion takes effect

| Case ID | Class | Behaviour instance | Title | Mode | Evidence | Result |
|---|---|---|---|---|---|---|
| `CASE-12783267dcac` | authz | a promoted agent's live session gains admin access without re-login | Promoted agent's live session gains admin access | automated | automated: users.spec.ts (:777) | pending |
| `CASE-7856d4f2d81f` | authz | promotion leaves the promoted user's sessions intact | Promotion does not drop sessions | automated | automated: implied by the 200 on :777 | pending |
| `CASE-a4d1053ed3d7` | happy | the promoted user's UI gains the Users nav link without a reload | Promoted user's UI reflects the new role | manual | manual — no scenario; named by charter CH-5089a9bf18a8 | pending |
| `CASE-42d510e35337` | boundary | promoting a user who is already admin | Promotion of an existing admin is a no-op | manual | manual — no scenario for another user (only the self-save case :1001) | pending |

## AC6 — Creation policy unchanged

| Case ID | Class | Behaviour instance | Title | Mode | Evidence | Result |
|---|---|---|---|---|---|---|
| `CASE-3a74e85b5ed3` | happy | POST /api/users creates a user with role agent | Creation still yields an agent | automated | automated: users.spec.ts (:838) | pending |
| `CASE-be73377209e5` | negative | POST /api/users ignores a role supplied in the body | Supplied role ignored on creation | automated | automated: users.spec.ts (:848) | pending |
| `CASE-dba40a43d9be` | negative | the create flow offers no role selection in the UI | No role selection on the create path | automated | automated: users.spec.ts (:528) + UserForm.test.tsx — overlaps the AC1 create-mode case | pending |
| `CASE-3e81e0e656b2` | boundary | POST /api/users with an explicitly null role | Null role on creation | manual | manual — no scenario | pending |

## AC7 — Existing admin deletion protection preserved

| Case ID | Class | Behaviour instance | Title | Mode | Evidence | Result |
|---|---|---|---|---|---|---|
| `CASE-559f496312c1` | authz | DELETE on a user whose stored role is admin is refused | Stored admin cannot be deleted | automated | automated: users.spec.ts (:871) | pending |
| `CASE-cc815934d5a9` | authz | DELETE is permitted once that user has been demoted | Demote-then-delete is permitted | automated | automated: users.spec.ts (:887) | pending |
| `CASE-35c1cf8f35d6` | authz | a promoted agent becomes protected from deletion | Promotion confers deletion protection | manual | manual — no scenario asserts the promotion direction | pending |
| `CASE-6cf41c88272b` | concurrency | a DELETE racing a promotion of the same user | DELETE racing a promotion | manual | manual — no scenario | pending |

## AC8 — User list reflects the canonical role

| Case ID | Class | Behaviour instance | Title | Mode | Evidence | Result |
|---|---|---|---|---|---|---|
| `CASE-3531a341aef2` | happy | the users table shows the persisted role after a promotion | Table reflects a promotion | automated | automated: users.spec.ts (:461) paired with a storedRole read | pending |
| `CASE-70c2b17e81c4` | happy | the users table shows the persisted role after a demotion | Table reflects a demotion | automated | automated: users.spec.ts (:491) paired with a storedRole read | pending |
| `CASE-0de5056628b7` | happy | GET /api/users returns the persisted role for both variants | List endpoint returns the canonical role | automated | automated: the storedRole reads on :461 and :491 | pending |
| `CASE-78e783f49e87` | concurrency | two rows changed in quick succession both repaint | Two role changes in quick succession both repaint | manual | manual — no scenario; named by charter CH-2cc508760831 | pending |
| `CASE-f171dc7ed18f` | concurrency | an edit submitted from a dialog opened before another admin changed the same user | Stale edit dialog overwrites a concurrent change | manual | manual — no scenario; named by charter CH-2cc508760831 | pending |
| `CASE-886f0f4cb5b2` | failure | the password write throws after the role write has committed | Partial write: role committed, password not | manual (unexecutable here) | UNEXECUTABLE: needs an injected crypto fault; no harness exists — TD-10 | pending |

## AC9 — Regression coverage

| Case ID | Class | Behaviour instance | Title | Mode | Evidence | Result |
|---|---|---|---|---|---|---|
| `CASE-787d07ba1eab` | happy | promotion is covered by an asserting automated scenario | Promotion has asserting automated coverage | automated | automated: users.spec.ts (:461) | pending |
| `CASE-d83278fdc416` | happy | demotion is covered by an asserting automated scenario | Demotion has asserting automated coverage | automated | automated: users.spec.ts (:491) | pending |
| `CASE-71c7e7d29ea2` | authz | direct non-admin API attempts are covered | Direct non-admin attempts have automated coverage | automated | automated: users.spec.ts (:546, :581, :601) | pending |
| `CASE-a47eb682e220` | negative | invalid role input is covered | Invalid role input has automated coverage | automated | automated: users.spec.ts (:629, :651, :669, :686) | pending |
| `CASE-269e7ea91dfa` | authz | active-session behaviour after demotion is covered | Post-demotion session behaviour has automated coverage | automated | automated: users.spec.ts (:755, :801) | pending |
| `CASE-5820d9859cd8` | happy | creation remaining agent is covered | Creation policy has automated coverage | automated | automated: users.spec.ts (:838, :848) | pending |
| `CASE-395bc1326492` | authz | preservation of admin deletion protection is covered | Admin deletion protection has automated coverage | automated | automated: users.spec.ts (:871, :887) | pending |
| `CASE-2c479a856aea` | negative | every negative scenario is paired with a persistence read | Negative scenarios are paired with persistence reads | automated | automated: the pattern across the AC2, AC3 and D2 scenarios | pending |
| `CASE-fe31661f606d` | happy | edit-mode component assertions still pass with role required | Edit-mode component regression | automated | automated: UserForm.test.tsx (28 tests) | pending |
| `CASE-0e0f8f003242` | happy | create-mode component assertions are unaffected | Create-mode component regression | automated | automated: UserForm.test.tsx create-mode cases | pending |
| `CASE-e21cff193e5e` | authz | the delete button remains absent on admin rows | Role-conditional UI regression | automated | automated: UsersPage.test.tsx:190 | pending |
| `CASE-f282c6a80cc4` | authz | the auth guard suite is untouched by this story | Auth guard suite regression | automated | automated: auth.spec.ts (31 scenarios) | pending |
| `CASE-23c59ddcf0fa` | — | the pg-boss queue reset keeps the ticket and webhook suites green | Job-queue reset regression | automated | automated: 6 consecutive clean full-suite runs recorded pre-merge — must state a run count, never a single pass | pending |

## D1 — PUT with no role key (settled ambiguity)

| Case ID | Class | Behaviour instance | Title | Mode | Evidence | Result |
|---|---|---|---|---|---|---|
| `CASE-ff5fc131b4b5` | negative | an existing integration that PUTs without role now fails closed | Breaking change: role is required on PUT | automated | automated: users.spec.ts (:651) — the same scenario as the AC3 omitted-key case, recorded here for the contract-break risk | pending |

## D2 — An admin changing their own role (settled ambiguity)

| Case ID | Class | Behaviour instance | Title | Mode | Evidence | Result |
|---|---|---|---|---|---|---|
| `CASE-4f1879078e20` | authz | an admin changing their own role is refused | Self role change refused | automated | automated: users.spec.ts (:909) | pending |
| `CASE-c53b0423cc77` | boundary | the self-role refusal is ordered before the email-uniqueness conflict | Guard ordering: 403 before 409 | automated | automated: users.spec.ts (:940); the round-4/5 guard-order mutation probe is qualitative support | pending |
| `CASE-d3521bd55821` | negative | the self-role refusal is surfaced in the edit dialog | Self-change refusal surfaced in the UI | automated | automated: users.spec.ts (:973) | pending |
| `CASE-f7929c49ce90` | happy | an admin saving their own row without changing role succeeds | Self-save with an unchanged role | automated | automated: users.spec.ts (:1001) | pending |
| `CASE-3c75ea873a5c` | concurrency | two admins demoting each other inside one request window | Mutual demotion reaching zero admins | manual | manual — accepted gap (no AC asks for a floor); charter CH-de866031b70f's subject. NOT a request to build the floor | pending |
| `CASE-c4f4a22b48af` | concurrency | ten parallel alternating role writes on one user | Parallel alternating role writes | manual | manual — round 5 ran this as a review probe (all 200); prior evidence, not coverage | pending |

## D3 — Session invalidation on demotion (settled ambiguity)

| Case ID | Class | Behaviour instance | Title | Mode | Evidence | Result |
|---|---|---|---|---|---|---|
| `CASE-c8ebee657323` | authz | the 401-versus-403 outcome pins both sides of the demoted condition | Both sides of the demoted condition are pinned | automated | automated: users.spec.ts (:755, :801); the round-5 demoted-condition mutation probe is qualitative support | pending |

## Not tied to an acceptance criterion

| Case ID | Class | Behaviour instance | Title | Mode | Evidence | Result |
|---|---|---|---|---|---|---|
| `CASE-b1dee94f6826` | negative | PUT against a user id that does not exist | Unknown user id on PUT | automated | automated: users.spec.ts (:1025) | pending |

## Steps and expected results

Full detail per case, in the same order.

### AC1 — Edit existing roles

**`CASE-fc8aff9c9eb4` — Edit dialog pre-selects the stored role** (happy, automated)

*Instance:* edit dialog pre-selects the target's stored role

1. Sign in as the seeded admin and open the Users page
2. Click Edit on a user whose stored role is agent
3. Read the role Select's current value

*Expected:* The role control shows agent — the stored role, not a default or placeholder

**`CASE-763d0c3390df` — Promote agent to admin via the edit dialog** (happy, automated)

*Instance:* promote an agent to admin through the edit dialog

1. Create an agent through POST /api/users
2. Open Edit on that user, set role to admin, save
3. Observe the PUT payload and the Users table row

*Expected:* The PUT carries role=admin, returns 200, the dialog closes and the row shows admin

**`CASE-0e2f63ee36ad` — Demote admin to agent via the edit dialog** (happy, automated)

*Instance:* demote an admin to agent through the edit dialog

1. Create a user and promote them to admin
2. Open Edit on that user, set role to agent, save
3. Observe the PUT payload and the Users table row

*Expected:* The PUT carries role=agent, returns 200 and the row shows agent

**`CASE-b5e6921caab8` — Role control offers exactly agent and admin** (boundary, automated)

*Instance:* the role control offers exactly the two supported roles

1. Render the edit form for an existing user
2. Open the role Select
3. Enumerate the options

*Expected:* Exactly two options, agent and admin — no blank, no third value

**`CASE-79358ba5c239` — Create mode renders no role control** (negative, automated)

*Instance:* no role control is rendered in create mode

1. Open the Add User dialog
2. Inspect the form for a role control

*Expected:* No role Select is present in create mode

**`CASE-1e4a6c9fdc8a` — Agent is kept off the Users page** (authz, manual (blocked))

*Instance:* an agent cannot reach the Users page to see the role control

1. Sign in as a user whose stored role is agent
2. Navigate to /users
3. Observe the redirect and the absence of a Users nav link

*Expected:* The agent is redirected away from /users and sees no Users link

**`CASE-edf03387ba38` — Double-submit of the edit dialog** (concurrency, manual)

*Instance:* the edit dialog is submitted twice in quick succession

1. Open Edit on a user and change the role
2. Trigger save twice before the first response returns
3. Read the stored role and the table

*Expected:* One effective write; the second submit neither errors visibly nor writes a different role

### AC2 — Server-side authorization

**`CASE-0f38f165a4ad` — Agent's direct PUT is refused** (authz, automated)

*Instance:* an authenticated agent calling PUT /api/users/:id directly

1. Authenticate as an agent via the request fixture
2. PUT /api/users/<other user id> with a valid role payload
3. Read the response and the stored role

*Expected:* 403 with the Forbidden body; the target's stored role is unchanged

**`CASE-33d4aba6820d` — Unauthenticated PUT is refused** (authz, automated)

*Instance:* an unauthenticated caller calling PUT /api/users/:id directly

1. Issue PUT /api/users/<id> with no session cookie
2. Read the response and the stored role

*Expected:* 401; the target's stored role is unchanged

**`CASE-a5a745e5297f` — Agent self-promotion is refused** (authz, automated)

*Instance:* an agent attempting to promote themselves through the API

1. Authenticate as an agent
2. PUT /api/users/<own id> with role=admin
3. Read the response and the stored role

*Expected:* 403; the caller's stored role is still agent

**`CASE-b683066b00fe` — Refused non-admin requests persist nothing** (negative, automated)

*Instance:* a refused non-admin request leaves the stored role unchanged

1. Run each of the three refusal paths above
2. After each, read the target user back through an admin session

*Expected:* Every refusal is paired with a read proving the stored role did not move

### AC3 — Strict role validation

**`CASE-3b1757f8e02a` — Unsupported role value rejected** (negative, automated)

*Instance:* an unsupported role value is rejected

1. As admin, PUT /api/users/<id> with role='superadmin'
2. Read the response and the stored role

*Expected:* 400; nothing written

**`CASE-034cd07d8f18` — Omitted role key rejected (D1)** (negative, automated)

*Instance:* the role key omitted from the payload is rejected

1. As admin, PUT /api/users/<id> with name and email but no role key
2. Read the response and the stored role

*Expected:* 400; nothing written — role is required on updateUserSchema

**`CASE-da3fe3982fe3` — Wrong-case role rejected** (boundary, automated)

*Instance:* a supported role in the wrong case is rejected

1. As admin, PUT /api/users/<id> with role='Admin'
2. Read the response and the stored role

*Expected:* 400 — z.enum is case-sensitive; nothing written

**`CASE-01b7f6eaf3fa` — Null role rejected** (boundary, automated)

*Instance:* a null role is rejected

1. As admin, PUT /api/users/<id> with role=null
2. Read the response and the stored role

*Expected:* 400; nothing written

**`CASE-2cdbd6772869` — Rejection on another field writes no role** (negative, automated)

*Instance:* a request rejected on another field writes no role

1. As admin, PUT with a valid role and an invalid email
2. Read the response and the stored role

*Expected:* 400; the role did not move even though it was itself valid

**`CASE-cf76e6f8a1d0` — 409 email conflict writes no role** (negative, automated)

*Instance:* a request rejected on an email conflict writes no role

1. As admin, PUT with a valid role change and an email already held by another user
2. Read the response and the stored role

*Expected:* 409; the role did not move

**`CASE-bd320a8da365` — Wrong-typed role rejected** (boundary, manual)

*Instance:* a role of the wrong JSON type is rejected

1. As admin, PUT role as each of: array, object, integer, boolean
2. Read each response and the stored role

*Expected:* 400 for every shape; nothing written

**`CASE-4c5cbc978ea4` — Padded role string rejected** (boundary, manual)

*Instance:* a whitespace-padded role string is rejected

1. As admin, PUT role=' admin '
2. Read the response and the stored role

*Expected:* 400 — no trimming before the enum check; nothing written

**`CASE-dec13d846e40` — Unknown payload keys are stripped, not refused** (negative, manual)

*Instance:* unknown keys in the payload are stripped rather than rejected

1. As admin, PUT a valid payload plus unknown keys
2. Read the response and the stored row for any effect of those keys

*Expected:* 200, the unknown keys silently stripped and nothing extra written — updateUserSchema has no .strict() by decision

**`CASE-33db39bcc728` — Role write abandoned when the transaction throws** (failure, manual (unexecutable here))

*Instance:* the $transaction throws part-way through the role write

1. Inject a fault so prisma.$transaction rejects during the PUT
2. Issue a valid role change
3. Read the stored role and the target's session rows

*Expected:* Nothing persisted — no role change and no session deletion — and the caller sees a 500

### AC4 — Demotion takes effect for an active session

**`CASE-1e431bc94459` — Demoted admin's live session stops authorizing** (authz, automated)

*Instance:* a demoted admin's live session is refused on its next admin request

1. Sign in as admin A in context 1 and as admin B in context 2
2. B demotes A to agent
3. A issues GET /api/users on the same session

*Expected:* 401 — A's session rows were dropped in the same transaction as the role write

**`CASE-bc3649af0803` — Non-demoting save keeps the session alive** (authz, automated)

*Instance:* a non-demoting save leaves the target's live session authorized

1. Sign in as admin A in context 1 and as admin B in context 2
2. B saves A's row without changing A's role
3. A issues an admin-only request

*Expected:* A's session still resolves; an unrelated refusal reads 403, never 401 — the narrow side of the demoted condition

**`CASE-52a1c92ec305` — All of a demoted user's sessions are dropped** (authz, manual)

*Instance:* demotion drops every session the demoted user holds, not only the observed one

1. Sign the same user in from three independent contexts
2. Demote that user from a separate admin session
3. Issue a request from each of the three contexts

*Expected:* All three are refused — deleteMany is not scoped to the observed session

**`CASE-bd7b13b3a9a0` — Demotion with no live session** (boundary, manual)

*Instance:* demoting a user who holds no live session

1. Create an admin who has never signed in
2. Demote them
3. Read the response and the stored role

*Expected:* 200 and the role moves; the empty session deleteMany is a no-op rather than an error

**`CASE-f56472d7b045` — In-flight request racing the demotion** (concurrency, manual)

*Instance:* a request already in flight from the target when the demotion commits

1. Start a slow admin-only request as the target user
2. Commit the demotion from another admin session while it is in flight
3. Observe which side of the transaction boundary the in-flight request lands on

*Expected:* A characterised, stated outcome — either the pre-demotion or post-demotion answer, not an inconsistent mix

**`CASE-968a16efa056` — Failed write does not orphan the session drop** (failure, manual (unexecutable here))

*Instance:* a failed role write leaves the target's session rows intact

1. Inject a fault so the user.update inside the transaction fails
2. Issue a demotion
3. Read the stored role and the target's session rows

*Expected:* Role unchanged AND sessions intact — the two halves cannot disagree

**`CASE-82d42468371a` — Role change with the database down** (failure, manual)

*Instance:* the database is unavailable when the role change is submitted

1. Stop the helpdesk_test database
2. Issue a valid role change as admin
3. Restart the database and read the stored role and session rows

*Expected:* A 5xx surfaced to the caller, nothing persisted, and no session dropped

### AC5 — Promotion takes effect

**`CASE-12783267dcac` — Promoted agent's live session gains admin access** (authz, automated)

*Instance:* a promoted agent's live session gains admin access without re-login

1. Sign in as an agent in context 1 and as an admin in context 2
2. The admin promotes the agent to admin
3. The promoted user issues GET /api/users on the same session

*Expected:* 200 — requireAdmin reads the role fresh from the User row, no re-login needed

**`CASE-7856d4f2d81f` — Promotion does not drop sessions** (authz, automated)

*Instance:* promotion leaves the promoted user's sessions intact

1. Promote a signed-in agent from another admin session
2. Reuse the promoted user's original session

*Expected:* The original session still resolves — the session drop is demotion-only

**`CASE-a4d1053ed3d7` — Promoted user's UI reflects the new role** (happy, manual)

*Instance:* the promoted user's UI gains the Users nav link without a reload

1. Keep a promoted user's browser context open on a non-Users page
2. Promote them from another admin session
3. Observe the nav without a manual reload

*Expected:* A characterised answer: whether the Users link appears without a reload, and if not, what the user must do

**`CASE-42d510e35337` — Promotion of an existing admin is a no-op** (boundary, manual)

*Instance:* promoting a user who is already admin

1. As admin, PUT role=admin on a user whose stored role is already admin
2. Read the response, the stored role and the target's sessions

*Expected:* 200, role unchanged, sessions untouched — demoted is false so nothing is dropped

### AC6 — Creation policy unchanged

**`CASE-3a74e85b5ed3` — Creation still yields an agent** (happy, automated)

*Instance:* POST /api/users creates a user with role agent

1. As admin, POST /api/users with name, email and password
2. Read the created user's role

*Expected:* 201 and role=agent — Role.agent is hardcoded in the create path

**`CASE-be73377209e5` — Supplied role ignored on creation** (negative, automated)

*Instance:* POST /api/users ignores a role supplied in the body

1. As admin, POST /api/users with role='admin' in the body
2. Read the created user's role

*Expected:* 201 and role=agent — createUserSchema does not accept role

**`CASE-dba40a43d9be` — No role selection on the create path** (negative, automated)

*Instance:* the create flow offers no role selection in the UI

1. Open the Add User dialog and complete it
2. Inspect the POST payload

*Expected:* No role control offered and no role key in the POST body

**`CASE-3e81e0e656b2` — Null role on creation** (boundary, manual)

*Instance:* POST /api/users with an explicitly null role

1. As admin, POST /api/users with role=null in the body
2. Read the response and the created role

*Expected:* Creation succeeds with role=agent, the key stripped rather than validated

### AC7 — Existing admin deletion protection preserved

**`CASE-559f496312c1` — Stored admin cannot be deleted** (authz, automated)

*Instance:* DELETE on a user whose stored role is admin is refused

1. As admin, DELETE /api/users/<id of a user whose stored role is admin>
2. Read the response and whether deletedAt was set

*Expected:* 403 and the row is not soft-deleted

**`CASE-cc815934d5a9` — Demote-then-delete is permitted** (authz, automated)

*Instance:* DELETE is permitted once that user has been demoted

1. Demote an admin to agent
2. DELETE that user
3. Read the response and deletedAt

*Expected:* 200 and the row is soft-deleted — the guard reads the currently stored role, by design

**`CASE-35c1cf8f35d6` — Promotion confers deletion protection** (authz, manual)

*Instance:* a promoted agent becomes protected from deletion

1. Promote an agent to admin
2. DELETE that user
3. Read the response and deletedAt

*Expected:* 403 — the protection follows the stored role in both directions

**`CASE-6cf41c88272b` — DELETE racing a promotion** (concurrency, manual)

*Instance:* a DELETE racing a promotion of the same user

1. Issue DELETE and a promoting PUT on the same user in parallel from two admin sessions
2. Read the final stored role and deletedAt

*Expected:* A characterised end state — not a soft-deleted admin that neither path will now accept

### AC8 — User list reflects the canonical role

**`CASE-3531a341aef2` — Table reflects a promotion** (happy, automated)

*Instance:* the users table shows the persisted role after a promotion

1. Promote a user through the dialog
2. Read the table row and the stored role independently

*Expected:* The row shows admin and matches the stored role with no manual correction

**`CASE-70c2b17e81c4` — Table reflects a demotion** (happy, automated)

*Instance:* the users table shows the persisted role after a demotion

1. Demote a user through the dialog
2. Read the table row and the stored role independently

*Expected:* The row shows agent and matches the stored role

**`CASE-0de5056628b7` — List endpoint returns the canonical role** (happy, automated)

*Instance:* GET /api/users returns the persisted role for both variants

1. After a promotion and after a demotion, GET /api/users as admin
2. Compare each role to the stored row

*Expected:* The endpoint's role matches the stored role in both cases

**`CASE-78e783f49e87` — Two role changes in quick succession both repaint** (concurrency, manual)

*Instance:* two rows changed in quick succession both repaint

1. Change the role on two different rows in immediate succession
2. Observe the table after the ['users'] invalidation settles

*Expected:* Both rows show their new roles; neither is left stale

**`CASE-f171dc7ed18f` — Stale edit dialog overwrites a concurrent change** (concurrency, manual)

*Instance:* an edit submitted from a dialog opened before another admin changed the same user

1. Open the edit dialog on a user in one admin session
2. Change that user's role from a second admin session
3. Save the first, now-stale dialog and read the stored role

*Expected:* A characterised outcome — the stale dialog's role wins silently, and that is stated rather than discovered later

**`CASE-886f0f4cb5b2` — Partial write: role committed, password not** (failure, manual (unexecutable here))

*Instance:* the password write throws after the role write has committed

1. Inject a fault so hashPassword rejects
2. Submit a save carrying both a role change and a password
3. Read the stored role and whether the old password still authenticates

*Expected:* The divergence is characterised: the password update sits outside the $transaction, so the role change survives a failed password write

### AC9 — Regression coverage

**`CASE-787d07ba1eab` — Promotion has asserting automated coverage** (happy, automated)

*Instance:* promotion is covered by an asserting automated scenario

1. Resolve the AC1/AC8 describe from bunx playwright test --list
2. Read the assertions, not the test names

*Expected:* A scenario asserts the promoted role on both the response and a follow-up read

**`CASE-d83278fdc416` — Demotion has asserting automated coverage** (happy, automated)

*Instance:* demotion is covered by an asserting automated scenario

1. Resolve the describe from the test list
2. Read the assertions

*Expected:* A scenario asserts the demoted role on both the response and a follow-up read

**`CASE-71c7e7d29ea2` — Direct non-admin attempts have automated coverage** (authz, automated)

*Instance:* direct non-admin API attempts are covered

1. Resolve the AC2 describe
2. Read the status and body assertions

*Expected:* Authenticated-agent, unauthenticated and self-promotion attempts are each asserted

**`CASE-a47eb682e220` — Invalid role input has automated coverage** (negative, automated)

*Instance:* invalid role input is covered

1. Resolve the AC3 describe
2. Read the assertions

*Expected:* Unsupported, omitted, wrong-case and null are each asserted with a persistence read

**`CASE-269e7ea91dfa` — Post-demotion session behaviour has automated coverage** (authz, automated)

*Instance:* active-session behaviour after demotion is covered

1. Resolve the AC4 describe
2. Read the assertions on both sides of the condition

*Expected:* Both the 401 side and the 403 side are asserted

**`CASE-5820d9859cd8` — Creation policy has automated coverage** (happy, automated)

*Instance:* creation remaining agent is covered

1. Resolve the AC6 describe
2. Read the assertions

*Expected:* Both the plain create and the supplied-role create assert role=agent

**`CASE-395bc1326492` — Admin deletion protection has automated coverage** (authz, automated)

*Instance:* preservation of admin deletion protection is covered

1. Resolve the AC7 describe
2. Read the assertions

*Expected:* The 403 on a stored admin and the permitted delete after demotion are both asserted

**`CASE-2c479a856aea` — Negative scenarios are paired with persistence reads** (negative, automated)

*Instance:* every negative scenario is paired with a persistence read

1. Enumerate every negative scenario in the Role management describe
2. Confirm each is followed by a read proving nothing was written

*Expected:* The pairing holds for all of them — the pattern this story established and the case set must preserve

**`CASE-fe31661f606d` — Edit-mode component regression** (happy, automated)

*Instance:* edit-mode component assertions still pass with role required

1. cd client && bun run test
2. Read the UserForm edit-mode PUT assertions

*Expected:* All edit-mode submit assertions pass in their reshaped form

**`CASE-0e0f8f003242` — Create-mode component regression** (happy, automated)

*Instance:* create-mode component assertions are unaffected

1. cd client && bun run test
2. Read the create-mode cases

*Expected:* Unchanged and passing — a change here would mean createUserSchema was touched and AC6 is broken

**`CASE-e21cff193e5e` — Role-conditional UI regression** (authz, automated)

*Instance:* the delete button remains absent on admin rows

1. cd client && bun run test
2. Read the delete-button case for admin rows

*Expected:* No delete button on admin rows — the only pre-existing test of role-conditional UI

**`CASE-f282c6a80cc4` — Auth guard suite regression** (authz, automated)

*Instance:* the auth guard suite is untouched by this story

1. Run e2e/tests/auth.spec.ts
2. Compare to the pre-story baseline

*Expected:* All 31 pass — a failure means the middleware was modified, which the spec says not to do

**`CASE-23c59ddcf0fa` — Job-queue reset regression** (no class, automated)

*Instance:* the pg-boss queue reset keeps the ticket and webhook suites green

1. Run the full E2E suite from a cold database more than once
2. Record the run count and the pending/failed job counts

*Expected:* ticket-detail and webhook-inbound-email stay green across repeated runs; pgboss.queue is never truncated

### D1 — PUT with no role key (settled ambiguity)

**`CASE-ff5fc131b4b5` — Breaking change: role is required on PUT** (negative, automated)

*Instance:* an existing integration that PUTs without role now fails closed

1. Replay a pre-GH-8 shaped PUT body — name and email, no role
2. Read the response and the stored role

*Expected:* 400 and nothing written — the endpoint's contract broke deliberately rather than preserving the stored role

### D2 — An admin changing their own role (settled ambiguity)

**`CASE-4f1879078e20` — Self role change refused** (authz, automated)

*Instance:* an admin changing their own role is refused

1. As admin, PUT /api/users/<own id> with the other role
2. Read the response and the stored role

*Expected:* 403 and the caller's role is unchanged

**`CASE-c53b0423cc77` — Guard ordering: 403 before 409** (boundary, automated)

*Instance:* the self-role refusal is ordered before the email-uniqueness conflict

1. As admin, PUT own id with a changed role AND an email already held by another user
2. Read the status code

*Expected:* 403, not 409 — the self-role guard precedes the uniqueness check

**`CASE-d3521bd55821` — Self-change refusal surfaced in the UI** (negative, automated)

*Instance:* the self-role refusal is surfaced in the edit dialog

1. As admin, open Edit on your own row, change the role, save
2. Observe the dialog

*Expected:* The refusal is shown in the dialog rather than failing silently or closing on an error

**`CASE-f7929c49ce90` — Self-save with an unchanged role** (happy, automated)

*Instance:* an admin saving their own row without changing role succeeds

1. As admin, open Edit on your own row, change only the name, save
2. Read the response

*Expected:* 200 — the guard fires on a role change, not on any self-edit

**`CASE-3c75ea873a5c` — Mutual demotion reaching zero admins** (concurrency, manual)

*Instance:* two admins demoting each other inside one request window

1. Sign in as two admins
2. Issue both demoting PUTs inside one request window
3. Count the remaining admins and establish what operator recovery exists

*Expected:* How easily zero admins is reached in practice, and the recovery path, are both characterised and severity-rated

**`CASE-c4f4a22b48af` — Parallel alternating role writes** (concurrency, manual)

*Instance:* ten parallel alternating role writes on one user

1. Issue ten alternating promote/demote writes on one user in parallel
2. Read every response and the final stored role

*Expected:* No deadlock and a coherent final state

### D3 — Session invalidation on demotion (settled ambiguity)

**`CASE-c8ebee657323` — Both sides of the demoted condition are pinned** (authz, automated)

*Instance:* the 401-versus-403 outcome pins both sides of the demoted condition

1. Exercise a demoting save and read the target's next request status
2. Exercise a non-demoting save and read the target's next request status

*Expected:* 401 on the demoting side and 403 on the non-demoting side — broadening the condition must fail a test

### Not tied to an acceptance criterion

**`CASE-b1dee94f6826` — Unknown user id on PUT** (negative, automated)

*Instance:* PUT against a user id that does not exist

1. As admin, PUT /api/users/<nonexistent id> with a valid payload
2. Read the response

*Expected:* 404 — the target lookup precedes every guard

## Class coverage in this set

| Class | Cases | Automated | Manual | Blocked | Unexecutable here |
|---|---|---|---|---|---|
| **happy** | 14 | 13 | 1 | 0 | 0 |
| **boundary** | 9 | 4 | 5 | 0 | 0 |
| **negative** | 14 | 13 | 1 | 0 | 0 |
| **authz** | 19 | 16 | 2 | 1 | 0 |
| **concurrency** | 7 | 0 | 7 | 0 | 0 |
| **failure** | 4 | 0 | 1 | 0 | 3 |
| _no class_ | 1 | 1 | 0 | 0 | 0 |

**No dispositions are recorded yet.** `qa-scope approve-cases` takes them in the same call as the
approval, one per class, and the tool enforces two rules that decide the order of work: a class
recorded `covered` must have a case of that class in the record, and a class recorded `waived` or
`not-applicable` must have **none**. So a class the gate wants to decline has to have its cases
pruned by id first.

## The failure class, decomposed

The plan recorded the `failure` class as *currently uncovered; a candidate for waiver/defer pending
`/qa-cases` decomposition and explicit human authority.* Here is the decomposition. Four instances,
and they do not share a fate:

| Case | Instance | Reachable here? | Why |
|---|---|---|---|
| `CASE-33db39bcc728` | `$transaction` throws part-way through the role write | **No** | Needs an injected DB fault. Not reachable by any ordinary caller. |
| `CASE-968a16efa056` | a failed role write leaves the target's session rows intact | **No** | Same injected fault; it is the other half of the same transaction. |
| `CASE-82d42468371a` | the password write throws after the role write has committed | **No** | Needs an injected crypto fault. This is TD-10's divergence, now carrying `role`. |
| `CASE-886f0f4cb5b2` | the database is unavailable when the role change is submitted | **Yes** | Stopping `helpdesk_test` needs no harness. Never attempted on this story. |

So the class is not uniformly unreachable, which is what the plan said the decomposition might
show. Three of four need a fault-injection harness this repo does not have; the fourth is a
downstream-unavailable instance a performer can run today.

That splits the gate's decision rather than settling it, and the tool's rule means it cannot be
split down the middle within one class:

- **Keep `CASE-82d42468371a`, prune the other three** → the `failure` class becomes `covered`, on the strength of
  one executable instance, with the three pruned instances recorded by id and reason.
- **Prune all four** → the class can be recorded `waived` or `not-applicable` by named authority,
  and the reason is the missing harness.

I am not choosing between those. Both need a named human and a stated reason, and the second is the
only one issue #8's constraint 5 describes.

## The five charters are unchanged and still unperformed

Cases do not discharge charters and charters do not discharge cases. The case set overlaps the
charter areas deliberately — a charter is open-ended discovery where a case is a fixed assertion —
and every charter remains an obligation `/qa-execute` will create and a human must perform, waive
or defer.

| Charter | Area | Cases in this set that touch its ground | Still only the charter's |
|---|---|---|---|
| `CH-5089a9bf18a8` | authorization and session transitions | AC4 and AC5 rows, including the all-sessions and in-flight cases | the third-session question, commit-to-request timing, the UI gaining the nav link |
| `CH-2cc508760831` | user-management regression | the AC9 regression rows, the stale-dialog and two-row-repaint cases | password-plus-role saves across the TD-10 boundary, open-ended flow discovery |
| `CH-e0ea51e09abb` | privilege-boundary abuse | the wrong-type, padded and unknown-key cases | finding a stripped key that matters late, crafted-payload discovery beyond the shapes named here |
| `CH-3590ccb0991e` | role writes on principals that cannot sign in | **none — no case in this set touches it** | the whole area: soft-deleted rows and the protected AI principal, distinguished |
| `CH-de866031b70f` | concurrent role writes and the admin floor | the mutual-demotion and parallel-write cases | how easily zero admins is reached in practice, and the operator recovery |

`CH-3590ccb0991e` having no case is deliberate and worth stating plainly: the guard that would make
it assertable was reverted at `71ad3af` on a recorded scope decision, so there is no product rule to
assert against. Characterising the end states is exactly what the charter is for.

## Known blocker ahead

`tracker.acceptanceCriteria` is still absent from `solvo.json`, unchanged as instructed. The AC
identities in this file are **authored from issue #8, not mechanically extracted**, and nothing here
should be read as mechanical AC provenance. `qa-readiness assess` will refuse outright rather than
degrade. See [[GH-8-plan]] §Adopter configuration prerequisite.

## Related

- [[GH-8-plan]] · [[GH-8-spec]] · [[GH-8-recon]] · [[GH-8-promote-demote-users]]
- [[user-management]] · [[auth]] · [[edit-user]] · [[11-testing]]
- [[09-legacy/tech-debt]] — TD-10, TD-20, TD-21, TD-22
