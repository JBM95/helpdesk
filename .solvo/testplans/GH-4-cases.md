---
type: testplan
github: GH-4
tier: T2
tags: [tickets]
date: 2026-09-07
---

# GH-4 Test Cases — Add a Clear filters action to the Tickets page

Plan: [[GH-4-plan]] · Story: [[GH-4-spec]] · Domain: [[tickets]] · Feature: [[view-tickets-list]] · Suites: [[11-testing]]

Generated from plan revision 1 (`27e59f98…`, approved 2026-09-07 by JB Mccallaghan), then curated at
the human gate. Every case is component-level Vitest + RTL in
`client/src/pages/TicketsPage.test.tsx`, per the plan's AC → test-type map. No E2E case — the plan
rules it out and `CLAUDE.md § Testing` agrees.

**Curated set: 20 cases** (42 generated, 22 pruned). The pruning rationale is recorded below so a
later reader can tell a considered exclusion from an oversight.

> **Result column is not the record of results.** No command projects execution outcomes back into
> this file. Execution truth lives in the canonical `QaRun` written by `/qa-execute` at
> `.solvo/evidence/qa/GH-4-run-<commit>.json`. Every row below stays `pending` for the life of the
> artifact.

## How the tier decided which classes to generate

T2, so the class rule is predicate-based: a class is generated when the AC text and the blast radius
meet its predicate, and declined only when they do not. The plan found **all six predicates met**, so
generation declined nothing. A T2 record carries no class dispositions — that silence is the tier's
own rule.

That rule is also what makes the `authz` prune below legal: at T2 a class with no surviving case
records nothing. At T3 the same prune would require a recorded `not-applicable` with a named human
and a reason.

**AC7 has no cases, deliberately.** AC7 asks for automated regression coverage of AC1–AC6 and names
no behaviour of its own to prove. It is discharged by this set existing, being AC-associated, and
running green — coverage-by-the-set. `/qa-verify` should not hunt for a behaviour behind it or read it
as an unmet obligation. AC7's own four named scenarios map onto surviving cases: one active filter
(`CASE-97bd394b8d4b`), multiple active filters (`CASE-20df8cc073c5`), preserved sorting
(`CASE-4c12ec6a7a66`), pagination reset (`CASE-0f03d7775fad`).

**No exploratory charters.** The plan recorded none, and the candidate it raised for the gate — the
throttled-network flicker on the clear transition — was **declined at the gate**. The call-order half
is already proven deterministically by `CASE-0f03d7775fad`; only the by-eye judgement was optional,
and at T2 a charter would create a `manual`/`exploratory` obligation that gates readiness until a
named human closes it. So `/qa-execute` creates no manual obligation for GH-4.

## The three assertion rules this set is built on

Carried forward from the plan, because a case written the wrong way here passes straight through a
real defect:

1. **AC4 asserts the full params object by equality.** `TicketsTable.tsx:122-128` spreads `...filters`
   into the axios params, so an `undefined` field is omitted from the request entirely. A Clear
   handler that writes `search: ""` puts `?search=` on the wire, which AC4 forbids — and
   `expect.objectContaining({ page: 1 })` sails straight past it.
2. **AC6 asserts the *last* call.** The `pageIndex` reset lives in the `filters`-keyed effect at
   `TicketsTable.tsx:107-109`, so clearing from page 3 can legitimately fire one page-3 unfiltered
   request before settling. AC6's second sentence was written to allow that. Never assert
   `not.toHaveBeenCalledWith({ page: 3 })` — that case fails against correct behaviour.
3. **AC5 asserts the rendered sort indicator as well as the request.** Sort preservation is proven by
   nothing in the repo today. The request assertion alone misses an implementation that remounts
   `TicketsTable` and re-issues the default sort.

## Cases

### AC1 — Visible when needed (5 cases)

The three single-filter cases are not one instance written three times: a visibility predicate
written as `search || status` passes the search case and fails the category case. Each proves a
different disjunct of "at least one of".

| Case ID | Class | Behaviour instance | Title | Steps | Expected | Result |
|---|---|---|---|---|---|---|
| CASE-97bd394b8d4b | boundary | search filter active alone | Clear filters is visible when only a search term is active | Mock `axios.get` with `mockResponse()`; render `<TicketsPage />` via `renderWithQuery`, wait for rows; type `"login"` into the search input | The Clear filters control is present in the document | pending |
| CASE-f1048c79850a | boundary | status filter active alone | Clear filters is visible when only a status filter is active | Install the jsdom `PointerEvent` polyfill (`TicketDetailPage.test.tsx:13-28`); render, wait for rows; open the status Select and choose "Open" | The Clear filters control is present in the document | pending |
| CASE-3b0e40c8bf4e | boundary | category filter active alone | Clear filters is visible when only a category filter is active | Polyfill; render, wait for rows; open the category Select and choose "Refund request" | The Clear filters control is present in the document | pending |
| CASE-20df8cc073c5 | happy | all three filters active | Clear filters is visible with search, status and category all active | Polyfill; render, wait for rows; type `"login"`, select status "Open", select category "Technical question" | The Clear filters control is present in the document | pending |
| CASE-538c67330f0d | negative | search containing only whitespace | Clear filters is visible when the search term is whitespace only | Render, wait for rows; type a single space into the search input. `TicketsFilters.tsx:31` uses `e.target.value \|\| undefined`, so `" "` is truthy and lands in `filters.search` | The Clear filters control is present — a whitespace-only search is an active filter, not a default | pending |

### AC2 — Hidden at defaults (4 cases)

| Case ID | Class | Behaviour instance | Title | Steps | Expected | Result |
|---|---|---|---|---|---|---|
| CASE-c26b837c3ed5 | happy | initial mount with no filters applied | Clear filters is absent on initial mount | Mock `mockResponse()`; render `<TicketsPage />`, wait for the rows | The Clear filters control is not in the document | pending |
| CASE-b1ca237fc00c | negative | search typed then fully deleted | Clear filters is absent again after the search box is emptied | Render, wait for rows; type `"login"` and assert the control appears; clear the input with `user.clear` | Control absent. This is the `""` vs `undefined` asymmetry — visibility computed by truthiness over a `""` written by a Clear handler stays visible here | pending |
| CASE-d13a64090439 | boundary | status selected then re-selected to All statuses | Clear filters is absent again after status returns to All statuses | Polyfill; select status "Open", assert the control appears; re-open the Select and choose "All statuses" | The Clear filters control is not in the document | pending |
| CASE-dc3567d08fee | happy | the last active filter removed by the Clear action itself | Clear filters hides itself once activated | Render; type `"login"`; wait for the control; activate it | The control is no longer in the document — filters are back at defaults, so AC2 applies | pending |

### AC3 — Clear all filter controls together (2 cases)

`CASE-151947322ff2` is the AC's core proof and needs the Radix `PointerEvent` polyfill.
`CASE-54299e624f39` is retained deliberately as the one AC3 case that needs **no** polyfill, so the AC
is not left resting entirely on the suite's least-exercised harness.

| Case ID | Class | Behaviour instance | Title | Steps | Expected | Result |
|---|---|---|---|---|---|---|
| CASE-151947322ff2 | happy | all three filters active cleared together | Activating Clear filters resets all three controls to their defaults | Polyfill; type `"login"`, select status "Open", select category "Technical question"; activate Clear filters | Search input value is `""`, status trigger reads "All statuses", category trigger reads "All categories" — all three in one assertion block | pending |
| CASE-54299e624f39 | happy | only search active | Clearing with only search active empties the search box and leaves both selects at defaults | Type `"login"`; activate Clear filters | Search input is `""`; status trigger still "All statuses", category trigger still "All categories" | pending |

### AC4 — Unfiltered refresh (5 cases)

| Case ID | Class | Behaviour instance | Title | Steps | Expected | Result |
|---|---|---|---|---|---|---|
| CASE-39d9087d45f6 | happy | request params after clearing all three filters | The post-clear request carries exactly the sort and pagination params | Polyfill; apply all three filters; `mockClear()` and re-mock `mockResponse()`; activate Clear filters | `toHaveBeenLastCalledWith("/api/tickets", { params: { sortBy: "createdAt", sortOrder: "desc", page: 1, pageSize: 10 } })` — **full-object equality**. An `objectContaining` assertion here is dilution and must be rejected at review | pending |
| CASE-379746876d93 | happy | unfiltered result set renders after clearing | The unfiltered ticket rows are displayed after clearing | Mock `mockResponse([mockTickets[0]])`; type `"login"`, wait for the single row; re-mock `mockResponse()`; activate Clear filters | All three subjects render — "Cannot login to my account", "Refund for order #123", "How do I reset my password?" | pending |
| CASE-3af1d27a0741 | negative | cleared search omitted rather than sent as an empty string | The post-clear request omits the search param instead of sending an empty one | Type `"login"`, wait for the filtered request; `mockClear()`; activate Clear filters | The last call's params have **no `search` key** (`expect(params).not.toHaveProperty("search")` beside the equality assertion). `search: ""` would spread into `TicketsTable.tsx:122-128` and put `?search=` on the wire | pending |
| CASE-f1ab5d0941fc | failure | post-clear refetch rejects | A failed post-clear refetch shows the error alert and leaves the filters cleared | Type `"login"`, wait for rows; re-mock `mockRejectedValue(new Error("Network Error"))`; activate Clear filters. `renderWithQuery` disables retries, so this settles once | "Failed to fetch tickets" renders (`TicketsTable.tsx:153-155`) **and** the controls stay at defaults — filter state does not roll back to the pre-clear values | pending |
| CASE-739c6fe5dd97 | concurrency | Clear activated while a filtered request is in flight | Clearing during an in-flight filtered request settles on the unfiltered result set | Return a deferred promise for the filtered call; type `"login"` but do not resolve; activate Clear filters and resolve the unfiltered request; resolve the stale filtered promise afterwards | The rendered rows are the unfiltered set and the last request carries no filter params — the stale filtered response does not render last | pending |

### AC5 — Preserve sorting (2 cases)

The plan calls this the highest-value AC in the story: it holds for free today, breaks silently if the
implementation lifts filter state into `TicketsTable` or keys it on `filters`, and nothing in the repo
asserts it. Two cases are sufficient because a non-default column **and** a non-default direction are
both in play — any reset of sort state turns `subject`/`asc` back into `createdAt`/`desc`, which both
cases catch, one on the wire and one on screen.

| Case ID | Class | Behaviour instance | Title | Steps | Expected | Result |
|---|---|---|---|---|---|---|
| CASE-4c12ec6a7a66 | happy | subject ascending sort preserved across a clear | Clearing filters preserves a Subject ascending sort in the request | Click the Subject header once; type `"login"`; `mockClear()`; activate Clear filters | `toHaveBeenLastCalledWith("/api/tickets", { params: { sortBy: "subject", sortOrder: "asc", page: 1, pageSize: 10 } })` — full equality, so it proves AC4's omission and AC6's page reset in the same call | pending |
| CASE-a0b14a332363 | happy | sort indicator still rendered after a clear | The Subject header still shows the ascending arrow after clearing filters | Sort Subject asc, apply a search filter, activate Clear filters; inspect the Subject header's icon (`TicketsTable.tsx:175-181`) | The ascending arrow renders, not the neutral `ArrowUpDown`. The request assertion alone would miss a remount that resets sorting | pending |

### AC6 — Reset pagination (2 cases)

| Case ID | Class | Behaviour instance | Title | Steps | Expected | Result |
|---|---|---|---|---|---|---|
| CASE-0f03d7775fad | happy | clearing from page 3 with a filter active | Clearing filters from page 3 settles the query on page 1 | Mock `mockResponse(mockTickets, 50)`; type `"login"`; click "Next page" twice to reach page 3; `mockClear()` and re-mock; activate Clear filters | `toHaveBeenLastCalledWith` params `page: 1`. Assert the **last** call — the effect at `TicketsTable.tsx:107-109` means a page-3 unfiltered request may legitimately fire first. Never assert `not.toHaveBeenCalledWith({ page: 3 })` | pending |
| CASE-b809d54aaa12 | happy | page indicator after clearing from page 3 | The page indicator reads Page 1 after clearing filters from page 3 | Reach page 3 with a filter active against a 50-ticket total; activate Clear filters; wait for state to settle | The indicator span (`:252-254`) reads "Page 1 of 5" and the range text reads "Showing 1–10 of 50 tickets" | pending |

## Class distribution (curated)

| Class | Cases | AC coverage |
|---|---|---|
| happy | 11 | AC1, AC2, AC3, AC4, AC5, AC6 |
| boundary | 4 | AC1, AC2 |
| negative | 3 | AC1, AC2, AC4 |
| authz | 0 | — pruned at the gate; legal at T2, which records no dispositions |
| concurrency | 1 | AC4 |
| failure | 1 | AC4 |
| **Total** | **20** | AC1–AC6 (AC7 discharged by the set) |

## What was pruned, and why (22 cases)

Recorded by id so the exclusions are auditable. Nothing here was dropped by leaving it out of a
generation — every one went through `qa-scope curate`.

**AC5 boundary sweep — 9 cases.** `CASE-e68279bbfe28` (createdAt desc default), `CASE-8c4c05069244`
(createdAt asc), `CASE-a27dcb1679fa` (subject desc), `CASE-27214587284a` / `CASE-e2b99bc11366`
(senderName asc/desc), `CASE-0e23e0a8b4f4` / `CASE-00b1ecacdb6a` (status asc/desc),
`CASE-791ded8c41fc` / `CASE-5fbe49447c38` (category asc/desc). Sort state is a single `useState` in
`TicketsTable`; column identity does not change what the clear path can break, so eight of these
re-prove one mechanism. `CASE-e68279bbfe28` is pruned for a stronger reason: it **cannot fail against
the defect AC5 guards.** If sorting is reset by a remount it resets *to* `createdAt` desc, so the
request is unchanged and the case passes anyway. It is a green light that means nothing.

**Both authz cases — 2.** `CASE-8a9cdf098b0e` (identical for agent and admin),
`CASE-4a1c82353187` (post-clear refetch is an ordinary authenticated request). The predicate was met
because `/tickets` sits behind `ProtectedRoute`, not because this story adds authorization. Both pin
an absence of behaviour this story never introduces.

**Three of four concurrency cases — 3.** `CASE-ff572eb96851` (AC3 double-activate),
`CASE-495d22526f8c` (AC4 double-activate), `CASE-69fc59657990` (AC6 double-activate). All three are
the same instance under three ACs, and `CASE-dc3567d08fee` already proves the control removes itself
on activation — which makes a second activation unreachable rather than idempotent.
`CASE-739c6fe5dd97` is kept because stale-response ordering is a genuinely different mechanism and it
proves AC4's "displays the unfiltered result set" half under the realistic race.

**One of two failure cases — 1.** `CASE-b55474de6d9a` (slow refetch shows skeletons). The loading
skeleton is existing behaviour already covered at `TicketsPage.test.tsx:51-64`.
`CASE-f1ab5d0941fc` is kept because "filter state stays cleared when the refetch fails" is behaviour
this story introduces and nothing else asserts.

**Redundant boundary and negative variants — 4.** `CASE-2c9b1ef7a33d` (two filters active — subsumed
by `CASE-20df8cc073c5`), `CASE-f2747a35a22d` (category re-select — `CASE-3b0e40c8bf4e` already proves
the predicate reads `category`, and `CASE-d13a64090439` proves the sentinel-to-default path),
`CASE-f3f0ddec6b9a` (clearing while already on page 1), `CASE-e21c575faf47` (clearing from the last
filtered page — both subsumed by `CASE-0f03d7775fad`).

**Redundant AC3 and AC4 variants — 3.** `CASE-6470334aea3a` / `CASE-3765822b0891` (AC3 status-only and
category-only clears — `CASE-151947322ff2` asserts both dropdowns at once), `CASE-85470db66966`
(status/category sentinel omitted — `CASE-39d9087d45f6` clears all three and asserts full params
equality, which already fails if either sentinel leaks onto the request).

## Data prerequisites

- **No new fixtures.** The existing `mockTickets` array and `mockResponse()` helper
  (`TicketsPage.test.tsx:12-44`) cover AC1–AC5.
- **AC6 needs a multi-page total.** `mockResponse(mockTickets, 50)` gives 5 pages at `pageSize: 10` —
  the pattern the existing pagination tests already use (`:339`, `:361`). Reaching page 3 is two
  "Next page" clicks, with `mockedAxios.get.mockClear()` between steps.
- **Six cases drive a Radix dropdown and need the jsdom `PointerEvent` polyfill** from
  `TicketDetailPage.test.tsx:13-28`: `CASE-f1048c79850a`, `CASE-3b0e40c8bf4e`, `CASE-20df8cc073c5`,
  `CASE-d13a64090439`, `CASE-151947322ff2`, `CASE-39d9087d45f6`. `TicketsPage.test.tsx` has never
  asserted dropdown interaction — per the plan this is the one place where the test is harder than the
  code.
- **Command:** `cd client && bun run test`. jsdom, retries disabled via `renderWithQuery`. No
  database, no server, no network. There is no CI trigger in this repo, so per the plan "tests pass"
  is an unwitnessed claim until `/qa-execute` records a run.

## Regression scope carried from the plan

Must run and stay green: `client/src/pages/TicketsPage.test.tsx` (21 existing tests), the whole client
suite (`cd client && bun run test`), and `e2e/tests/tickets.spec.ts`. The existing exact-params test at
`:185-199` and the two sort tests at `:201-266` **must not be loosened to `objectContaining`** to
accommodate the new behaviour.

## Next step

`qa-scope approve-cases`, then `/dev-ticket #4` builds against this set.
