---
type: testplan
github: GH-4
tier: T2
tags: [tickets]
date: 2026-09-07
---

# GH-4 Test Plan — Add a Clear filters action to the Tickets page

Story: [[GH-4-spec]] · Domain: [[tickets]] · Feature: [[view-tickets-list]] · Suites: [[11-testing]]

> **Grounding disclosure.** No `.solvo/state/GH-4.json` exists — the dev cycle has not started — so
> there is no recorded `grounding` block and no recorded `blastRadius` behind this plan. This is a
> disclosure, not a gap in the reading: `docs/repo-wiki/` is populated as of 2026-09-07 and the
> sections named under "Inputs" below were read directly. What is missing is the cycle's own record
> that they were read, which only recon writes. `solvo.json → specs.functionalDir` is empty, so there
> is no as-is functional spec, and `docs/repo-wiki/_memories/` holds only `README.md`, so there is no
> `bugfix-*` note for this area — the prior-work input below came from a closed PR instead.

## Timing

On time. No `gh/4-*` branch, no PR, no state file, and issue #4 carries no labels. This plan is
being written before dev starts, which is where it earns its value.

## Inputs this plan was derived from

**Tier: T2 — Standard.** *Typical feature/bug work in non-critical domains; oversight is
human-over-the-loop; gates are plan + merge.* Derived independently and it agrees with the story's
own hint:

- `solvo.json → tiers.t3Domains` is `["auth", "user-management"]`. This story is [[tickets]], so no
  domain trigger.
- No PII, payment or auth/authz code path. `/tickets` sits behind `ProtectedRoute`, but the story
  adds no authorization logic.
- Not T1 either — this is not copy, config or styling. It adds coordinated state-reset behaviour
  across three controls plus pagination, which is behaviour with a regression surface.
- `tiers.blastRadiusEscalation` is `{ files: 15, callers: 40 }`; the provisional radius below is 4
  files, so nothing escalates.

**Not yet confirmed by a human.** There is no `tier:T2` label on issue #4 and no state file, so this
plan's depth rests on a proposal. The story body says the hint "is not an authoritative override"
and asks Solvo to confirm through its gate — that confirmation is part of the human gate on this
plan. If recon lands a different tier, this plan is re-drafted as a new revision.

**Blast radius: provisional.** No state file, so this is the story's stated scope reconciled against
what the code actually does:

| File | Current role | Why it is in the radius |
|---|---|---|
| `client/src/pages/TicketsFilters.tsx` (73 LOC) | search input + two Radix `Select`s, controlled by `filters` / `onChange` | the action's likely home (`:25` is the filter row) |
| `client/src/pages/TicketsPage.tsx` (25 LOC) | owns `filters` in `useState<TicketFilters>({})` at `:14` | owns the state being reset |
| `client/src/pages/TicketsTable.tsx` (280 LOC) | owns `sorting` (`:99-101`) and `pagination` (`:102-105`); resets `pageIndex` in a `useEffect` keyed on the `filters` object identity (`:107-109`); issues the query (`:114-132`) | AC4, AC5 and AC6 are all decided here, not in the component being changed |
| `client/src/pages/TicketsPage.test.tsx` (400 LOC, 21 tests) | the only suite covering any of the above | new cases land here; several existing tests assert exact axios params |

Read-only constraints: `core/constants/ticket-status.ts` (`agentTicketStatuses` =
`open`/`resolved`/`closed`), `core/constants/ticket-category.ts` (`ticketCategories` =
`general_question`/`technical_question`/`refund_request`), `client/src/test/render.tsx`
(`renderWithQuery`, retries disabled).

**Source acceptance criteria (verbatim from issue #4):**

- [ ] **AC1 — Visible when needed:** The Clear filters action is visible when at least one of `search`, `status`, or `category` is active.
- [ ] **AC2 — Hidden at defaults:** The Clear filters action is not shown when `search`, `status`, and `category` are all at their default values.
- [ ] **AC3 — Clear all filter controls together:** Activating Clear filters resets `search`, `status`, and `category` together, and the three controls immediately show their default state.
- [ ] **AC4 — Unfiltered refresh:** After clearing, the ticket list is queried without `search`, `status`, or `category` filter parameters and displays the unfiltered result set.
- [ ] **AC5 — Preserve sorting:** Clearing filters preserves the current sort column and sort direction.
- [ ] **AC6 — Reset pagination:** If the user is on a page other than page 1, clearing filters returns the ticket list to page 1. After state settles, the active ticket query uses page 1.
- [ ] **AC7 — Automated regression coverage:** Component/integration tests cover AC1–AC6, including one active filter, multiple active filters, preserved sorting, and pagination reset.

## Prior work in this exact area — read this before writing a case

PR #2 (`#1: hold ticket list filters, sort and page in the URL`, branch
`gh/1-preserve-ticket-list-view-state`) was **closed unmerged on 2026-09-07** after reaching an
approved T2 plan and case set. `main` is back to component-held filter state. Its PR body records
the failure mode, and it is the single most useful input to this plan:

> The `filters`-keyed `useEffect` in `TicketsTable.tsx` is deleted rather than memoised. Once
> `filters` came from search params that object was new every render, so the effect would have reset
> the page on every render: **AC6 would pass while AC3, AC4 and AC5 all failed.**

The shape of that lesson transfers directly, because GH-4's AC6 is the same pagination-reset
behaviour riding on the same object-identity effect. **A pagination assertion is the easiest AC in
this story to satisfy and the least informative one.** Any implementation that changes how the
`filters` object identity is produced can leave AC6 green while quietly breaking sort preservation
or the unfiltered refetch. The cases for AC4 and AC5 are what carry this plan; AC6 alone proves
almost nothing.

This is history in a closed PR, not in `docs/repo-wiki/_memories/`, so it is invisible to anyone who
reads only the wiki. It is restated here on purpose.

## The three traps this story actually has

Everything below was read off the source, not inferred from the AC wording.

### Trap 1 — AC4 is defeated by `expect.objectContaining`

`TicketsTable.tsx:122-128` spreads `...filters` into the axios `params`, so a field that is
`undefined` is **omitted from the request entirely**. Today `TicketsFilters.tsx:31` is careful about
this: `e.target.value || undefined` means an emptied search box becomes `undefined`, never `""`.

A new Clear handler that sets `search: ""` (or `status: ""`) instead of `undefined` sends
`?search=` on the wire. AC4 says the list is queried *without* those parameters, so that is a
defect — and a case written as `expect.objectContaining({ page: 1 })` passes straight through it.

**The AC4 case must assert the full params object by equality**, in the shape the existing test at
`TicketsPage.test.tsx:190-197` already uses:

```ts
expect(mockedAxios.get).toHaveBeenLastCalledWith("/api/tickets", {
  params: { sortBy: "createdAt", sortOrder: "desc", page: 1, pageSize: 10 },
});
```

An `objectContaining` assertion on AC4 is assertion dilution and should be rejected at review.

### Trap 2 — AC6 has a real intermediate query, and the AC was written to allow it

`TicketsTable.tsx:107-109` resets `pageIndex` in an **effect**, so on the render where `filters`
becomes `{}` the component still holds the old `pageIndex`. The query key
(`:119`) is `["tickets", sortBy, sortOrder, filters, pagination.pageIndex]` — both values are in it.
So clearing filters while on page 3 can fire `GET /api/tickets?page=3` with no filter params, and
only then settle to `page=1`.

AC6's second sentence — "After state settles, the active ticket query uses page 1" — is worded to
accommodate exactly that. So:

- Assert the **last** call (`toHaveBeenLastCalledWith`), and assert the rendered indicator reads
  `Page 1 of N` via the `:252-254` span.
- **Do not** write `expect(mockedAxios.get).not.toHaveBeenCalledWith({ page: 3 })`. That case fails
  against correct behaviour, and the likely response is to weaken AC6 rather than fix a defect —
  which is how a real requirement gets negotiated away by a bad test.

Whether the extra request is worth eliminating is a design question for the dev cycle, not a QA
verdict. It is flagged here so it is a decision rather than a surprise.

### Trap 3 — AC5 is currently proven by nothing at all

Both [[11-testing]] (§ *Not covered here*, line 54) and [[view-tickets-list]] (§ Tests, line 63)
record the same gap: **sort preservation across a filter change is not asserted anywhere in the
repo.**

Structurally AC5 holds for free today — `sorting` lives in `TicketsTable`, `filters` in
`TicketsPage`, and `:141-144` resets the page on sort but never the reverse. AC5 breaks only if the
implementation lifts filter state into `TicketsTable`, remounts it, or gives it a `key` derived from
`filters`. Each of those is a plausible way to write this feature and each resets sorting silently,
with no type error and no other AC turning red.

That makes AC5 **the highest-value case in the set**, and closing a pre-existing suite gap is a
side benefit worth taking.

## AC → test-type map

`CLAUDE.md § Testing` prefers component tests and reserves E2E for a real browser plus server;
[[11-testing]] confirms Vitest + RTL as the dominant pattern. Every AC here is component-level.

| AC | Level | What proves it | Class predicates met |
|---|---|---|---|
| **AC1** visible when active | Component | Action present with each filter active alone (search / status / category), with two active, and with all three | happy, boundary (exactly one active — the low end of "at least one"), negative |
| **AC2** hidden at defaults | Component | Absent on initial mount; **absent again after type-then-delete in search**; absent again after selecting a status then re-selecting "All statuses" | happy, boundary (zero active), negative |
| **AC3** clear all together | Component | Activate → search input `value === ""`, status trigger reads "All statuses", category trigger reads "All categories". Requires driving Radix `Select` — see prerequisites | happy, concurrency (double-activate) |
| **AC4** unfiltered refresh | Component | **Exact** params equality per Trap 1, plus the unfiltered row set renders | happy, negative, failure |
| **AC5** preserve sorting | Component | Sort by Subject asc → apply a filter → clear → last call still `sortBy: "subject", sortOrder: "asc"` **and** the Subject header still shows the asc arrow (`:175-181`) | happy, boundary (each sortable column; both directions), **regression** |
| **AC6** reset pagination | Component | On page 3 with a filter active → clear → `toHaveBeenLastCalledWith` `page: 1` and the indicator reads `Page 1 of N`, per Trap 2 | happy, boundary (already on page 1 → still page 1), concurrency |
| **AC7** automated coverage | **Meta — not independently verifiable** | Satisfied by the AC1–AC6 case set existing, being AC-associated, and running green. Flagged so `/qa-verify` does not hunt for a behaviour to prove and does not read it as an unmet obligation | n/a |

AC7's own wording names four scenarios — one active filter, multiple active filters, preserved
sorting, pagination reset. Those map onto AC1, AC1, AC5 and AC6 respectively, so AC7 is discharged
by that set rather than by cases of its own. The story also requires each AC to carry at least one
explicit AC-associated evidence path, which the map above satisfies; suite-level-only evidence is
not acceptable for this story.

### Class coverage under the T2 rule

All six classes have their predicate met, so none is declined. Per `test-method`, instances inside a
generated class are not pre-pruned on guessed relevance — the human gate curates.

- **happy** — always.
- **boundary** — the ACs name a collection with both ends: "at least one of" three (AC1) and all
  three at default (AC2), plus sort ordering (AC5) and page number (AC6).
- **negative** — `search` is free text the agent controls and status/category are selected options.
  The instance that matters is the `""`-versus-`undefined` asymmetry: `filters.search` becomes
  `undefined` when the box is emptied (`TicketsFilters.tsx:31`), so if visibility is computed by
  truthiness over a `""` that a Clear handler wrote, the action stays visible at defaults and AC2
  fails — reachable only through an interaction sequence, never from initial state.
- **authz** — met because the blast radius reaches a surface behind authentication (`/tickets` behind
  `ProtectedRoute`, `/api/tickets` behind `requireAuth`), not because this story adds any
  authorization. Instances: the action renders identically for `agent` and `admin` (no role gating is
  intended, and asserting that pins it), and the post-clear refetch is an ordinary authenticated
  request. Thin by design; a candidate for pruning at the gate.
- **concurrency** — the entry point is a button, so it can be submitted twice. Instances:
  double-activating Clear is idempotent (no second unfiltered request, action stays hidden); and
  activating Clear while a filtered request is still in flight settles on the unfiltered page-1
  response rather than letting the stale filtered response render last. `renderWithQuery` disables
  retries, which makes the in-flight case deterministic.
- **failure** — every AC's path calls `GET /api/tickets`. Instances: the post-clear refetch fails →
  `ErrorAlert message="Failed to fetch tickets"` renders (`:153-155`) **and the filter state stays
  cleared** rather than rolling back; slow refetch → the five skeleton rows (`:189-208`) render while
  the controls already show defaults.

## Regression scope (provisional — no recorded blast radius)

Derived from the domain mapping in [[tickets]] and the suite inventory in [[11-testing]], since no
state file records a radius.

**Must run and stay green**

- `client/src/pages/TicketsPage.test.tsx` — 21 tests, the direct suite. The sensitive ones are
  `should call axios.get with default sort and pagination params` (`:185-199`, exact params) and the
  two sort tests (`:201-266`). **These must not be loosened to `objectContaining` to accommodate the
  new behaviour** — that is the same dilution Trap 1 warns about, applied to existing coverage.
- The whole client suite: `cd client && bun run test` (8 files). Cheap enough that a targeted file
  run is not worth the narrower signal, and it is the check if the implementer touches the shared
  `renderWithQuery` helper.
- `e2e/tests/tickets.spec.ts` (~5 tests) — nav plus the webhook→list integration flow.

**Explicitly out of scope**

- `server/**` — `solvo.json → quality.tests.backend` is `n/a: no server test suite exists in this
  repo`, and this story touches no server code. The story confirms no API, DB, auth, job, schema or
  URL-state change is required.
- `e2e/tests/webhook-inbound-email.spec.ts`, `users.spec.ts` — no path from this change reaches them.

**No new E2E test.** Everything in AC1–AC6 is rendering, interaction and request-param assertion,
which `CLAUDE.md § Testing` names as component-test territory and explicitly not a valid E2E
scenario. Adding one here would duplicate the component set in a slower harness.

**TD-01 does not gate this story.** [[tech-debt]] TD-01 records that
`TicketsFilters.tsx:66-68` hardcodes the three category options instead of mapping
`ticketCategories`. Clear filters resets category to the `__all__` sentinel, so a fourth category
added later would still clear correctly — the debt is a filter that cannot *reach* a new category,
not one that cannot clear. Recorded so QA does not re-open it, and out of scope to fix here.

## Data prerequisites

- **Fixtures**: none new. The existing `mockTickets` array and `mockResponse()` helper at
  `TicketsPage.test.tsx:12-44` cover the AC1–AC5 cases.
- **AC6 needs a second page**: `mockResponse(mockTickets, 50)` gives `total: 50` at `pageSize: 10`,
  which is the pattern the existing pagination tests already use (`:339`, `:361`). Reaching page 3
  means clicking Next twice or Last once, with `mockedAxios.get.mockClear()` between steps as the
  existing tests do.
- **AC3 needs the Radix `Select` polyfill**: asserting that the two dropdowns *display* their default
  state after a reset means driving Radix `Select`, which needs the jsdom `PointerEvent` polyfill at
  `TicketDetailPage.test.tsx:13-28`. [[11-testing]] flags this as the pattern to copy, and records
  that dropdown *interaction* is not currently asserted in `TicketsPage.test.tsx` at all — so AC3
  pushes this suite into territory it has never covered. Budget for that; it is the one place in this
  story where the test is harder than the code.

## Environment needs

- Component: `cd client && bun run test` (`vitest run`) — `solvo.json → quality.tests.frontend`.
  jsdom, retries disabled via `renderWithQuery`. No database, no server, no network.
- E2E: `bun run test:e2e` — `quality.tests.e2e`. Needed only to confirm the existing
  `tickets.spec.ts` stays green; no new spec.
- `quality.tests.backend` stays the `n/a:` marker. Nothing in this story needs it.
- **No CI.** [[11-testing]] § CI integration: `.github/workflows/` holds only `claude.yml`, a
  `@claude` mention responder. No push or pull-request trigger runs a test. Per [[00-scope]], an
  absent pipeline is not a green pipeline — every command in this plan is local-only and unenforced,
  and the gate is whoever remembers to run it. Treat "tests pass" as an unwitnessed claim unless the
  `/qa-execute` run records it.
- **Coverage is not evidenced for this story**, under the repo-wide waiver already recorded at
  `solvo.json → quality.coverageWaiver`: no coverage reporter is configured anywhere, and
  `quality.coverageArtifact` is an `n/a:` marker, so the `coverageDiffLine: 80` target cannot be
  measured without first adding tooling — out of scope for a filter-reset story. `solvo doctor`
  reports this as a visible `coverage-waiver` WARN, and that visibility is the intended record. QA
  readiness for GH-4 therefore rests on the case set, not on a coverage number.

## Exploratory charters

**None.** Recorded as a deliberate decision, not an omission.

The story constrains this directly: *"Do not add exploratory charters unless the QA plan identifies a
concrete risk that cannot reasonably be proven with deterministic automated tests"* and *"No manual
QA obligation is expected for this story."* Every risk this plan found — Trap 1's `""`-versus-omitted
param, Trap 2's intermediate query ordering, Trap 3's sort preservation, and the `""`/`undefined`
visibility asymmetry — is deterministically assertable in Vitest. None of them needs a human at a
browser.

At T2 a charter is not free: `/qa-execute` turns each one into a `manual`/`exploratory` obligation
that gates readiness until a named human closes it through `qa-result perform`. Adding one for form's
sake would buy an unprovable obligation.

**One candidate is raised at the gate rather than added silently.** Trap 2's intermediate query
means the list can briefly render page-3-of-unfiltered rows before settling to page 1. Whether that
flicker is *perceptible and objectionable* is a judgement jsdom cannot make — the call-order half is
automatable, the by-eye half is not. If the tester wants that judged, the charter would be:

> `CHARTER: explore the tickets list clear-filters transition with a throttled network and a
> multi-page result set to discover intermediate renders an agent would read as a wrong result set`

Adding it is the tester's call at the gate. It is written out here so the decision is explicit in
either direction.

## BMAD handoff

`solvo.json → specLayer.provider` is `bmad`, but no BMAD install is present — `.agents/skills/`
holds only `better-auth-best-practices` and `frontend-design`. Case generation therefore runs through
`/qa-cases` under `test-method` rather than BMAD QA. If BMAD is installed before `/qa-cases`, hand it
this plan as grounding and hold it to the same artifact contract.

## Next step

`/qa-cases 4`, after this plan is approved.
