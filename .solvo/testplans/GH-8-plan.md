---
type: testplan
github: GH-8
tier: T3
tags: [user-management, auth]
date: 2026-09-09
---

# GH-8 Test Plan — Allow admins to promote and demote users safely

Story: [[GH-8-spec]] · Recon: [[GH-8-recon]] · Domains: [[user-management]] · [[auth]] ·
Feature: [[edit-user]] · Suites: [[11-testing]] · Memory: [[GH-8-promote-demote-users]]

## Timing — late, and the lateness matters

**This plan is being written after the work shipped.** `.solvo/state/GH-8.json` records
`phase: merge-gate`, PR [#9](https://github.com/JBM95/helpdesk/pull/9) open since
2026-09-09T08:40Z, five fresh-review rounds complete with an APPROVE at round 5, and both suites
green at `eb6af3c`. The QA pack was never run during the cycle — the evidence pack records that
itself, in `.solvo/evidence/GH-8.md` §7:

> INCOMPLETE — section 7 (Reviews) is unfillable: no qa block, no canonical QaRun, and none of the
> three exploratory charter areas issue #8 asks for, and no authority decision recorded for waiving
> them.

So this plan is not shaping dev work. It has two honest jobs, and neither is the one it was
designed for:

1. **Name the scope issue #8 asked for**, so the gap in the evidence pack stops being a blank and
   becomes either performed obligations or a recorded authority decision to waive them. The issue is
   explicit that this path be exercised: *"If a manual QA obligation is waived or deferred during
   the Solvo validation, record a real authority decision so the provenance/readiness path is
   exercised."*
2. **State what the five review rounds did and did not prove**, because a great deal of verification
   already happened and re-planning as though from zero would misrepresent it. The classification
   below distinguishes *already covered by an automated scenario*, *already probed live by a review
   round*, and *not covered by anything*. The middle category is prior evidence and nothing more: it
   discharges no QA obligation on this story. That boundary is the whole subject of
   §Exploratory charters → *Prior evidence is not performance*, and it is the correction that
   produced this revision.

The value normally created by planning at sprint commit — shaping the test design before the code
exists — is gone and cannot be recovered on this story. Recorded rather than glossed.

## This revision — what the human gate asked to change

Revision 1 was **not approved**. The gate returned changes, and this revision carries them. The
revision number itself is not written here: `qa-scope.mjs` owns it, and the current version is on
`.solvo/evidence/qa/GH-8-scope.json → planRevisions`. Listed
here rather than buried, because the corrections are about what this plan is entitled to claim:

1. **Prior review evidence is not charter performance.** Revision 1 read as though rounds 4 and 5
   had partly discharged the charters. They had not, and cannot. See §Exploratory charters →
   *Prior evidence is not performance*.
2. **No disposition is pre-authorized at plan time.** The `failure` class and the mutation target
   both had a disposition proposed in revision 1. Both are now stated as uncovered with the decision
   left where it belongs.
3. **The two manual mutation probes are qualitative evidence only.** They do not satisfy
   `quality.mutation: 60`, because no numeric mutation score exists in this repo at all.
4. **A known adopter configuration prerequisite is recorded** — `tracker.acceptanceCriteria` is
   absent from `solvo.json`. New section below.
5. **CH-3590ccb0991e is refined** so the two excluded principal kinds are distinguished rather than
   lumped together.

Unchanged and deliberately so: the T3 tier, all nine ACs verbatim, the five charter areas, the
late-QA disclosure above, the candidate commit, and the runtime/binding provenance below.

## Candidate, runtime and binding provenance

Stated in the plan's own bytes, so an approval binds to a plan that names what it was planned
against:

- **Candidate commit** — `1f64131310b807b27980af8113fa254d1be0f8c2` (`1f64131`, *chore(GH-8): advance
  to the merge gate and record PR #9*), the tip of `gh/8-promote-demote-users` and the head of PR
  [#9](https://github.com/JBM95/helpdesk/pull/9). Note the gap this creates and do not paper over
  it: the green checks recorded on the state file are at `eb6af3cf83af479d76bb5b31036709636eb78a72`,
  two commits earlier, and the two commits since are state-file and evidence-pack writes only. A
  canonical `QaRun` still has to be bound to the tree actually being merged rather than carried
  forward from `eb6af3c` — see §Evidence-pack requirements item 3.
- **QA runtime** — Solvo `6.40.4`, install mode `plugin`, root
  `C:/Users/JBMccallaghan/.claude-solvd/plugins/cache/solvd/solvo/6.40.4`.
- **Work-item binding** — `.solvo/runtime/qa/v1/GH-8.binding.json`, `runtimeId`
  `rt-556505a5c7623cba71cc118d0b112934`, `manifestDigest`
  `03c051f00478469ab7168e65a872a3541fdce10d23ce101db65193bb843972ca`. GH-8 is bound once, to this
  root. Every canonical QA mutation on this story — scope revisions, approvals, the run, results —
  must be executed from that root; a different root refuses rather than writing.

## Adopter configuration prerequisite — `tracker.acceptanceCriteria` is absent

**This is a known blocker ahead of us, recorded now rather than discovered at the readiness gate.**

`solvo.json → tracker` carries `provider`, `github.owner`, `github.repo` and
`allowNonCycleBranches`. It carries **no `acceptanceCriteria` key**. The installed 6.40.4 build
refuses on that absence rather than defaulting:

> `tracker.acceptanceCriteria` is not configured, so acceptance criteria cannot be extracted
> mechanically. […] There is no default — an invented AC representation would be a silent one.

Two facts about that refusal matter for the shape of this QA run:

- **It is a hard refusal, not a soft warning.** In `qa-readiness.mjs`, `validateAcConfig` is called
  at the top of `assess`, before any tracker or SCM acquisition. So the readiness assessment does not
  degrade to a partial answer — it produces no record at all until the key is configured.
- **Nothing else on this story compensates for it.** The nine ACs are reproduced verbatim in this
  plan and indexed to scenarios in [[GH-8-spec]] §AC → scenario index, but both of those are
  *authored* provenance. Neither is a mechanical extraction from issue #8, and neither can be
  presented as one.

**Disposition for this run: do not touch `solvo.json`.** Configuring the key mid-run would change how
AC identities are derived underneath a plan already at a human gate, and it is an adopter
configuration change, not a QA artifact. Equally, **no mechanical AC provenance is to be invented** —
not in the case set, not on the run, not in the verification comment. The correct record is the
absence.

Recorded as a **class B / adopter configuration** risk and an **anticipated readiness blocker**. It
does not block this plan's approval, it does not block `/qa-cases`, and it is expected to block the
readiness assessment at `/qa-verify`. Settling it is a configuration decision for a named human,
separate from this story.

## Grounding disclosure

Grounding **is** recorded on the state file, unlike GH-4. Four documents:
`03-domains/user-management.md`, `03-domains/auth.md`, `04-features/edit-user.md`,
`11-testing.md` — each with `band: "unrated"`. Unrated means `explore-14-doc-verifier` has never
sampled them, so their trust rating is unknown rather than good; `solvo.json →
intelligence.docTrust.groundingThreshold` is `partial`, and an unrated band does not clear it.

In practice that mattered less here than it usually would: all four documents were rewritten
*by this branch* (`git diff main...HEAD` touches `11-testing.md` +326, `edit-user.md` +120,
`user-management.md`, `auth.md`), and round 5 mechanically re-resolved 129 filename-qualified
citations across 63 documents with zero out of range. That is not a doc-verifier rating, but it is
more evidence than an unrated band usually carries.

`solvo.json → specs.functionalDir` is empty, so there is no as-is functional spec to read.
`docs/repo-wiki/_memories/` holds `GH-8-promote-demote-users.md` — this story's own memory, written
pre-merge — and `GH-4.md`. There is **no `bugfix-*` post-mortem** for user-management or auth, so
the "last time this area broke" input came from the memory's Patterns section and from
[[09-legacy/tech-debt]] instead.

BMAD is **not installed** (`solvo.json → specLayer.provider` is `bmad` with
`bmad.autoInstall: "prompt"`, but no `bmad/` or `.bmad*` directory exists). So [[test-method]] is
the method here, not a handoff contract.

## Inputs this plan was derived from

### Tier: T3 — confirmed

`tier: "T3"`, `tierConfirmedBy: "JB"` on the state file, and the `tier:T3` label is on issue #8.
Independently it is the right answer twice over:

- `solvo.json → tiers.t3Domains` is `["auth", "user-management"]`. This story sits on the seam
  between **both** of them — user-management mutates the `User` row, auth owns `User.role` and reads
  it at `require-admin.ts:5` to make an authorization decision.
- The story changes authorization state for **already-authenticated** principals. That is the
  privilege-transition risk class, not a feature-flag class.
- `tiers.blastRadiusEscalation` is `{ files: 15, callers: 40 }`. The recorded radius is 6 / 10, so
  nothing escalates *further* — T3 came from the domain trigger, not from size.

### Blast radius: recorded, not provisional

From `.solvo/state/GH-8.json` — `{ files: 6, callers: 10 }`, matching the story spec's
files-to-touch table:

| # | File | Change | Test surface it owns |
|---|------|--------|---------------------|
| 1 | `core/schemas/users.ts` | `role` added as a **required** field on `updateUserSchema` | the whole AC3 contract; `core/` has no test suite |
| 2 | `server/src/routes/users.ts` | `PUT`: load target → self-role guard → email uniqueness → transactional role write + session drop on demotion | AC2, AC3, AC4, AC7 and the self-change guard; `server/` has no test suite |
| 3 | `client/src/pages/UserForm.tsx` | role `Select`, edit mode only; `role` in the `PUT` payload | AC1, AC8 |
| 4 | `client/src/pages/UsersPage.tsx` | `EditingUser` carries `role` | AC1 plumbing |
| 5 | `client/src/pages/UserForm.test.tsx` | role-control cases; every edit-mode `PUT` assertion reshaped | the regression risk, not new behaviour |
| 6 | `e2e/tests/users.spec.ts` | the `Role management` describe, 24 new scenarios | every server-side claim |

Test-only files were changed **outside** that radius under a recorded scope decision:
`e2e/global-setup.ts`, `e2e/clear-job-queue.sql`, `e2e/tests/ticket-detail.spec.ts` — the pg-boss
job-queue leak. That is in the regression scope below even though it is not in the radius.

### Acceptance criteria — verbatim from issue #8

Reproduced in full, because a plan whose ACs live only by reference is a plan a re-groom can
invalidate without moving this file's hash.

- **AC1 — Edit existing roles:** The existing Edit User flow exposes the current role and lets an
  authenticated admin change an existing user between `agent` and `admin`.
- **AC2 — Server-side authorization:** Role mutation is accepted only through the existing
  admin-protected user-management API. A non-admin request cannot change any user's role, even if it
  calls the API directly.
- **AC3 — Strict role validation:** The API accepts only the existing `agent` and `admin` role
  values. Missing or unsupported role values are rejected without changing the stored user.
- **AC4 — Demotion takes effect for an active session:** If an authenticated admin is demoted to
  `agent`, that user's already-existing session must not continue to authorize admin-only
  `/api/users` operations on a subsequent request. This must be enforced server-side, not only by
  hiding the Users UI.
- **AC5 — Promotion takes effect:** If an authenticated agent is promoted to `admin`, subsequent
  authenticated requests can use the existing admin-only user-management APIs according to the
  normal session/authentication rules.
- **AC6 — Creation policy unchanged:** Creating a new user through `POST /api/users` still creates
  an `agent`; adding role selection to user creation is out of scope.
- **AC7 — Existing admin deletion protection preserved:** A user whose current stored role is
  `admin` remains protected by the existing `DELETE /api/users/:id` rule. A role change must not
  weaken or bypass that server-side protection.
- **AC8 — User list reflects the canonical role:** After a successful role change, `/api/users` and
  the Users page show the persisted current role without requiring a separate manual correction.
- **AC9 — Regression coverage:** Automated tests cover promotion, demotion, direct non-admin API
  attempts, invalid role input, active-session behavior after demotion, creation remaining `agent`,
  and preservation of admin deletion protection.

Plus three behaviours the ACs do not name but the spec-phase ambiguity scan settled with the issue
author, which are therefore in scope for verification:

| # | Behaviour | Decision |
|---|-----------|----------|
| D1 | `PUT` with no `role` key | **400**, nothing written. A breaking change to the endpoint's contract. |
| D2 | An admin changing their own role | **403**, ordered *before* the email-uniqueness 409. |
| D3 | Session invalidation on top of the fresh role read | **Yes, on demotion only.** `admin → agent` drops that user's sessions in the same `$transaction` as the role write. |

D3 has a direct consequence for every assertion below: a demoted user's next request is **401**
(session gone), never 403.

### The issue's own QA constraints

Issue #8 imposes five, and each one is a requirement on this plan rather than on the code:

1. Treat authorization and privilege-transition behaviour as the primary risk, not the UI control.
2. Include explicit negative cases for privilege retention after demotion and direct API calls by
   non-admin users.
3. **Include at least three distinct exploratory charter areas** — suggested: authorization/session
   transitions, user-management regression, privilege-boundary abuse.
4. Keep AC evidence mechanically attributable to the ACs; do not rely on a suite-level pass.
5. If a manual obligation is waived or deferred, record a real authority decision.

Constraint 4 is already met by [[GH-8-spec]] §AC → scenario index, which names scenarios by file and
line per AC and was re-derived from `playwright test --list` at `c50c4f3` — with the caveat in
§Adopter configuration prerequisite that the AC side of that index is authored, not mechanically
extracted. Constraint 3 is the one this plan exists to **serve**: it names the charter areas and makes
them scope. Naming them is not performing them, and this plan does not claim to have satisfied the
constraint — see §Exploratory charters → *Prior evidence is not performance*. Constraint 5 is the
human gate below.

## The pyramid at T3, in a repo with no server suite

[[test-method]] asks a T3 plan for a full pyramid. This repo cannot supply one, and the reason is
structural rather than a gap this story should close:

| Layer | Available here | What it can prove about this story |
|-------|---------------|-----------------------------------|
| **Unit — server** | **Does not exist.** `server/` has zero test files, no test script, no framework. `solvo.json → quality.tests.backend` is `"n/a: no server test suite exists in this repo"`, verified accurate by [[11-testing]] §Server and core. | Nothing. The check order in `users.ts` — the whole authorization decision — has no unit coverage and cannot get any without introducing a suite. |
| **Unit — core** | **Does not exist.** `core/` has zero test files. | Nothing. `updateUserSchema`'s `z.enum` case-sensitivity is asserted only transitively, through E2E. |
| **Component** | Vitest 4.0.18 + RTL, `cd client && bun run test`. 8 files, **142 tests** at `eb6af3c`. | AC1 and AC8 on the client side: the `Select` renders in edit mode, is pre-selected from the stored role, offers exactly two options, and both transitions reach the `PUT` payload. `UserForm.test.tsx` carries 28 tests. |
| **E2E** | Playwright 1.58.2, `bun run test:e2e`. 5 specs, **93 tests** at `eb6af3c`, 24 of them new in the `Role management` describe. | Everything server-side. This is the *only* layer that can prove AC2–AC5 and AC7 at all. |
| **Mutation** | **No tooling.** No Stryker, no config, nothing. `solvo.json → quality.mutation` is `60` — a shipped default, not a measured or measurable figure here. | See below. |

**The inverted pyramid is a recorded pre-existing conflict**, not this story's doing:
[[08-standards/conflicts]] §3 records the E2E suite outweighing the server logic it exercises, at
roughly 2.5× at HEAD. GH-8 widened it. The plan does not propose closing it — introducing a server
suite is a separate story — but it does mean every server-side claim on this story rests on a single
layer, which is a real single point of failure worth stating.

### Mutation target — no score exists, and the two probes are not one

`solvo.json → quality.mutation` is `60`. **There is no mutation tooling in this repo** — no Stryker,
no config, no script, nothing that could compute a score. So the state of the target is not "below
threshold" and not "met": **no numeric mutation score exists for this story at any commit**, and none
can be produced without introducing tooling, which §Explicitly out of scope excludes.

Two manual mutation probes *were* performed during the review rounds, and they are real evidence
worth carrying:

- Round 4's **guard-order mutation** — reordering the self-role 403 ahead of / behind the email
  409. Round 5 re-ran it independently and reproduced the single expected failure.
- Round 5's **`demoted`-condition mutation** — broadening `target.role === Role.admin && role ===
  Role.agent` to `role === Role.agent`. This one *found a real gap*: the broadened condition passed
  all 30 scenarios, because nothing pinned the narrow side. Fixed in `c50c4f3` with a scenario
  asserting **403, not 401**, on a live session after a non-demoting save. Re-applying the mutation
  now fails exactly that one test.

**What they are:** qualitative mutation evidence against the two conditions that carry the
authorization decision — hand-applied, targeted, and in the second case defect-finding.

**What they are not:** a mutation score. Two mutants killed out of two hand-chosen mutants is not a
percentage of anything, and presenting it against `quality.mutation: 60` would be inventing a
denominator. This plan therefore makes **no claim** that `quality.mutation: 60` is satisfied, waived
or measured.

**The threshold/tooling mismatch is a separate item.** `quality.mutation: 60` is a shipped default
sitting in a repo with no mutation tooling — the same shape as the `coverageWaiver` already recorded
in `solvo.json`, and like that one it is a configuration fact about the adopter rather than a
property of GH-8. If the downstream QA contract requires a disposition against that threshold, it is
recorded as its own decision by a named human, and this plan does not pre-authorize which way it
goes.

## AC → test-type map, with what each AC's evidence actually rests on

Statuses: **automated** (a scenario asserts it) · **probed** (a review round exercised it live with
no scenario behind it — prior evidence, and not a QA-lifecycle proof of anything) · **uncovered**.

| AC | Layer that proves it | Scenario anchors ([[GH-8-spec]] §AC → scenario index) | Status |
|----|---------------------|------------------------------------------------------|--------|
| AC1 | component + E2E UI | `users.spec.ts:461` promote via dialog · `:491` demote via dialog · `:528` no create-mode control · `UserForm.test.tsx` role-control cases | automated |
| AC2 | **E2E `request` only** | `:546` authenticated non-admin → 403 asserted on the `"Forbidden"` body · `:581` unauthenticated → 401 · `:601` agent self-promotion → 403 | automated |
| AC3 | **E2E `request` only** | `:629` unsupported value · `:651` key omitted (D1) · `:669` wrong case `"Admin"` · `:686` `null` · `:705` rejected on another field · `:732` rejected on email conflict | automated |
| AC4 | **E2E, two contexts** | `:755` demoted admin's live session → 401 · `:801` non-demoting save leaves the session alive (403, not 401) | automated |
| AC5 | **E2E, two contexts** | `:777` promoted agent's live session → 200, no re-login | automated |
| AC6 | E2E + component | `:838` `POST` yields `agent` · `:848` `POST` ignores a supplied role · `:528` | automated |
| AC7 | **E2E `request` only** | `:871` `DELETE` on a stored admin → 403 · `:887` permitted once demoted | automated |
| AC8 | component + E2E | `:461` and `:491`, each paired with a `storedRole` read proving the table matches the server | automated |
| AC9 | — | satisfied by the rows above | automated |
| D1 | E2E `request` | `:651` | automated |
| D2 | E2E `request` + UI | `:909` API 403 · `:940` 403 not 409 when the email is also taken · `:973` refusal surfaced in the dialog · `:1001` unchanged-role self-save → 200 | automated |
| D3 | E2E, two contexts | `:755` (401 side) and `:801` (403 side) — both sides of the condition | automated |
| — | unknown id → 404 | `:1025` | automated |

Line numbers move; the `describe` names (`AC1, AC8 …` through `AC7 …`) are the stable anchors, and
this story already learned that lesson the expensive way — see the citation-drift note below.

### Class coverage per AC — T3 generates every class

[[test-method]] declines nothing at T3 and requires a recorded disposition per class. Those
dispositions belong on the **case set**, so `/qa-cases` records them; this table is the plan's
statement of where each class lands, which is what `/qa-cases` will be reconciled against.

| Class | Where it lands on this story | Note |
|-------|------------------------------|------|
| **happy** | AC1 both directions, AC5, AC6, AC8 | covered |
| **boundary** | AC3's four rejection shapes — unsupported, omitted, wrong-case, `null`. `z.enum` case-sensitivity is the boundary that matters, and it is asserted rather than implied. | covered |
| **negative** | AC2's three refusals, AC3's four, AC7's 403, D2's four, the 404. **Every negative case is paired with a follow-up read proving nothing was persisted** — a pattern this story established and which the case set must preserve. | covered |
| **authz** | the whole story. Both role variants, both transitions, both live-session directions, plus unauthenticated. | covered |
| **concurrency** | **no automated scenario covers it.** The *known* concurrency hole is the admin floor: two admins demoting each other inside one window both pass `requireAdmin`, reaching zero admins with no in-product recovery. Accepted by JB; no AC asks for a floor. The spec explicitly declines to test it, because *"a test would encode a behaviour we do not want to lock in."* Round 5 ran 10 parallel alternating role writes — all 200, no deadlock — but that is prior review evidence, not coverage and not charter performance. | uncovered by scenarios; the accepted gap is CH-de866031b70f's subject |
| **failure** | **uncovered, and the reason is a missing harness.** Three failure modes are enumerated in [[GH-8-spec]] §Failure modes: `$transaction` throws, `hashPassword` throws (TD-10's divergence, now including `role`), and the concurrent demotion. None is reachable through the API by an ordinary caller, and asserting the first two needs injected DB/crypto faults. No fault-injection harness exists in this repo. | uncovered; a charter cannot inject a fault either |

The `failure` class is the one class this plan can see no route to `covered` for. Stated precisely:
it is **currently uncovered; a candidate for waiver/defer pending `/qa-cases` decomposition and
explicit human authority.** Two reasons that phrasing rather than a proposed disposition. The
decomposition may split the class — the concurrent-demotion instance is reachable without a fault
harness even though the two throw-paths are not — so which instances remain uncovered is not known
until the cases exist. And a disposition other than `covered` requires a named human and their
reason by [[test-method]]'s own T3 rule; a plan that pre-fills it hands the gate a decision already
made.

## Targeted regression scope

Derived from the recorded blast radius, mapped through [[11-testing]] to the suites that own each
file.

**Must be green, and each is at genuine risk:**

| Suite / describe | Risk |
|---|---|
| `UserForm.test.tsx` edit-mode `PUT` cases | `role` became required, so every edit-mode submit assertion changed shape. Highest-churn existing file on this story. |
| `UserForm.test.tsx` create-mode cases | Must be **unaffected**. A change here means `createUserSchema` was touched and AC6 is broken. |
| `UsersPage.test.tsx` (273 LOC) | Mock users need `role`; the edit-dialog case now asserts a pre-selected role. |
| `UsersPage.test.tsx:190` — delete button absent on admin rows | The only pre-existing test of role-conditional UI. |
| `users.spec.ts` Edit User (2) | Editing name+email now also submits a role and must still update the table. |
| `users.spec.ts` Create User (2) / Delete User (2) | Must be unaffected. |
| `auth.spec.ts` (31) | Should be untouched — nothing here changes login or the guards. **A failure here means the middleware was modified**, which the spec says not to do. |
| `ticket-detail.spec.ts` (4, 2 modified) | Outside the radius, changed under a recorded scope decision. The `settleTicketAndOpen` barrier is new and is where a re-introduced flake would surface. |
| `webhook-inbound-email.spec.ts` (22) | Untouched by the diff, but shares the pg-boss queue whose reset changed. |

**Baselines, measured rather than assumed** — 134 client tests / 8 files and 69 E2E / 5 files before
this story; 142 / 8 and 93 / 5 at `eb6af3c`.

**Flake is not claimed absent.** The state file is explicit: round 5 saw 2 failures in its first 11
runs of `users.spec.ts`, then 9 consecutive clean, and could not attribute them — the log was
overwritten and the preceding batch was a mutated tree. Neither reproduced in the 12 runs after.
Both named tests (`:25` columns, `:461` promote-via-dialog) fail the way a transient
`GET /api/users` failure would, since `UsersTable` swaps the table for `ErrorAlert` on query error.
What *is* proven fixed is the pg-boss backlog — reproducible, measured at 364 pending / ~4,800
failed, and verified by 6 consecutive clean full-suite runs. **Any execution record for this story
must state its run count, not a single pass.**

### The citation-drift trap — a standing requirement on any re-execution

Inserting the `c50c4f3` scenario shifted nine AC-to-scenario citations after `users.spec.ts:800` by
exactly +35, re-creating the failure class that caused blockers in rounds 1, 3 and 4. **No round
found it by inspection — only by re-resolving mechanically.** Any change to `users.spec.ts`
invalidates every line citation below the insertion point, in this plan, in
[[GH-8-spec]] §AC → scenario index, in [[11-testing]] and in [[edit-user]]. Re-derive from
`bunx playwright test --list`, never by hand.

## Exploratory charters

Five. The issue asks for at least three distinct areas and names three of them; charters 4 and 5
come from [[09-legacy/tech-debt]] and from [[user-management]] §Open questions, which is where
[[test-method]] says charters should come from.

### Prior evidence is not performance

**All five charters are unperformed. Every one of them, as of this revision.**

The `/dev-review` and fresh-review probes cited under each charter below — including everything
rounds 4 and 5 exercised live — are **prior evidence only**. They were produced by a review agent
inside the dev cycle, not by a human inside the QA lifecycle, and they carry no performer, no hashed
note, no `QaRun` and no authority. They therefore:

- do **not** satisfy any CH-* exploratory obligation, in whole or in part;
- do **not** count as partial performance that a later attempt could top up;
- do **not** license reading a charter as low-risk because a probe found nothing.

A charter is discharged exactly two ways, per [[test-method]]: a fresh human `qa-result perform`
attempt against the obligation `/qa-execute` creates, with a named performer and a hashed note — or a
current `qa-result waive` / `qa-result defer` decision by named authority. Nothing else. Not an
evidence-pack row, not the absence of a finding, and not a citation in this plan.

The probes are quoted anyway, under an *Already known* line per charter, for one purpose only: so the
performer does not spend their time re-treading ground and can aim at what is genuinely unexamined.
That is a briefing, not a credit.

`pass` on a charter means performed to completion and says nothing about defects; anything the
performer saw is a finding through `qa-findings observe`.

**CHARTER 1 — authorization and session transitions**
`CHARTER: explore authorization and session transitions with two independently-authenticated browser contexts and a principal created through POST /api/users to discover privilege retention after demotion or privilege denial after promotion.`
*From:* AC4, AC5, D3.
*Already known:* `:755` / `:777` / `:801` assert the three transition outcomes, and round 5 confirmed
the fresh role read is a live `findSession` join rather than a cookie cache. What no scenario covers:
a *third* session for the same user (does demotion drop all of them, or only the one observed?),
timing between the `$transaction` commit and the next request, and whether the promoted user's UI —
not just their API access — actually gains the Users nav link without a reload.

**CHARTER 2 — user-management regression**
`CHARTER: explore the create, edit and delete user flows as the seeded admin against a roster containing both roles to discover regressions caused by role becoming a required field on the PUT contract.`
*From:* AC6, AC7, AC9, and D1's breaking change.
*Already known:* the automated suite covers create/edit/delete and the four AC3 rejections. What no
scenario covers: an edit submitted from a **stale dialog** opened before another admin changed the
same user's role, saving with the password field populated *and* a role change together (the
password write sits outside the transaction — TD-10), and whether the `["users"]` invalidation
repaints correctly when two rows change in quick succession.

**CHARTER 3 — privilege-boundary abuse**
`CHARTER: explore PUT and DELETE on /api/users/:id with crafted payloads and mismatched identities using Playwright's request fixture to discover authorization bypasses, mass assignment and validation escapes.`
*From:* AC2, AC3, AC7, D2.
*Already known — round 5 probed a lot of this live and found nothing:* role type confusion (array,
object, int, bool, padded string) all 400; mass assignment of `id`/`deletedAt`/`emailVerified`/
`createdAt` all ignored; `__proto__` no effect. What that leaves: `updateUserSchema` has **no
`.strict()`** by deliberate decision, so unknown keys are silently stripped rather than rejected —
worth probing for a key that is stripped *late* enough to matter. Also the demote-then-delete path,
which is permitted deliberately (AC7 protects the *currently stored* role) and should be confirmed
to behave as the spec says rather than assumed.

**CHARTER 4 — role writes on principals that cannot sign in**
`CHARTER: explore role mutation on the two principal kinds GET /api/users excludes — soft-deleted rows filtered out by deletedAt, and the protected AI pseudo-user filtered out by id — with a seeded admin driving PUT and DELETE /api/users/:id against each kind separately, to discover unintended privilege state, divergent end states and lost deletability on principals the manageable-user path never shows.`
*From:* [[user-management]] §Open questions and [[09-legacy/tech-debt]] TD-22.
*Why it is a charter rather than a test:* `PUT /api/users/:id` applies neither of the two filters
`GET /api/users` uses (`users.ts:15` — `where: { deletedAt: null, id: { not: AI_AGENT_ID } }`), so an
admin can promote a principal from either excluded set. A guard covering both was written during GH-8
(`87603e7`) and **reverted on JB's decision** as out of scope, at `71ad3af`. TD-22 records three
options for settling it. The charter's job is to characterise the reachable end states, not to demand
the guard back.

**The two kinds are excluded for different reasons and must be probed separately** — revision 1
collapsed them, and that hid most of the interest:

| | Soft-deleted rows | The AI pseudo-user |
|---|---|---|
| Excluded from `GET /api/users` by | `deletedAt: null` | `id: { not: AI_AGENT_ID }` (`"ai-agent"`) |
| `deletedAt` | set | **null** — it is not deleted, it is *protected* |
| Credential | the `Account` row **survives** the soft delete — `DELETE` sets `deletedAt`, nulls `assignedToId` on that user's tickets and purges their sessions, and never touches `Account` | **none** — `seed.ts` creates the `User` row and no `Account` at all |
| Why it cannot authorize a request | `require-auth.ts:15` rejects on `session.user.deletedAt` with a 401, *after* Better Auth resolves the session | there is no credential to sign in with; the `deletedAt` guard never applies to it |
| Also referenced by | nothing — tickets were detached on delete | `agents.ts:10`, `tickets.ts:23` (`get_ticket_stats`), `webhooks.ts:77` (`assignedToId`) |

So the shared conclusion revision 1 drew — *neither can authenticate, nothing is escalated* — is
reached by two different mechanisms, and only one of them is a product guard. For the AI user the
protection is the **absence of a credential row**, which is a seeding property rather than an
authorization rule: anything that later gives that principal a credential turns a promoted `ai-agent`
row into a live admin no list shows. For soft-deleted rows the protection **is** a guard, at
`require-auth.ts:15`, and it sits after session resolution — so whether `signIn` still mints a session
for a soft-deleted user with a surviving `Account` row is the thing to establish rather than assume.

What to characterise, per kind: whether the promotion persists and what `GET /api/users` shows
afterwards; whether the principal becomes undeletable, since the `DELETE` guard reads the *stored*
role (`users.ts:147`) and so a promoted row of either kind protects itself; and for the AI user
specifically, what a role change does to ticket attribution and `get_ticket_stats`, which is a blast
radius soft-deleted rows do not have.

**CHARTER 5 — concurrent role writes and the admin floor**
`CHARTER: explore concurrent and interleaved role writes across multiple admin sessions to discover whether the roster can reach zero admins and what recovery exists if it does.`
*From:* [[GH-8-spec]] §Resolved ambiguities and [[user-management]] §Open questions.
*Already known and accepted:* two admins demoting each other inside one request window both pass
`requireAdmin` before either write commits, reaching **zero admins with no in-product recovery** —
sign-up is disabled. Accepted by JB: no AC asks for a floor, and a real one needs a serializable
transaction or row lock around a post-write admin count. Round 5 probed 10 parallel alternating
writes — all 200, no deadlock, but that is throughput, not a floor. **This charter must not be read
as asking for the floor to be built.** Its job is to establish how easily the state is reachable in
practice and what the operator recovery actually is, so the accepted risk is documented with a
severity rather than a shrug.

## Data prerequisites

- **The seed creates exactly one user, an admin** — `admin@example.com` / `password123`
  (`e2e/fixtures/auth.ts` `TEST_USERS.admin`). Every negative authorization case needs a second
  principal, and this story creates one **per test through `POST /api/users`** rather than seeding
  it. That needs no seed change and exercises AC6 as a side effect.
- **It does not unblock the two disabled tests** at `auth.spec.ts:384-397` (agent redirected from
  `/users`; no Users link for an agent). Those need an agent at *seed* time. Still disabled, still
  the shared blocker behind [[09-legacy/tech-debt]] TD-20 and TD-21.
- **Unique emails per test.** The suite runs `fullyParallel`, so collisions are real — generate with
  `Date.now()` or `crypto.randomUUID()`.
- **Two sessions are two browser contexts.** Auth is per-test login with no shared `storageState`,
  so `signIn(browser, email)` in `users.spec.ts` needed no fixture changes.
- **`server/.env.test` sets no `OPENAI_API_KEY`**, so every `classify-ticket` and
  `auto-resolve-ticket` job throws. Irrelevant to this story's ACs, but it is why the suite has
  **no coverage of any AI success path at all** — worth knowing before reading a green suite as
  broad coverage.

## Environment needs

- **`bun run test:e2e` does not work unattended on Windows.** `playwright.config.ts:29` starts the
  client with a POSIX inline-env prefix (`VITE_API_URL=… bun run …`); Playwright spawns `webServer`
  through `cmd.exe`, which has no `VAR=value cmd` form, so the client never binds 5174 and the run
  dies on `Timed out waiting 60000ms from config.webServer` before a single test executes. Nothing
  in the failure names the cause. **Workaround** — start both servers by hand in a POSIX shell, then
  run Playwright, which reuses them via `reuseExistingServer`:
  ```bash
  bun run --cwd server --env-file=.env.test src/index.ts &
  VITE_API_URL=http://localhost:3001 bun run --cwd client vite --port 5174 &
  bun run test:e2e
  ```
  The real fix (Playwright's cross-platform `env` option) was **not applied** — outside the agreed
  blast radius. Any execution record for this story must state which mechanism it used.
- `helpdesk_test` database, reset and seeded by `e2e/global-setup.ts` (`prisma migrate reset --force`
  then `bun prisma/seed.ts`), using `server/.env.test`. Teardown is a deliberate no-op.
- Global setup now also truncates `pgboss.job` via `e2e/clear-job-queue.sql` — **never
  `pgboss.queue`**, which holds the registrations a reused worker depends on.
- Ports: server 3001, client 5174 under test (3000 / 5173 in dev). Chromium only. `retries: 2` in CI
  and **0 locally** — so a local run gives no retry cover, which is the right setting for judging
  flake and the wrong one for judging pass rate from a single run.
- **No CI exists.** `.github/workflows/` holds only `claude.yml`, which responds to `@claude`
  mentions. Nothing runs on push or pull request. Per [[00-scope]], an absent pipeline is not a green
  pipeline — every gate on this story was local, and the execution record must say who ran it and
  where.

## Evidence-pack requirements (T3)

`solvo.json → quality.qa` is `{ mode: "warn", requiredFromTier: "T2", allowedEvidencePaths:
[".solvo/evidence/qa/"] }`. `warn` means an unproven obligation does not block the merge gate — it
means the omission gets recorded, which is exactly what `.solvo/evidence/GH-8.md` §7 currently does.
To move §7 from INCOMPLETE to complete, the pack needs:

1. **This plan approved** and bound to a revision — `scopeApproval.status: approved` with the
   approver, the version and the hash they saw.
2. **A curated, approved case set** with a recorded disposition for all six classes, `/qa-cases`
   next. Five of the six have a route to `covered`. The `failure` class is currently uncovered and is
   a candidate for waiver or defer — the decomposition decides which instances remain uncovered, and
   a named human decides the disposition. Neither is settled here.
3. **A canonical `QaRun`** at `.solvo/evidence/qa/GH-8-run-<commit>.json`, bound to the commit
   actually being merged — `1f64131310b807b27980af8113fa254d1be0f8c2`, per §Candidate, runtime and
   binding provenance. The recorded green checks are at `eb6af3c`, two commits earlier, so **a run
   carried forward from `eb6af3c` is not a run against the candidate** even though the two commits
   between them touch no product or test code.
4. **Five exploratory obligations**, one per charter, **all five currently unperformed**. Each is
   proven by a fresh `qa-result perform` attempt with a named performer and a hashed note — **or** by
   a current `qa-result waive` / `defer` decision by named authority. Not inferred from the absence
   of a finding, not from an evidence-pack row, and not from the dev-cycle review probes cited in
   this plan; see §Exploratory charters → *Prior evidence is not performance*.
5. **A decision on the mutation threshold, if the QA contract requires one.** Not a decision this
   plan proposes. What this plan supplies is the fact: no numeric mutation score exists, no tooling
   can produce one, and the two manual probes are qualitative evidence rather than a score. The
   `quality.mutation: 60` threshold/tooling mismatch is an adopter configuration item, handled
   separately from GH-8's own dispositions.
6. **The verification comment** on issue #8 and PR #9, per [[github-conventions]] §QA conventions,
   naming the canonical run and the full tested commit.
7. **Expected to be blocked:** the readiness assessment, because `tracker.acceptanceCriteria` is
   absent — see §Adopter configuration prerequisite. Record the refusal; do not work around it by
   configuring the key mid-run or by asserting an AC provenance nothing extracted.

Issue #8's constraint 5 makes item 4 the point rather than paperwork: *"If a manual QA obligation is
waived or deferred during the Solvo validation, record a real authority decision so the
provenance/readiness path is exercised."* Note what that instruction does and does not license. It
licenses a real waiver or defer, by a named authority, recorded through `qa-result` — for any of the
five charters, or all five. It does not license treating a charter as already discharged by the review
rounds, and it does not license this plan choosing the disposition in advance. Leaving the obligations
blank fails the instruction; so does pre-answering it.

## Explicitly out of scope for this plan

- **Introducing a server test suite.** It would move every AC2–AC7 claim off its single layer, and
  it is the highest-value testing work available in this repo — but it is a story, not a line item
  on this plan.
- **Seeding an agent user** to unblock `auth.spec.ts:384-397` and clear TD-20/TD-21.
- **Fixing `playwright.config.ts`'s Windows `webServer` invocation** — outside the blast radius, and
  GH-8 already declined it once.
- **Mutation tooling.** No Stryker, no config; introducing one is not this story's work.
- **The admin floor, attribution, and TD-22's guard.** All three are accepted gaps with recorded
  decisions. Charters 4 and 5 characterise them; neither asks for them to be closed.
- **AI-path coverage.** No `OPENAI_API_KEY` under test, so the suite exercises only failure
  branches. A real gap, unrelated to this story's ACs.

## Related

- [[GH-8-spec]] · [[GH-8-recon]] · [[GH-8-promote-demote-users]]
- [[user-management]] · [[auth]] · [[edit-user]] · [[create-user]] · [[delete-user]] ·
  [[view-users-list]]
- [[11-testing]] · [[05-api-surface]] · [[07-data-model]] · [[13-cross-cutting]]
- [[09-legacy/tech-debt]] — TD-09, TD-10, TD-20, TD-21, TD-22
- [[08-standards/conflicts]] — §3 distribution, §4 absent thresholds, §5 absent CI
- [[00-scope]] — verification is intentionally local this horizon
