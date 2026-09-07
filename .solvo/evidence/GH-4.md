---
type: evidence
github: GH-4
tier: T2
date: 2026-09-07
status: complete
---

# Evidence pack — GH-4

## 1. Work item

**Add a Clear filters action to the Tickets page** — https://github.com/JBM95/helpdesk/issues/4

One action that resets the ticket list's search, status and category filters together, so an
agent who has narrowed the queue can get back to the full list in a single interaction.

## 2. Tier

**T2**, confirmed by JB Mccallaghan on 2026-09-07. No escalation.

Proposed T2 and confirmed unchanged: the story maps to [[tickets]], which is not in
`solvo.json → tiers.t3Domains` (`auth`, `user-management`); it touches no PII, payment or
auth path; and the recorded blast radius of 2 files / 0 callers is far below
`tiers.blastRadiusEscalation` (15 files / 40 callers). Not T1 either — it coordinates state
across three controls plus the query and pagination.

## 3. Gates

| Gate | Decision | Approver | Timestamp |
|---|---|---|---|
| GATE 1 (plan) | approved | JB Mccallaghan | 2026-09-07T14:40:00Z |
| GATE 2 (implementation) | not applicable at T2 | — | — |
| Merge gate | pending — a human merges | — | — |

## 4. Spec

[[GH-4-spec]] · recon [[GH-4-recon]] · QA plan [[GH-4-plan]] · cases [[GH-4-cases]]

| AC | Statement | Cases |
|---|---|---|
| AC1 | Clear filters is visible when at least one of `search`, `status`, `category` is active | `97bd394b8d4b`, `f1048c79850a`, `3b0e40c8bf4e`, `20df8cc073c5`, `538c67330f0d` |
| AC2 | Not shown when all three are at their default values | `c26b837c3ed5`, `b1ca237fc00c`, `d13a64090439`, `dc3567d08fee` |
| AC3 | Activating it resets all three together and the controls show their default state | `151947322ff2`, `54299e624f39` |
| AC4 | The list is then queried without those filter params, and shows the unfiltered set | `39d9087d45f6`, `379746876d93`, `3af1d27a0741`, `f1ab5d0941fc`, `739c6fe5dd97` |
| AC5 | Clearing preserves the current sort column and direction | `4c12ec6a7a66`, `a0b14a332363` |
| AC6 | From a page other than 1, clearing returns to page 1 once state settles | `0f03d7775fad`, `b809d54aaa12` |
| AC7 | Automated regression coverage of AC1–AC6 | discharged by the 20 cases above being AC-associated and green |

The AC ambiguity scan cleared: each AC has exactly one honest reading. Two were pinned rather
than assumed — AC1's "active" means *not at its default* (no dirty-tracking exists to support
"has been interacted with"), and AC6's "after state settles" permits an intermediate fetch at
the pre-clear page, because `filters` changes during render while `pageIndex` resets in an
effect after paint.

## 5. Commits

`git log --oneline main..HEAD` at pack-write time:

```
4e7fd7d fix(GH-4): reconcile the spec with the delivered cases and commit the QA artifacts
c83c24e feat(GH-4): add a Clear filters action to the tickets list
```

| Commit | `SOLVO-Run` | `SOLVO-Why` |
|---|---|---|
| `c83c24e` | present | present |
| `4e7fd7d` | present | present |

Run id `b141288b-0c80-435f-a94b-7e7369a8c5b4`. Two further commits follow this pack by the
PR-phase order in `gated-cycle`: this pack plus the vault memory, then the state file alone
carrying the re-run checks.

Only one production file changed: `client/src/pages/TicketsFilters.tsx` (+17 / −1).
`TicketsTable.tsx` and `TicketsPage.tsx` are untouched — AC5 and AC6 already hold because sort
and pagination live in `TicketsTable` (`:99-105`), separate from the filter state in
`TicketsPage` (`:14`), and the `filters`-keyed effect at `TicketsTable.tsx:107-109` already
resets `pageIndex` on any filter identity change.

## 6. Tests

| | |
|---|---|
| Command | `cd client && bun run test` |
| Result | **134 passed / 134**, 8 files. Baseline before this story was 114 |
| Repeats | 3 consecutive green runs, to rule out flakiness |
| Coverage | **not measured.** No coverage reporter is configured anywhere in the repo; `quality.coverageArtifact` is an `n/a:` marker and `quality.coverageWaiver` records the reason. No line or branch figure exists to report against the 80 / 75 thresholds |
| E2E obligation | `n/a` — no new scenario. See below |
| E2E regression | `e2e/tests/tickets.spec.ts` — **5 passed / 5**, captured in `GH-4-e2e-tickets.log` |
| Typecheck | `bunx tsc -b` — 3 errors, all pre-existing in files this story does not touch (`ReplyForm.test.tsx:19`, `TicketSummary.test.tsx:19`, `vite.config.ts:41`); 0 in the changed files |
| Lint | `bunx eslint` — 5 errors / 2 warnings, all pre-existing in untouched files; clean on both changed files. `solvo.json → quality.lint` is `[]` |

**The E2E obligation is recorded as `n/a` with the tension stated, not skipped.** The
`review-checklists` three-part test does hold here: there is a screen the agent interacts with,
it calls `GET /api/tickets`, and the result is observable as a changed row set. The `n/a` rests
on two project-specific records that both point the other way — `CLAUDE.md § Testing` names
"rendering, display logic, component states, API call verification" as invalid E2E scenarios and
component-test territory, and the human-approved [[GH-4-plan]] (§ Regression scope) rules out a
new E2E test for this story on the same grounds. The existing regression spec was run instead.
Flagged for the merge gate rather than resolved here.

**Every one of the 20 cases is proven able to fail.** Five mutations, each applied to a scratch
copy and reverted:

| Mutation | Cases killed |
|---|---|
| Detection by `Object.keys(filters).length` instead of per field | 2 (both AC2 interaction cases) |
| Clear writes `search: ""` instead of `undefined` — the plan's Trap 1 | 7, across AC2, AC4, AC5, AC6 |
| `TicketsTable` remounted via a `filters`-derived `key` — Trap 3 | 2 (both AC5 cases) |
| Button never rendered | 19 — all but the absent-on-mount case, which correctly survives |
| Button always rendered | 5, including the absent-on-mount case |

The last two are complementary: their union is all 20. The independent reviewer re-derived every
row of this table and each reconciled exactly, including which specific cases died.

## 7. Reviews

**Self-review** — ran the `review-checklists` passes. No blockers. Confirmed no broad
`getAllByRole("button")` or button-count assertion anywhere that a new button could break; the
only `toHaveLength` assertions count table `row`s, and the button renders outside the table. No
"Clear" text assertion exists elsewhere in `client/src` or `e2e`. Security checklist is
inapplicable throughout and nothing was skipped silently: no new endpoint, DTO, SQL, secret, PII
field or role gate — a conditional render on an already-authenticated query.

**Fresh review** — `fresh-reviewer`, independent context, two rounds.

- Round 1: **REQUEST_CHANGES**, 2 blockers. Both were evidence defects, not code defects. (1) the
  spec's AC→test map still described a nine-test direct-props harness written before the approved
  case set was found, naming tests that do not exist and predicting 123 green against an actual
  134; (2) the QA plan, case set and evidence scope were untracked, even though `.gitignore:11-18`
  un-ignores exactly those paths and states that cycle artifacts are committed.
- Both fixed in `4e7fd7d`, which touched no production code.
- Round 2: **APPROVE**, 0 blockers. The reviewer verified both fixes and independently re-derived
  the mutation matrix rather than accepting it.

Two review findings changed the tests rather than being argued away:

- `CASE-739c6fe5dd97`'s closing claim could not fail — it asserted after a `waitFor` on a
  condition that was already true, so the stale filtered response was never actually observed. It
  now flushes a macrotask inside `act()` and asserts the row set directly; verified live by
  routing the post-clear query to a single-row payload, which turns it red. The reviewer's own
  follow-up probe established that this particular property is guaranteed by react-query key
  isolation rather than by code this story wrote, so no mutation of this delta can make that
  claim red — the value of the change is that the test no longer pretends otherwise.
- The blanket `as never` on the axios `mockImplementation` became a narrow cast on the params
  object, and a stale `TicketsFilters.tsx:31` line reference the diff itself had shifted to `:39`
  was removed.

Three items are carried to the merge gate as judgement calls rather than silently accepted — the
E2E obligation tension above, the transient pre-clear-page request at
`TicketsTable.tsx:107-109` (pre-existing on every filter change, permitted by AC6's second
sentence, and framed by [[GH-4-plan]] as a design question for the dev cycle), and the state file
landing as the final commit per the `gated-cycle` PR order.

**QA verification** — not run. `/qa-verify` has not executed for this story, so there is no `qa`
block in the state file and no canonical `QaRun` at `.solvo/evidence/qa/GH-4-run-<commit>.json`;
all 20 rows in [[GH-4-cases]] still read `pending`, which is that artifact's documented resting
state. `solvo.json → quality.qa.mode` is `warn` and `requiredFromTier` is `T2`, so this warns
rather than blocks. At T2 its absence does not make this pack INCOMPLETE. The test execution
recorded in section 6 is the implementer's own, not an independent verification.

**Human reviewers** — none yet; the PR is not open at pack-write time.

**charterFindings** — subsection omitted deliberately. [[GH-4-plan]] recorded no exploratory
charter, and the one candidate it raised (a throttled-network flicker on the clear transition)
was declined at its human gate, because the call-order half is already proven deterministically
by `CASE-0f03d7775fad` and only the by-eye judgement was optional. So no charter was ever run and
there is no null result to report.

## 8. Wikilinks

[[tickets]] · [[view-tickets-list]] · [[GH-4-spec]] · [[GH-4-recon]] · [[GH-4-plan]] ·
[[GH-4-cases]] · [[11-testing]] · [[08-standards/observed|observed standards]]

## 9. Spec sync

`not configured` — `solvo.json → specs.functionalDir` is empty, so there is no as-is functional
spec for this story to sync. No spec gaps reported.

One documentation gap worth naming, because two wiki docs assert it and this story closes it:
[[11-testing]] (§ *Not covered here*) and [[view-tickets-list]] (§ Tests) both record that sort
preservation across a filter change is asserted nowhere in the repo. `CASE-4c12ec6a7a66` and
`CASE-a0b14a332363` now assert it. Those two docs are stale in that respect as of this branch and
are left for `/dev-finish` or a `/setup-05-explore` refresh rather than edited here.

## 10. Merge facts

Merge facts: the sealed attestation for this change (package `aidlc-attestations`, versioned by
merge SHA) and the tracker's final comment.
