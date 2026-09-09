---
type: evidence
github: GH-8
tier: T3
date: 2026-09-09
status: INCOMPLETE
---

# Evidence pack — GH-8

> **`status: INCOMPLETE`.** Section 7 is unfillable: the QA pack has not run, so there is no
> `qa` block in the state file and no exploratory charter findings — and the issue asks for at
> least three charter areas. Everything else here is complete. See section 7 for exactly what is
> missing and what it does and does not mean.

## 1. Work item

**Allow admins to promote and demote users safely**
GitHub issue: https://github.com/JBM95/helpdesk/issues/8 (state at pack-write time: `OPEN`)

Make `User.role` writable through the existing admin-protected Edit User flow, with the server as
the authority, so an admin can move an existing user between `agent` and `admin`. The privilege
*transition* is the deliverable, not the dropdown.

## 2. Tier

**T3**, confirmed by **JB**.

Proposed T3 and confirmed at that value — no escalation occurred. The item maps to two domains
that `solvo.json → tiers.t3Domains` declares T3 outright, [[user-management]] and [[auth]], because
`User.role` sits on the seam they share: user-management mutates the row, auth owns the column and
reads it to make an authorization decision. Blast radius (6 files / 10 callers) stayed well inside
`tiers.blastRadiusEscalation` (15 / 40), so the domain rule is what fixed the tier, not size.

## 3. Gates

| Gate | Decision | Approver | Timestamp |
|------|----------|----------|-----------|
| GATE 1 (plan) | approved | JB | 2026-09-08T18:11:31Z |
| GATE 2 (implementation) | approved — write artifacts and open the PR | JB | 2026-09-09T06:55:00Z |
| GATE 3 (merge) | not yet reached | — | — |

**Four** further scope decisions were taken by JB mid-cycle, all recorded in
`.solvo/state/GH-8.json → scopeDecisions`:

1. Fix the E2E flake this story exposed (test-side only, product code untouched).
2. Accept both T3 risks as recorded — no admin floor under concurrency, no role-change attribution.
3. Leave three house-convention nits that would each need a file outside the blast radius
   (`roleLabel` moving to `core/constants`, the E2E helpers moving to `e2e/fixtures`), carrying them
   as follow-ups rather than widening a T3 diff.
4. Revert the out-of-scope guard added in `87603e7` and carry it as a follow-up.

This section previously said "three" and omitted item 3, which no review round caught.

## 4. Spec

`.solvo/stories/GH-8-spec.md` — see [[GH-8-spec]]. Recon: `.solvo/reconnaissance/GH-8-recon.md` (7/7).

`checks.ambiguityScan` = `cleared`. One AC and two uncovered questions were flagged at the spec
phase and answered by the issue author before build (recorded in the spec's §Resolved ambiguities):
`role` is required on `PUT` (absent → 400); an admin may not change their own role (403); and
demotion also invalidates that user's sessions.

| AC | Claim | Verdict |
|----|-------|---------|
| AC1 | Edit flow exposes the current role and moves a user between `agent` and `admin` | met |
| AC2 | Role mutation accepted only via the admin-protected API; a non-admin cannot change any role, even calling the API directly | met |
| AC3 | Only `agent` and `admin` accepted; missing or unsupported values rejected without changing the stored user | met |
| AC4 | A demoted admin's existing session stops authorizing admin-only `/api/users`, enforced server-side | met |
| AC5 | A promoted agent's subsequent authenticated requests reach the admin-only APIs | met |
| AC6 | `POST /api/users` still creates an `agent`; no role selection at creation | met — unchanged |
| AC7 | A user whose stored role is `admin` stays protected by the `DELETE` rule; not weakened or bypassed | met |
| AC8 | `/api/users` and the Users page show the persisted role without manual correction | met |
| AC9 | Automated tests cover promotion, demotion, direct non-admin attempts, invalid input, post-demotion session behaviour, creation staying `agent`, and delete protection | met |

Per-AC scenario identifiers are in the spec's §AC → scenario index, added because the issue
requires AC evidence to be "mechanically attributable to the ACs; do not rely only on a
suite-level pass".

## 5. Commits

`git log --oneline --reverse main..HEAD` — **24 commits**, oldest first. This section was first
written at commit 17 and is refreshed here, because six further commits landed while rounds 4 and 5
ran; a Commits table that stops mid-branch is what the merge gate reads as the whole branch.

Two commits are still not listed and cannot be: this pack's own refresh commit, and the state-file
commit that follows it as the last commit on the branch. Both postdate this write. Both carry the
trailers. Trailer grammar per `gated-cycle`.

| Commit | Subject | `SOLVO-Run` / `SOLVO-Why` |
|--------|---------|---------------------------|
| `8ad101c` | docs(GH-8): record the core, server and e2e exploration output | both present |
| `65d9ae9` | chore(GH-8): add the recon log, story spec and cycle state | both present |
| `8fff9ac` | feat(GH-8): let an admin change an existing user's role | both present |
| `7cdc366` | test(GH-8): prove the role transitions and their authorization boundary | both present |
| `8a3cd26` | docs(GH-8): refresh the wiki for a writable User.role | both present |
| `9e9a77f` | docs(GH-8): correct the last-admin claim found at self-review | both present |
| `744bd42` | fix(GH-8): make the demotion session drop atomic with the role write | both present |
| `16488e5` | test(GH-8): cover the case-sensitive role reject and the dialog refusal | both present |
| `64e591f` | docs(GH-8): correct the wiki refs, counts and claims this story moved | both present |
| `5a219fa` | fix(GH-8): resolve the fresh-review blockers on coverage and citations | both present |
| `f53c30c` | test(GH-8): make the E2E suite independent of the pg-boss job backlog | both present |
| `adc6833` | docs(GH-8): record the job-queue leak and the untested AI branches | both present |
| `84c0af3` | fix(GH-8): give the settle barrier its own budget and test-controlled state | both present |
| `87603e7` | feat(GH-8): refuse a role change on principals that cannot sign in | both present |
| `ac84f77` | docs(GH-8): add the AC-to-scenario index and fix two more stale refs | both present |
| `71ad3af` | Revert "feat(GH-8): refuse a role change on principals that cannot sign in" | both present |
| `e26550e` | docs(GH-8): carry the reverted guard as TD-22 and close round-3 nits | both present |
| `1992a41` | docs(GH-8): add the evidence pack and the vault memory | both present |
| `399b524` | chore(GH-8): record GATE 2 and the PR-phase check re-run | both present |
| `696d2d8` | fix(GH-8): close the round-4 blockers and the guard-order coverage gap | both present |
| `fd0d8fb` | chore(GH-8): record round 4 and the check re-run at 696d2d8 | both present |
| `bf4ee7b` | docs(GH-8): correct a stale present-tense claim in the spec | both present |
| `81d58d7` | chore(GH-8): record the post-round-4 self audit | both present |
| `c50c4f3` | test(GH-8): pin the narrow side of the demotion session drop | both present |

All 24 are agent-authored and all 24 carry both trailers — verified by iterating `git rev-list`
and grepping each message for both, not by reading the table. No human hotfix commits on this
branch.

`87603e7` and `71ad3af` are a matched add-and-revert pair: product code added beyond the ACs,
then reverted on JB's decision at the round-3 gate. `server/src/routes/users.ts` at HEAD is
byte-identical to `5a219fa`, the pre-guard tip.

## 6. Tests

Final check run, recorded in `.solvo/state/GH-8.json → checks`. The run below is at
**`c50c4f3`**, the commit that added the last scenario — round 5's nit B2, fixed after the pack's
first write. Earlier full runs at `696d2d8` (92/92) and `1992a41` (91/91) preceded it.

An earlier version of this section attributed a 92-test result to `1992a41`. That was wrong:
`users.spec.ts` carried 29 tests at `1992a41` (`git show 1992a41:e2e/tests/users.spec.ts`), so
the suite total there was 91. The 30th arrived in `696d2d8` and the 31st in `c50c4f3`. The
counts below are the current ones, each derived from tooling rather than by hand.

| Suite | Command | Result |
|-------|---------|--------|
| Client (Vitest) | `cd client && bun run test` | **142 passed / 8 files** |
| E2E (Playwright) | `bun run test:e2e` | **93 passed / 5 files** |

**Coverage: `n/a`.** No coverage tooling is configured anywhere in this repo — verified at install
and recorded in `solvo.json → quality.coverageWaiver`, with `coverageArtifact` set to an `n/a`
marker. No measured line or branch percentage exists, so the 80/75 values in `quality` are the
shipped fallback rather than a repo threshold. `solvo.json` is untouched by this branch, so no
quality key moved in either direction.

**E2E obligation: covered.** 93 scenarios run, 93 passed. 24 are new to this story — the
`Role management` describe in `e2e/tests/users.spec.ts` (7 scenarios in that file on `main`, 31 at
HEAD) — plus 2 pre-existing `ticket-detail` scenarios modified to use the new settle barrier.
69 baseline + 24 = 93, which reconciles with the run.

Every server-side claim is proven through Playwright, using the `request` fixture. That is a
recorded decision, not a gap: no server test suite exists in this repo and
`solvo.json → quality.tests.backend` is `"n/a: no server test suite exists in this repo"`. These
are the repo's **first API-level authorization assertions** — `docs/repo-wiki/11-testing.md`
previously recorded that every authorization assertion was a UI observation.

**Stability**, because this story exposed a pre-existing flake and had to prove the fix:
full suite 93 passed; the previously-red pair (`ticket-detail.spec.ts` +
`webhook-inbound-email.spec.ts`) 26 passed ×2; `users.spec.ts` alone 31 passed.

One residual observation, recorded rather than smoothed over: round 5's reviewer saw **2
failures in its first 11 runs of `users.spec.ts`, then 9 consecutive clean runs**, and could not
attribute them — the log was overwritten, and the immediately preceding batch was a mutated tree.
Neither reproduced in the 12 runs after. The two named tests in that window (`:25` columns, `:461`
promote-via-dialog) both fail the way a transient `GET /api/users` failure would, since
`UsersTable` swaps the table for `ErrorAlert` on query error. So the queue fix is not being
claimed as proof the suite is flake-free — only that the pg-boss backlog, which was reproducible
and measured, is gone.

**Typecheck:** client `tsc -b` reports 3 errors and server 1, all pre-existing and identical on
`main` (`ReplyForm.test.tsx:19`, `TicketSummary.test.tsx:19`, `vite.config.ts:41`,
`prisma/seed-replies.ts:377`). None is in a file this branch touches.

**Performance:** `n/a: no performance measurement was taken`. The story adds one indexed
primary-key read to the `PUT` handler and batches two existing writes into one transaction; no
endpoint's complexity class changes and `solvo.json → quality.p95Ms` has no measuring harness
behind it in this repo.

## 7. Reviews — **INCOMPLETE**

### Self-review

Ran against `review-checklists`. Found and fixed three things before any independent review:

- The role write and the demotion session drop were two sequential `await`s. A failure between
  them leaves a demoted user holding live session rows — the one divergence in this handler with an
  authorization consequence. Batched into one `$transaction` (`744bd42`).
- Two untested user-reachable paths: `z.enum` is case-sensitive so `role: "Admin"` is a 400, and
  the self-role-change refusal was only asserted through the API even though the role control
  renders on the caller's own row (`16488e5`).
- The spec overstated the self-change guard as an absolute floor against zero admins. Corrected to
  say it closes every *sequential* path but is not a floor under concurrency (`9e9a77f`).

### Fresh review — `fresh-reviewer`, 5 rounds, ending in APPROVE

| Round | Verdict | Blockers | Resolution |
|-------|---------|----------|------------|
| 1 | REQUEST_CHANGES | 3 | B2 (wiki citation drift) and B3 (no UI demotion scenario for AC1/AC8) fixed in `5a219fa`. B1 (state file carried no checks evidence) dismissed in round 2 as `gated-cycle` PR-phase sequencing — the state file commits alone and last — not a diff defect. |
| 2 | REQUEST_CHANGES | 1 | The settle barrier's 30s poll equalled Playwright's default 30s per-test budget, so the wait could consume the whole test. Reproduced 4/4. Fixed in `84c0af3`: own 90s budget, and it waits for any terminal status then PATCHes, removing the coupling to the AI call failing. |
| 3 | REQUEST_CHANGES | 2 | Both were fallout from the out-of-scope guard in `87603e7`: 12 inserted lines shifted 32 `file:line` citations across 11 documents (re-breaking round 1's B2) and made four wiki claims wrong, one the opposite of the code. Resolved by reverting that hunk (`71ad3af`) — `users.ts` returned byte-identical to the pre-guard tip, so all 32 citations are correct again with no document edited. Eight flagged anchors re-verified individually. |
| 4 | REQUEST_CHANGES | 3 | First review of the post-revert tree, at `399b524`. All three blockers were documentation fidelity, none in product code: ten wiki claims this branch's own code had falsified across five documents; ten stale bare `:NN` citations in two feature cards, which carried no filename and so survived every earlier sweep; and test counts in two documents contradicting the state file. Fixed in `696d2d8`, with counts thereafter derived from tooling. Its N1 was the substantive one — three documents asserted the self-role 403 is ordered before the email 409, and swapping them passed all 29 tests. A scenario tripping both guards at once was added and confirmed to be the only test that fails under that exact swap. |
| 5 | **APPROVE** | 0 | Second independent review of the post-revert tree, at `81d58d7`. Verified all four claims of the post-round-4 self audit, re-running the citation sweep with a wider net (129 filename-qualified citations across 63 documents, zero out of range) and re-deriving every count from tooling. Re-ran the round-4 guard-order mutation itself and reproduced the single expected failure. Added its own adversarial probes against a live server — role type confusion, mass assignment, prototype pollution, 10 parallel alternating role writes — all refused or ignored correctly. Raised no blockers; its one decision item and two nits are recorded below. |

Rounds 3, 4 and 5 each found the **product code itself clean**, and all three used mutation
testing rather than inspection: deleting the role guard, forcing `demoted = false`, disabling the
self-role-change check, swapping the 403 and 409 guards, and broadening `demoted` — each produced
a failing test, except the last, which is what nit B2 below is about. No vacuous assertions.

**Cap note.** `gated-cycle` sets a 3-round cap, and rounds 4 and 5 ran beyond it. The reason is
recorded in the state file's `review.capExceeded` and is not a silent overrun: the `gate-guard`
hook refuses a PR while the recorded verdict is `REQUEST_CHANGES`, and the only alternatives were
to record a human-resolved APPROVE that JB had not given — he approved *proceeding to a PR* at
GATE 2, having not reviewed the diff — or to fabricate one. Both were refused and the overrun was
reported to JB, who chose to run round 5. It ended in a genuine APPROVE.

At GATE 2 this section read *"the 3-round cap is exhausted, and no reviewer has seen the
post-revert tree"*, and JB approved on that explicit basis. That statement was true when made and
is now false — rounds 4 and 5 both reviewed the post-revert tree independently. It is corrected
here rather than left standing, and the GATE 2 record in section 3 keeps what he was actually
shown at the time.

### Round 5's own findings — carried, not silently closed

- **Decision item (🟠).** This section itself was the finding: it still claimed the cap was
  exhausted with the post-revert tree unreviewed, after round 4 had reviewed it. Corrected above.
- **Nit B1 (🟡).** Section 6 attributed a 92-test result to `1992a41`, where the suite was 91.
  Corrected in section 6, with the wrong attribution named rather than quietly overwritten.
- **Nit B2 (🟡).** `demoted` narrows to `admin → agent`, but no scenario pinned the *narrow* side:
  broadening it to `role === Role.agent` passed all 30 tests, while in production it would sign an
  agent out of every device whenever an admin edited their name. Fixed rather than deferred — one
  scenario added at `users.spec.ts:801` in `c50c4f3`, asserting 403 (session alive, not admin)
  rather than 401 (session destroyed) on a live session after a non-demoting save. Verified by
  re-applying the broadening mutation: exactly that one test fails,
  `Expected: 403 / Received: 401`.
- **Suggestions (💡), all recorded and none actioned.** Swapping `validate` with the target load is
  undetected by any test, and harmless today — both orders refuse with a 4xx and write nothing on
  an admin-only route. A full-`PUT` contract has no `updatedAt` precondition, so a stale role can
  be written back from a dialog left open across another admin's change; pre-existing for
  `name`/`email`, new only in that the field now carries privilege. A non-JSON body returns
  Express's default HTML error page with a stack trace outside `NODE_ENV=production` — pre-existing
  and unrelated to role, surfaced by the T3 security pass.

### Human reviewers

None yet — the PR opens with this pack. T3 mandates human deep review at the merge gate, and that
review is still required: five AI rounds are not a substitute for it. What the merge gate no longer
has to cover is the post-revert tree's *first* independent look, which rounds 4 and 5 have now
done.

### QA verification — **MISSING, and this is what makes the pack INCOMPLETE**

No `qa` block exists in `.solvo/state/GH-8.json`. The QA pack (`/qa-plan` → `/qa-cases` →
`/qa-verify`) has not run for this story.

`solvo.json → quality.qa` sets `requiredFromTier: "T2"` with `mode: "warn"`, so this warns rather
than blocks. But the issue asks for QA work explicitly, and none of it is recorded:

- **`charterFindings`: unfilled.** The issue asks for "at least three distinct exploratory charter
  areas, for example: authorization/session transitions, user-management regression, and
  privilege-boundary abuse cases." No charter was planned, run, waived or deferred, so this
  subsection is open rather than answerable — which is a different fact from a story that ran
  charters and found nothing.
- **No canonical `QaRun`.** There is no `.solvo/evidence/qa/GH-8-run-<commit>.json`, so there is no
  candidate-bound execution record and no `runId`/`testedCommit`/`recordPath` to cite.
- **No authority decision recorded for the omission.** The issue asks that "if a manual QA
  obligation is waived or deferred during the Solvo validation, record a real authority decision so
  the provenance/readiness path is exercised." That decision has not been taken, so it is not
  recorded here either.

What this section does **not** claim: the dev-side test evidence in section 6 is real and green,
and it is mechanically attributable per AC. What is absent is independent QA verification and the
exploratory charters — neither of which the dev cycle can substitute for, and neither of which any
green suite implies.

## 8. Wikilinks

[[GH-8-spec]] · [[GH-8-recon]] · [[user-management]] · [[auth]] · [[edit-user]] · [[create-user]] ·
[[delete-user]] · [[view-users-list]] · [[05-api-surface]] · [[07-data-model]] · [[11-testing]] ·
[[13-cross-cutting]] · [[tech-debt]] · [[legacy-map]] · [[12-build-deploy]]

## 9. Spec sync

**Not configured.** `solvo.json → specs.functionalDir` is empty (`""`), as are `badocsDir` and
`companionDirs`, so there is no functional-spec layer in this repo to sync and no version to bump.
No spec gaps to report.

Note `specLayer.provider` is `bmad`, whose spec mechanics are its own rather than shipped in the
toolkit, and the resolved-providers context named no spec-layer conventions skill for this session.
The story was authored from the tracker issue plus `docs/repo-wiki`, and `specSource` is absent
from the state file because this cycle started from a tracker key rather than a spec reference.

## 10. Merge facts

Merge facts: the sealed attestation for this change (package `aidlc-attestations`, versioned by
merge SHA) and the tracker's final comment.
