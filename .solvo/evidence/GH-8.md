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

Three further scope decisions were taken by JB mid-cycle and are recorded in
`.solvo/state/GH-8.json → scopeDecisions`:

1. Fix the E2E flake this story exposed (test-side only, product code untouched).
2. Accept both T3 risks as recorded — no admin floor under concurrency, no role-change attribution.
3. Revert the out-of-scope guard added in `87603e7` and carry it as a follow-up.

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

`git log --oneline main..HEAD` (17 commits, oldest first). Trailer grammar per `gated-cycle`.

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

All 17 are agent-authored and all 17 carry both trailers. No human hotfix commits on this branch.

`87603e7` and `71ad3af` are a matched add-and-revert pair: product code added beyond the ACs,
then reverted on JB's decision at the round-3 gate. `server/src/routes/users.ts` at HEAD is
byte-identical to `5a219fa`, the pre-guard tip.

## 6. Tests

Final check run, recorded in `.solvo/state/GH-8.json → checks` at commit
`e26550e2e3a7dab0f0d4f80370ac24a9a172eb7f`.

| Suite | Command | Result |
|-------|---------|--------|
| Client (Vitest) | `cd client && bun run test` | **142 passed / 8 files** |
| E2E (Playwright) | `bun run test:e2e` | **91 passed / 5 files** |

**Coverage: `n/a`.** No coverage tooling is configured anywhere in this repo — verified at install
and recorded in `solvo.json → quality.coverageWaiver`, with `coverageArtifact` set to an `n/a`
marker. No measured line or branch percentage exists, so the 80/75 values in `quality` are the
shipped fallback rather than a repo threshold. `solvo.json` is untouched by this branch, so no
quality key moved in either direction.

**E2E obligation: covered.** 91 scenarios run, 91 passed. 22 are new to this story — the
`Role management` describe in `e2e/tests/users.spec.ts` (7 scenarios in that file on `main`, 29 at
HEAD) — plus 2 pre-existing `ticket-detail` scenarios modified to use the new settle barrier.
69 baseline + 22 = 91, which reconciles with the run.

Every server-side claim is proven through Playwright, using the `request` fixture. That is a
recorded decision, not a gap: no server test suite exists in this repo and
`solvo.json → quality.tests.backend` is `"n/a: no server test suite exists in this repo"`. These
are the repo's **first API-level authorization assertions** — `docs/repo-wiki/11-testing.md`
previously recorded that every authorization assertion was a UI observation.

**Stability**, because this story exposed a pre-existing flake and had to prove the fix:
full suite 91 passed ×3; the previously-red pair (`ticket-detail.spec.ts` +
`webhook-inbound-email.spec.ts`) 26 passed ×2; `users.spec.ts` alone 29 passed.

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

### Fresh review — `fresh-reviewer`, 3 rounds, cap reached

| Round | Verdict | Blockers | Resolution |
|-------|---------|----------|------------|
| 1 | REQUEST_CHANGES | 3 | B2 (wiki citation drift) and B3 (no UI demotion scenario for AC1/AC8) fixed in `5a219fa`. B1 (state file carried no checks evidence) dismissed in round 2 as `gated-cycle` PR-phase sequencing — the state file commits alone and last — not a diff defect. |
| 2 | REQUEST_CHANGES | 1 | The settle barrier's 30s poll equalled Playwright's default 30s per-test budget, so the wait could consume the whole test. Reproduced 4/4. Fixed in `84c0af3`: own 90s budget, and it waits for any terminal status then PATCHes, removing the coupling to the AI call failing. |
| 3 | REQUEST_CHANGES | 2 | Both were fallout from the out-of-scope guard in `87603e7`: 12 inserted lines shifted 32 `file:line` citations across 11 documents (re-breaking round 1's B2) and made four wiki claims wrong, one the opposite of the code. Resolved by reverting that hunk (`71ad3af`) — `users.ts` returned byte-identical to the pre-guard tip, so all 32 citations are correct again with no document edited. Eight flagged anchors re-verified individually. |

Round 3 found the **product code itself clean**, via four mutation tests — deleting the role
guard, forcing `demoted = false`, disabling the self-role-change check — each of which produced a
failing test. No vacuous assertions.

**The 3-round cap is exhausted, and no reviewer has seen the post-revert tree.** The revert is
mechanically verifiable (byte-identical to a state round 2 machine-checked) and the suites are
green, but that is not an independent pass. Presented as such at GATE 2 and approved on that basis.

### Human reviewers

None yet — the PR opens with this pack. T3 mandates human deep review at the merge gate, which is
also where the unreviewed post-revert state gets its independent check.

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
