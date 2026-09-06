---
type: recon
github: GH-3
tier: T2
tags: [tickets]
date: 2026-09-06
---

Bug: [[GH-3]] · Filed from finding on [[GH-1-spec]] · Domain: [[tickets]] · Feature: [[tickets-list]]

# Reconnaissance: GH-3 — Filter + pagination race loses filter from URL

**Work item:** GH-3 (bug, S3, T2)
**Filed from:** QA finding FIND-86cc706fc23c on work item GH-1
**Defect exists on:** gh/1-preserve-ticket-list-view-state branch only
**Confirmed absent on:** test/solvo branch (uses local state, no searchParams)

## Defect location

client/src/pages/TicketsPage.tsx:18,25-27 — the write() function merges into params, a snapshot of searchParams parsed once per render, then calls setSearchParams with a value (not the functional-updater form). Two writes issued from one committed render both start from the same snapshot, so the second discards the first.

### Mechanism

Per GH-3 description, confirmed by E2E test failures in run 9db55dd8152718a92b839d5a6dfcf05bd992a4a2:
- React Router 7.13.0: globalHistory.pushState is synchronous
- setSearchParams defers its state update in startTransition
- The second write sees the same stale params the first did
- Observable: Status → Next quickly → URL is ?page=2, status=open absent

The functional-updater form of setSearchParams was tested (per GH-3 description) and does NOT fix this because it passes the same closed-over snapshot as prev. The fix needs to parse prev live.
## Blast radius

### Files to modify

| File | Change | Lines |
|------|--------|-------|
| client/src/pages/TicketsPage.tsx | Replace value-form setSearchParams with functional-updater form that parses prev live | 25-27 |

Count: 1 file

### All callers of the write path

| Caller | Call site | Route | Defect shape |
|--------|-----------|-------|--------------|
| TicketsFilters.tsx:31 | Search input onChange | handleFiltersChange | search + page |
| TicketsFilters.tsx:38 | Status select onValueChange | handleFiltersChange | status + page |
| TicketsFilters.tsx:57 | Category select onValueChange | handleFiltersChange | category + page |
| TicketsTable.tsx:197 | TanStack onPaginationChange | handlePageChange | any filter + page |
| TicketsTable.tsx:183 | TanStack onSortingChange | handleSortChange | sort + page, or sort + filter |
| TicketsPage.tsx:29 | handleFiltersChange direct | write() | filter A + filter B |
| TicketsPage.tsx:54 | handleSortChange direct | write() | sort A + sort B |
| TicketsPage.tsx:61 | handlePageChange direct | write() | page A + page B |

Count: 8 prop-to-handler paths, all reaching one shared write() function.

Every pair of writes is affected: filter+page (the reported case), sort+page, filter+filter (tested and passes only because the test holds the response), filter+sort, etc.

## Tests affected

### Component tests (client/src/pages/TicketsPage.test.tsx)

CASE-b545d0a5c4bf (line 619) "should keep both filters when a second is chosen before the first settles" — Asserts both filters survive. PASSES today because it holds the response, so both writes settle before render. Would FAIL without the hold.

CASE-93514dfd0070 (line 1088) "should advance exactly one page on a double-click of Next" — Asserts ?page=2 after dblClick. NOT pinning the defect. This is about double-click advancing one page, not about filter+page race.

No test directly covers the filter→pagination race reported in GH-3. CASE-b545d0a5c4bf tests filter+filter but artificially holds the response, so it does not expose the timing window the defect lives in.

### E2E tests

Two E2E specs in run 9db55dd8152718a92b839d5a6dfcf05bd992a4a2 failed with exactly this defect:
- Line 137: expected /page=2/, received ?status=open&sortBy=subject&sortOrder=desc (page lost)
- Line 216: expected /status=open/, received ?page=2 (status lost)

These are false negatives — the tests assert the correct behavior; the code is broken. Fixing the code will make them pass.

## Established patterns

From docs/repo-wiki/_memories/GH-1.md (completed work):
- GH-1 moved ticket list state into URL in commit 1818a14
- client/src/lib/ticket-list-params.ts owns parsing/serializing
- parseTicketListParams(URLSearchParams) validates and defaults every param
- serializeTicketListParams(TicketListParams) omits defaults
- Trimming controlled input values on read was a trap (documented)
- Effect-based resets on derived objects was a trap (documented)
- This defect is NOT in the GH-1 memory — it is a new class

Memory explicitly says: "Traps in this area, for whoever comes next" — this fix should add a new trap entry.

## Prior review rounds

Git log shows three review-fix rounds on GH-1:
- effa8ae — round-3 review findings
- ec4ef62 — round-2 review blockers
- ccc0d34 — fresh-review blockers

None caught this race condition.

## Recon confidence: 6/7

| Dimension | Known? | Evidence |
|-----------|--------|----------|
| 1. Files to change | ✓ | TicketsPage.tsx only |
| 2. Callers | ✓ | All 8 prop paths mapped |
| 3. Tests | ✓ | CASE-b545d0a5c4bf, CASE-93514dfd0070, two E2E failures |
| 4. Patterns | ✓ | GH-1 memory read, parse/serialize helpers established |
| 5. Feature flags | ✓ | None in this codebase |
| 6. Database/external state | ✓ | Client-only — no server, core, or schema changes |
| 7. Vault memories | ✗ | GAP — no exploration-state.json, no domain/feature maps |

### Gap detail

docs/repo-wiki/_state/exploration-state.json is absent. The repo is greenfield — no 03-domains/, no 04-features/, no 05-api-surface.md, no 06-frontend-map.md, no 09-legacy/. The map was never built.

This does NOT block the fix — the defect is localized, the blast radius is clear from code, and GH-1 memory provides the context. But the missing exploration state is why dimension 7 reads no.

## Server / core / prisma implication

None. This is pure client state coordination. The race is between two setSearchParams calls in TicketsPage.tsx. No API contract changes, no schema changes, no shared types beyond what ticket-list-params.ts already exports.

## Fix direction (from GH-3 description)

The issue says the functional-updater form of setSearchParams does NOT fix this because it passes the same closed-over snapshot as prev. The fix needs to parse prev live inside the updater.

## needsExplore assessment

None required for this fix. The repo is greenfield and has no sub-system maps, but this defect is:
- Localized to one component file
- Triggered by one function (write())
- Fully traced through 8 call paths
- Covered by existing test patterns (needs one new test case)
- Understood from prior work (GH-1 memory)

A full /setup-05-explore of tickets-list would not surface anything recon missed here — the code is three weeks old, the memory is fresh, and the race condition is a known React state-update class.

If exploration-state.json existed, tickets-list would read new (un-explored) because the map was never built. But per greenfield exception in recon-method, do not populate needsExplore when the repo is near-empty and has no state file.

Final: needsExplore is an empty array.

## Regression baseline

GH-1 test suite has 82 E2E specs and 469 component test assertions (counted from TicketsPage.test.tsx alone). The defect exists only on gh/1-preserve-ticket-list-view-state branch, not on test/solvo, so the regression scope is branch-local.

Two E2E tests failed in run 9db55dd8152718a92b839d5a6dfcf05bd992a4a2 showing this exact symptom. Fixing the race will make them pass.

CASE-b545d0a5c4bf currently passes because it holds the response; that hold is masking the race. The fix will keep it passing while also fixing the unmasked cases.

## Recommendation

1. Change write() in TicketsPage.tsx:25-27 to use functional-updater form with live parsing
2. Add one component test for filter→page race (unmasked, no held response)
3. Verify CASE-b545d0a5c4bf still passes
4. Verify the two failed E2E specs pass
5. Update docs/repo-wiki/_memories/GH-1.md with this trap
