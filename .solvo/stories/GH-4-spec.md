---
type: story
github: GH-4
tier: T2
tags: [tickets]
date: 2026-09-07
---

# GH-4 — Add a Clear filters action to the Tickets page

> Domain [[tickets]] · Feature [[view-tickets-list]] · Recon [[GH-4-recon]]
> Tier **T2**, confirmed by JB Mccallaghan on 2026-09-07.

## Intent

An agent who has narrowed the ticket queue by search, status and category currently has to
reverse each control individually to get back to the full list. Add one **Clear filters**
action that resets all three in a single interaction.

## AC ambiguity scan

Run per `gated-cycle` before planning. **Result: cleared** — each of AC1–AC7 has exactly one
honest reading against the code as it stands.

The two ACs worth recording the reasoning for, because each could have been ambiguous and is not:

- **AC1 "active"** resolves to *not at its default*, not *has been interacted with*. AC2 pins
  the vocabulary to "default values", and no touched/dirty tracking exists anywhere in
  `TicketsFilters` to support the other reading.
- **AC6 "After state settles"** explicitly scopes the assertion to the *settled* query rather
  than every intermediate one. This matters: clearing filters while on page 2 changes `filters`
  during render but resets `pageIndex` in an effect that runs after paint, so an intermediate
  fetch at `page: 2` is expected. AC6 as written permits it and requires only that the query
  the list ends on uses page 1. The test asserts the **last** call, not any call.

## Design

State ownership decides most of this story. Per [[view-tickets-list]] and verified in code:
filters live in `TicketsPage` (`:14`), while sort and pagination live in `TicketsTable`
(`:99-105`). So clearing filters cannot disturb sort, and the existing pagination-reset effect
already covers page reset.

**One production file changes: `client/src/pages/TicketsFilters.tsx`.**

Active-filter detection — explicitly per field, against `undefined`:

```ts
const hasActiveFilters =
  filters.search !== undefined ||
  filters.status !== undefined ||
  filters.category !== undefined;
```

`Object.keys(filters).length > 0` would be **wrong** and is rejected: the search input writes
`search: e.target.value || undefined`, so typing then deleting the search text leaves the key
present with an `undefined` value. A key-count check would keep the button visible when every
filter is back at its default, breaking AC2. Two AC2 cases pin this, and the mutation table
below confirms they fail against that exact defect.

The action itself, rendered only when `hasActiveFilters`:

```tsx
<Button variant="ghost" size="sm" onClick={() => onChange({})}>
  <X className="h-4 w-4" />
  Clear filters
</Button>
```

- `onChange({})` resets all three fields in one state write, and its fresh object identity is
  what drives both the query-key change (AC4) and the pagination-reset effect (AC6).
- `variant="ghost"` follows the local precedent for secondary in-table actions — the
  column-sort buttons at `TicketsTable.tsx:165-170`.
- `X` from `lucide-react`, already used as the dialog close affordance (`ui/dialog.tsx:2`).
- No icon margin: `buttonVariants` already applies `gap-2` (`ui/button.tsx:8`), and `size="sm"`
  refines it to `gap-1.5`.
- The visible text is the accessible name, so tests select it by role and name.

**No prop or signature changes.** `TicketsFilters` already receives `filters` (to read) and
`onChange` (to write). Nothing else in the client calls it — 0 callers to update.

## AC → test map

All tests go in `client/src/pages/TicketsPage.test.tsx`, which already covers this surface
(21 existing tests). The delivered set is the **20 cases approved in [[GH-4-cases]]**, carrying
their `CASE-` ids in the test names so verification can associate evidence with a specific AC
rather than with the suite as a whole. Every case drives `TicketsPage` end to end; six of them
drive a Radix `Select`, which is why this file now carries a `PointerEvent` polyfill for the
first time.

| AC | Cases | What they assert |
|----|-------|------------------|
| AC1 | `97bd394b8d4b`, `f1048c79850a`, `3b0e40c8bf4e`, `20df8cc073c5`, `538c67330f0d` | Action present with search alone, status alone, category alone, all three together, and a whitespace-only search. The three single-filter cases each prove a different disjunct of "at least one of" — a predicate written `search \|\| status` passes the search case and fails the category case |
| AC2 | `c26b837c3ed5`, `b1ca237fc00c`, `d13a64090439`, `dc3567d08fee` | Absent on initial mount; absent again after the search box is emptied; absent again after status returns to "All statuses"; and the action hides itself once activated |
| AC3 | `151947322ff2`, `54299e624f39` | Search input back to `""` and both select triggers reading "All statuses" / "All categories" — once with all three filters active, once with only search (the one AC3 case needing no polyfill) |
| AC4 | `39d9087d45f6`, `379746876d93`, `3af1d27a0741`, `f1ab5d0941fc`, `739c6fe5dd97` | **Exact** params equality on the post-clear request; the unfiltered rows rendering; the search param omitted rather than sent empty; a failed post-clear refetch showing the error while filters stay cleared; and a clear issued while a filtered request is still in flight |
| AC5 | `4c12ec6a7a66`, `a0b14a332363` | Subject-ascending preserved **on the wire** (exact params) and **on screen** (the header still renders the ascending arrow, not the neutral one) |
| AC6 | `0f03d7775fad`, `b809d54aaa12` | Clearing from **page 3** settles the query on page 1 (last call), and the indicator reads "Page 1 of 5" |
| AC7 | — | Discharged by the 20 cases above being AC-associated and green. Its four named scenarios map onto `97bd394b8d4b` (one active filter), `20df8cc073c5` (multiple), `4c12ec6a7a66` (preserved sorting) and `0f03d7775fad` (pagination reset) |

Two deliberate choices in this table:

- **AC4 asserts an exact params object, not `expect.objectContaining`.** Containment cannot prove
  a parameter is *absent*, which is the whole claim. This follows the existing exact-match test at
  `TicketsPage.test.tsx:190-197`.
- **AC6's setup order is filter-then-paginate.** Typing in search resets to page 1, so
  paginating first and filtering second would leave the user on page 1 and the test would pass
  without exercising anything. The AC6 scenario only exists in the filter-first order.
  Assertions use `toHaveBeenLastCalledWith` per the ambiguity note above.

### Proving the cases can fail

Every one of the 20 dies under at least one deliberate mutation, so none is a green light that
means nothing. Applied to a scratch copy and reverted after each run:

| Mutation | Cases killed |
|---|---|
| Detection by `Object.keys(filters).length` instead of per field | 2 (both AC2 interaction cases) |
| Clear writes `search: ""` instead of `undefined` — the QA plan's Trap 1 | 7, across AC2, AC4, AC5 and AC6 |
| `TicketsTable` remounted on filter change via a `filters`-derived `key` — Trap 3 | 2 (both AC5 cases) |
| Button never rendered | 19 — every case except the absent-on-mount one, which correctly survives |
| Button always rendered | the absent-on-mount case, plus 4 more |

The last two are complementary: their union is all 20.

## Anti-regression plan

Baseline recorded before any edit: **114 tests / 8 files green** (`cd client && bun run test`,
2026-09-07). No pre-existing failure to carry.

Regression scope, derived from the blast radius:

- All 21 existing `TicketsPage.test.tsx` tests must stay green. The one to watch is
  "should render the search input and filter dropdowns" (`:268-277`), which renders at default
  filters — it asserts the two "All …" labels are present, and the new button must not appear
  in that state, which AC2 also covers from the other direction.
- The empty-state test asserting exactly one table row (`:181`) is unaffected: the button
  renders in the filters row, outside the table.
- No existing selector matches `/clear filters/i`, so no ambiguous-query breakage. Confirmed by
  grep: no "Clear" text assertion exists anywhere else in `client/src` or `e2e`, and the only
  `toHaveLength` assertions in the suite count table `row`s, which the button sits outside of.
- Full client suite re-run after the change: **134 tests green** (114 + 20), over three
  consecutive runs to rule out flakiness.
- `e2e/tests/tickets.spec.ts` re-run at the build commit: **5/5 passed**. Note that
  `playwright.config.ts:29` uses a POSIX inline env assignment
  (`VITE_API_URL=... bun run ...`), which cmd.exe rejects, so `bun run test:e2e` cannot start
  its own client server on Windows. That is a pre-existing platform defect unrelated to this
  story; the run above was done by starting the client on 5174 from bash first and letting
  Playwright's `reuseExistingServer` pick it up.

Out of scope, and untouched: the search input's lack of debouncing (pre-existing, and clearing
is instantaneous either way), URL/query-string persistence of filters, and the status/category
dropdown *interaction* gap noted in [[11-testing]].

## Rollback

Revert the single commit. The change is an additive conditional render in one client component
plus tests — no migration, no schema change, no API change, no feature flag (the repo has none
per [[13-cross-cutting]]), and no persisted state. Reverting restores the prior behaviour exactly.

## Grounding

- [[view-tickets-list]] — state ownership, query params, and the two documented coverage gaps
- [[11-testing]] — client test patterns, the `renderWithQuery` helper, the PointerEvent polyfill
- [[08-standards/observed|observed standards]] — `@/` alias, Axios, TanStack Query, semantic tokens
- [[GH-4-recon]] — blast radius and the 7/7 confidence check

Doc trust: this repo has no `docs/repo-wiki/_state/doc-trust.json`, so every doc above is
**unrated**. Each claim taken from them was re-verified against the code during recon and spec.

## Ready-bar gaps on the source ticket

Advisory, per `ticket-standard`: the issue description is missing **Grounding** (no links to the
domain or feature docs it was written from) and **Open questions** (section absent). Sections
1–5 are present and non-empty. Neither gap blocked planning — recon supplied the grounding this
spec records above, and the ambiguity scan found nothing needing a stakeholder answer.
