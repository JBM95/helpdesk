---
type: evidence
github: GH-1
tier: T2
date: 2026-09-05
status: INCOMPLETE
---

# GH-1 — Evidence pack

**INCOMPLETE.** Two sections cannot be filled from a record: the E2E half of section 6 (13 scenarios
written, none executed — no working database credential on this machine) and the QA verification half
of section 7 (`/qa-verify` has not run). Both are named in place below.

## 1. Work item

**Preserve ticket list filters, sorting and pagination in the URL**
https://github.com/JBM95/helpdesk/issues/1

## 2. Tier

**T2**, confirmed by JB Mccallaghan at the tier gate.

Blast radius from recon: 5 files, 10 callers (the delivered diff touches 7 source files — the two core/ files came from the GATE 1 allow-list decision; still well under the 15-file threshold), against `tiers.blastRadiusEscalation` of 15 files / 40
callers — no escalation triggered. `tiers.t3Domains` is empty and nothing on the path touches auth,
PII, payments or the schema. No escalations.

## 3. Gates

| Gate | Decision | Approver | When |
|---|---|---|---|
| Tier confirmation | T2 confirmed | JB Mccallaghan | 2026-09-05 |
| AC ambiguity scan | AC4 blocked, then resolved to the retrace-only reading | JB Mccallaghan | 2026-09-05 |
| GATE 1 (plan) | approved | JB Mccallaghan | 2026-09-05T11:07:04Z |
| QA plan scope | approved, plan revision 2 | JB Mccallaghan | 2026-09-05T09:43:50Z |
| QA case set | approved, case-set revision 4 | JB Mccallaghan | 2026-09-05T12:24:08Z |
| Merge | **pending — a human merges, never the agent** | — | — |

`checks.ambiguityScan` records `resolved-with-stakeholder`: AC4's "returning to the Tickets page"
admitted two readings that touched different files. Resolved to retrace-only — browser Back and the
ticket-detail back link restore state, the global nav link does not.

## 4. Spec

`.solvo/stories/GH-1-spec.md` · recon `.solvo/reconnaissance/GH-1-recon.md` (7/7, no gaps)

`state.grounding` is `[]`. `docs/repo-wiki/` holds only scaffold READMEs in this repo, so nothing was
grounded on domain docs; recon worked from code and the QA artifacts. That is an accurate record of
what was read, not a skipped step.

| AC | Verbatim | Cases | Proven at |
|---|---|---|---|
| AC1 | Status, category and search filters are reflected in the URL. | 12 | unit + component |
| AC2 | Sort field and sort direction are reflected in the URL. | 7 | unit + component |
| AC3 | Current page is reflected in the URL. | 9 | unit + component; reload at E2E |
| AC4 | Opening a ticket and returning to the Tickets page restores the previous list state. | 7 | component (both halves of the hand-off) + E2E |
| AC5 | Browser back/forward navigation restores the corresponding list state. | 7 | component (router POP) for all 7 instances; E2E on top for the real Back button |
| AC6 | Changing a filter or sort resets pagination to page 1. | 7 | component |
| AC7 | Unknown/invalid query-param values fall back safely to supported defaults rather than breaking the page. | 14 | unit + component |
| AC8 | Empty/default values are omitted where practical so URLs remain clean. | 6 | unit + component |
| AC9 | Existing `/api/tickets` request/response behavior remains unchanged. | 5 | component regression; 1 by diff inspection |
| AC10 | Add/update component tests covering URL initialization, state changes, pagination reset, and invalid params. | — | process AC, satisfied by the above |

74 approved cases. 73 are cited by id in a test; `CASE-f338402aae86` is proven by diff inspection
because this repo has no server test suite — verified: `git diff test/solvo...HEAD -- server prisma`
is empty and `sortableColumns` holds the same five values in the same order.

## 5. Commits

Branch `gh/1-preserve-ticket-list-view-state`, cut from `test/solvo`. The repository's default branch
is `main`, but `test/solvo` is the Solvo trial branch and carries the framework install plus this
story's approved QA artifacts, so it is both the base this branch was cut from and the PR's target.
Against `main` this branch would additionally carry the two install commits and the QA-artifact
commits, which belong to the trial rather than to this story.

`git log --oneline test/solvo..HEAD`:

| Commit | Subject | `SOLVO-Run` | `SOLVO-Why` |
|---|---|---|---|
| `ec4ef62` | fix(GH-1): close the round-3 review findings | ✓ | ✓ |
| `ccc0d34` | fix(GH-1): resolve round-2 review blockers | ✓ | ✓ |
| `967ba1b` | fix(GH-1): resolve fresh-review blockers | ✓ | ✓ |
| `83ade05` | test(GH-1): add E2E specs for list state in the URL | ✓ | ✓ |
| `1818a14` | feat(GH-1): hold ticket list filters, sort and page in the URL | ✓ | ✓ |
| `153eaaa` | chore: widen the LF pin to all of .solvo | ✓ | ✓ |
| `91476c3` | chore(GH-1): record recon, spec and GATE 1 approval | ✓ | ✓ |

All seven are agent-authored and all seven carry both trailers. No human hotfix commits on this
branch. Commits after this pack are, per the PR-phase order, the pack itself plus the vault memory,
then state-file-only commits — `checks.commit` therefore names the last commit carrying code, which
is what the freshness gate expects and explicitly tolerates.

## 6. Tests

**Command**: `cd client && bun run test` (vitest run)
**Result**: 229 passed / 229, 9 files. Baseline on the branch point was 114 passed / 8 files.

**Lint**: `cd client && bun run lint` — 7 problems (5 errors, 2 warnings), identical to the base
branch. Verified by linting the stashed base, not assumed. Four errors and one warning are in files
this story does not touch; the `react-hooks/incompatible-library` warning in `TicketsTable.tsx` is in
a touched file but pre-exists, because the base calls `useReactTable` too.

**Typecheck**: 4 errors, identical to the base branch and none in files this branch touches —
`ReplyForm.test.tsx:19`, `TicketSummary.test.tsx:19`, `vite.config.ts:41` and
`server/prisma/seed-replies.ts:377`. `bun run build` is red on the base branch as well.

**Coverage**: `not run`. `solvo.json → quality.coverageArtifact` is an `n/a:` marker, no coverage
script exists in this repo, and `@vitest/coverage-v8` is not installed. The coverage gate was
**waived for this story by JB Mccallaghan at the QA plan gate**; `solvo doctor` reports the waiver as
a standing `coverage-waiver` WARN.

**E2E — obligation NOT discharged.** 13 scenarios written at
`e2e/tests/ticket-list-url-state.spec.ts` (AC3 ×1, AC4 ×5, AC5 ×7); **0 executed**.
`playwright.config.ts` starts the server with `--env-file=.env.test`, and `server/.env.test` carries a
`DATABASE_URL` whose password this machine's PostgreSQL rejects — `password authentication failed for
user "postgres"`, reproduced directly, not inferred. Postgres is listening on 5432; only the
credential is wrong, and that file is gitignored so it is per-machine. The specs parse, type-check and
are discovered by `playwright test --list`. **Nobody has seen them pass.** This is the section that
makes the pack INCOMPLETE.

AC5 is not left unverified by that. All seven of its behaviour instances have component tests that
drive a real router POP (and forward) through `useNavigate`, asserting that the controls, the footer,
the rows and the request all follow the popped URL. The E2E specs cover the real Back button on top of
that. AC3's real reload and AC4's real retrace and nav-link paths remain browser-only.

## 7. Reviews

**Self-review** — found and fixed two things in my own diff before any reviewer saw it: every
keystroke in the search box was pushing a history entry (typing "login" left five, so Back walked
back through "logi", "log", "lo"), and a test of mine asserted `window.history.length`, which never
moves under `MemoryRouter` and so would have passed against any implementation.

**Fresh review** — `fresh-reviewer`, four rounds, each independently mutation-tested the previous
round's fixes.

| Round | Verdict | Blockers | Resolution |
|---|---|---|---|
| 1 | REQUEST_CHANGES | 4 | all fixed in `967ba1b` |
| 2 | REQUEST_CHANGES | 4 | all fixed in `ccc0d34` |
| 3 | REQUEST_CHANGES | 1 | fixed in this phase — see below |
| 4 | **APPROVE** | 0 | 10 mutations applied, all caught; every numeric claim in these records independently re-measured |

The blockers that mattered, all confirmed by reproduction before fixing:

- **A space could not be typed into the search box.** `parseTicketListParams` trimmed on read while
  serialising untrimmed, and the input is controlled by the parsed value, so React restored the
  trimmed value after every keystroke: "vpn access" became "vpnaccess". A regression in the very
  control this story touches. Trimming now happens only where the request is built.
- **`?page=1e21` blanked the list.** `parsePage` guarded with `Number.isInteger`, the server with
  `Number.isSafeInteger`. Verified against `ticketListQuerySchema` directly: `1e3` accepted, `1e21`,
  `1e100` and `9007199254740993` all rejected `too_big`. Also capped at `MAX_PAGE`, because Prisma's
  `skip` is a 32-bit int and gives way before the schema does.
- **`Showing 981–50 of 50 tickets`** on an out-of-range page, with Next and Last both disabled so the
  only exit was Previous ninety-four times.
- **The guard for this story's own named regression never re-rendered** — `rerender()` with the same
  element object, so React skipped the subtree and the assertion passed on an empty call list.
- **14 approved cases had no assertion anywhere**, and one carried another case's id.
- **`state={{ listSearch }}` had no test** — deleting it left the whole suite green, and it is the
  mechanism behind the story's headline benefit.

Round 3's single blocker was that `checks.green.commit` named a commit at which the suite had 190
tests, paired with a count of 217. It is resolved by the PR-phase step that re-runs the checks and
records them at the commit being shipped, which is the commit this pack sits on. Round 3 said of the
code itself: "the implementation itself I would merge."

Round 4 returned **APPROVE, 0 blockers**, having mutation-tested every fix from all three earlier
rounds and re-measured the test, lint, typecheck and case-reconciliation figures in these records
against its own runs. It also proved a claim of mine wrong: the spec said AC5 could not be honestly
component-tested, and round 4 demonstrated a passing router-POP test in 494ms. All seven AC5
instances are now component-tested as a result, so AC5 no longer depends on the unexecuted E2E specs.

Round 4's remaining decision-needed items are recorded as open items for the human below, not as
defects: the `checks.e2e` schema value, and the unexecuted E2E specs themselves.

**Carried as follow-ups, not fixed here** (each judged out of this story's blast radius, and none
merge-blocking in the reviewer's own assessment):

- `search` has no `.max()` in `ticketListQuerySchema`; pre-existing, now reachable from a URL.
- The search input is not debounced; pre-existing, and the URL now churns with it.
- The E2E webhook seed helper is a fourth copy of a block already in three other specs; lifting it
  into `e2e/fixtures/` would touch those three files.
- `parseTicketListParams` re-implements `ticketListQuerySchema`'s rules rather than deriving from it
  with per-field `.catch()`. That divergence is what produced two of the blockers above, so it is a
  real argument for the refactor — later, deliberately.
- The E2E seed helper races `auto-resolve-ticket`; the 4 scenarios that page behind a status filter
  can time out rather than fail an assertion when that race is lost. Worth knowing before the first real run.

**Human reviewers**: none yet — the PR has not opened.

**QA verification**: **not run.** `/qa-verify` has not been invoked and `state.qa` is absent. At T2
that is not itself a gate failure, but it is an unfillable section, so it is named here rather than
guessed.

**charterFindings**: the approved plan names two exploratory charters —
`CH-be78fe0e3063` (hand-edited and shared URLs) and `CH-5e072067c341` (rapid back/forward with
in-flight requests). Both are gating obligations at T2. Neither has been performed, so both are "not
yet run" and this subsection stays open. No `qa-result perform` attempt exists for either.

## 8. Wikilinks

[[tickets]] · [[tickets-list]] · [[GH-1-spec]] · [[GH-1-recon]] · [[GH-1-plan]] · [[GH-1-cases]]

## 9. Spec sync

`not configured` — `solvo.json → specs.functionalDir` is empty, so there is no as-is functional spec
layer in this repo to sync. No spec gaps to report.

## 10. Merge facts

Merge facts: the sealed attestation for this change (package `aidlc-attestations`, versioned by merge
SHA) and the tracker's final comment.
