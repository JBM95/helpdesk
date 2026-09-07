---
type: memory
github: GH-4
tier: T2
tags: [tickets]
date: 2026-09-07
---

# Memory — GH-4: Clear filters on the tickets list

Story [[GH-4-spec]] · evidence [[GH-4]] · domain [[tickets]] · feature [[view-tickets-list]]

## What changed

One production file: `client/src/pages/TicketsFilters.tsx` gained a conditional ghost `Button`
that calls `onChange({})`. Nothing else in the client changed.

## The thing worth remembering

**Three of the seven ACs needed no code, because of where state already lives.** Filters are
held in `TicketsPage` (`:14`); sort and pagination are held in `TicketsTable` (`:99-105`). That
separation is what makes AC5 (sort survives a clear) and AC6 (page resets to 1) true for free —
the `filters`-keyed effect at `TicketsTable.tsx:107-109` already resets `pageIndex` on any
filter identity change, and nothing resets sorting on a filter change.

The corollary is the trap: **AC5 holds by accident of structure, not by intent, and any change
that lifts filter state into `TicketsTable`, remounts it, or gives it a `key` derived from
`filters` silently breaks it** with no type error and no other AC turning red. Confirmed by
mutation: `key={JSON.stringify(filters)}` on `TicketsTable` turns both AC5 cases red and leaves
the other 18 green. Anyone touching how the `filters` object identity is produced should run
those two cases first.

## The `""` versus `undefined` asymmetry

`TicketsFilters` writes `search: e.target.value || undefined`, so an emptied search box becomes
`undefined`, never `""`. Two consequences that bit, or nearly bit, this story:

1. **Active-filter detection must be per field against `undefined`, not a count of keys.**
   Typing then deleting leaves `search` present-but-undefined, so `Object.keys(filters).length > 0`
   keeps the action visible when every filter is back at its default. Two AC2 cases pin it.
2. **The axios params spread (`TicketsTable.tsx:122-128`) omits `undefined` fields entirely.** A
   clear handler writing `search: ""` would put `?search=` on the wire. Seven cases catch that,
   and they only catch it because the AC4 and AC5 assertions use **full params equality** —
   `expect.objectContaining` cannot prove a parameter is absent, and sails straight past the
   defect. If you loosen those assertions, you delete the coverage.

Still latent: a whitespace-only search is a truthy active filter and sends `?search=%20`
(pre-existing, and `CASE-538c67330f0d` confirms it as intended). And `filters.search !== undefined`
would count `""` as active if `filters` ever came from a source that produces empty strings — which
is exactly the direction of the closed-unmerged PR #1 (URL-held filter state). Unreachable today
because `:39` is the only writer.

## AC6 has a legitimate intermediate request

Clearing from page 3 fires `GET /api/tickets?page=3` with no filter params before settling on
page 1, because `filters` changes during render while `pageIndex` resets in an effect after
paint. AC6's second sentence ("after state settles") was written to allow this. Assert the
**last** call. Never write `not.toHaveBeenCalledWith({ page: 3 })` — that fails against correct
behaviour, and the likely response is to weaken the AC rather than fix a defect.

## Testing notes for this surface

- `TicketsPage.test.tsx` now carries this repo's second `PointerEvent` polyfill (copied from
  `TicketDetailPage.test.tsx:13-28` per [[11-testing]] pattern 10). Six of the 20 cases drive a
  Radix `Select`; before this story the file had never asserted dropdown interaction. At two
  sites, extracting it to `client/src/test/setup.ts` starts to look worthwhile.
- Returning a filter to its default hits a **previously-cached** query key. It still refetches
  because `renderWithQuery` sets only `retry: false`, leaving `staleTime` at 0.
- A `waitFor` on a condition that is already true proves nothing. One case asserted the absence of
  a stale render that way and could not fail; it now flushes a macrotask inside `act()` first.
- `bun run test:e2e` **cannot start its client server on Windows**: `playwright.config.ts:29`
  uses a POSIX inline env assignment (`VITE_API_URL=... bun run ...`) that cmd.exe rejects. Work
  around it by starting the client from bash on port 5174 and letting `reuseExistingServer` pick
  it up. Pre-existing and unrelated to this story, but it will block anyone running E2E here.

## Docs this story makes stale

[[11-testing]] (§ *Not covered here*) and [[view-tickets-list]] (§ Tests) both state that sort
preservation across a filter change is asserted nowhere in the repo. It now is, by
`CASE-4c12ec6a7a66` and `CASE-a0b14a332363`.
