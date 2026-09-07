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

`Object.keys(filters).length > 0` would be **wrong** and is rejected: `TicketsFilters.tsx:31`
writes `search: e.target.value || undefined`, so typing then deleting the search text leaves the
key present with an `undefined` value. A key-count check would keep the button visible when
every filter is back at its default, breaking AC2. A test pins this.

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
(21 tests). AC1–AC3 are asserted by rendering `TicketsFilters` directly with props, which needs
no Radix dropdown interaction and therefore no PointerEvent polyfill. AC4–AC6 are asserted
through `TicketsPage` end to end, activating a filter via the search input.

| AC | Test | Assertion |
|----|------|-----------|
| AC1 | one filter active | `TicketsFilters filters={{ search: "login" }}` → Clear button in the document |
| AC1 | multiple filters active | `filters={{ status: "open", category: "refund_request" }}` → button present |
| AC2 | at defaults | `filters={{}}` → button absent |
| AC2 | keys present but undefined | `filters={{ search: undefined, status: undefined, category: undefined }}` → button absent (pins the per-field check against a key-count regression) |
| AC3 | reset payload | all three set, spy `onChange` → click Clear → called once with `{}` |
| AC3 | controls show defaults | via `TicketsPage`: type "login", click Clear → search input value `""`, "All statuses" and "All categories" displayed |
| AC4 | unfiltered query | via `TicketsPage`: type "login", clear mocks, click Clear → **exact** params `{ sortBy: "createdAt", sortOrder: "desc", page: 1, pageSize: 10 }` |
| AC5 | sort preserved | sort by Subject asc, type "login", clear mocks, click Clear → final call keeps `sortBy: "subject"`, `sortOrder: "asc"` |
| AC6 | pagination reset | total 50, type "login" **first**, then Next page (now page 2 with a filter active), click Clear → final call has `page: 1` and no `search` |
| AC7 | — | satisfied by the nine rows above: one active filter, multiple active filters, preserved sorting, pagination reset |

Two deliberate choices in this table:

- **AC4 asserts an exact params object, not `expect.objectContaining`.** Containment cannot prove
  a parameter is *absent*, which is the whole claim. This follows the existing exact-match test at
  `TicketsPage.test.tsx:190-197`.
- **AC6's setup order is filter-then-paginate.** Typing in search resets to page 1, so
  paginating first and filtering second would leave the user on page 1 and the test would pass
  without exercising anything. The AC6 scenario only exists in the filter-first order.
  Assertions use `toHaveBeenLastCalledWith` per the ambiguity note above.

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
- No existing selector matches `/clear filters/i`, so no ambiguous-query breakage.
- Full client suite re-run after the change; expected 114 + 9 = 123 tests green.

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
