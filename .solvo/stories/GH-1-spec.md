---
type: story
github: GH-1
tier: T2
tags: [tickets]
date: 2026-09-05
---

# GH-1 — Preserve ticket list filters, sorting and pagination in the URL

Recon: [[GH-1-recon]] · Plan: [[GH-1-plan]] · Cases: [[GH-1-cases]] · Domain: [[tickets]] · Feature: [[tickets-list]]

## Intent

The ticket list's working context — filters, sort, page — lives in component state today, so it is
lost on remount, reload and revisit. Move it into the URL search params and make the URL the single
source of truth, so an agent can open a ticket and come back to the list they had, and so a list view
can be bookmarked or shared.

## Grounding

**Nothing in `docs/repo-wiki/` was available to ground this spec on.** The wiki holds only scaffold
READMEs — no domain doc, no feature doc, no `11-testing.md`, no `09-legacy/`, no `bugfix-*` memories —
and `solvo.json → specs.functionalDir` is empty, so there is no as-is functional spec either.
`state.grounding` is therefore `[]`, and that is an accurate record rather than a missed step.

What this spec is grounded on instead: the source files named below, read directly during recon
([[GH-1-recon]], 7/7 confidence), and the approved QA plan and case set.

## Resolved ambiguity (AC4)

"Returning to the Tickets page" was ambiguous and blocked this phase. Resolved by **JB Mccallaghan**
to the retrace-only reading:

- **In scope**: browser Back, and the ticket-detail back link, restore the list state.
- **Out of scope**: the global nav Tickets link ([Layout.tsx:52](../../client/src/components/Layout.tsx#L52))
  keeps meaning "fresh default list" and is not touched.

The rejected reading would have required a store of the last list URL outside the URL, which is the
thing this story exists to remove.

## AC → test map

The 74 approved cases in [[GH-1-cases]] are the authoritative map; this table is the summary the build
works against. Every AC's cases are already generated, curated and approved, so build is TDD against
that set rather than against tests invented here.

Case counts are read from `GH-1-scope.json`, which is authoritative; 73 of the 74 are cited by id in
a test, and the 74th (`CASE-f338402aae86`) is proven by diff inspection because this repo has no
server test suite.

| AC | Behaviour | Cases | Proven at |
|---|---|---|---|
| AC1 | Status, category, search in the URL | 12 | component + unit |
| AC2 | Sort field + direction in the URL | 7 | component + unit |
| AC3 | Current page in the URL | 9 | component; reload at E2E |
| AC4 | Retrace back to the list restores state | 7 | E2E, except remount + back-link at component |
| AC5 | Browser back/forward | 7 | E2E only — a component test cannot prove this honestly |
| AC6 | Filter or sort change resets to page 1 | 7 | component |
| AC7 | Invalid params fall back safely | 14 | unit, plus component for the request itself |
| AC8 | Default/empty values omitted | 6 | unit + component |
| AC9 | `/api/tickets` behaviour unchanged | 5 | component regression; 1 by diff inspection |
| AC10 | Tests added | — | satisfied by the above; no behaviour of its own |

AC8's "where practical" has one reasonable reading — omit every value equal to its default — and is
built that way rather than blocked.

## Files to touch

| File | Change |
|---|---|
`client/src/lib/ticket-list-params.ts` | **new** — parse search params into a validated view state, and serialise a view state back to a search string omitting defaults. This module is where AC7 and AC8 live. |
`client/src/pages/TicketsPage.tsx` | derive filters + sort + page from `useSearchParams` via the module above; pass down; own the writes |
`client/src/pages/TicketsTable.tsx` | take sorting and pagination as props instead of local `useState`; **delete the `filters`-keyed `useEffect`** at lines 107–109 |
`client/src/pages/TicketsFilters.tsx` | unchanged if the reset stays in the page; touched only if the reset moves here |
`client/src/pages/TicketDetailPage.tsx` | back link carries the list's search string (AC4, retrace-only) |
`client/src/pages/TicketsPage.test.tsx` | new and updated tests per the approved case set |

`client/src/test/render.tsx` is **deliberately not changed**. It is used by 7 test files, so extending
`renderWithQuery` would widen the blast radius across every component test for one story's benefit.
New tests use `MemoryRouter` with `initialEntries` directly.

Two files outside the story's own scope were touched, declared here rather than left to be found:

| File | Why |
|---|---|
`client/src/test/pointer-events.ts` | **new** — the Radix pointer-capture shim needed to drive a Select in jsdom. It was already duplicated inline in `TicketDetailPage.test.tsx`, and this story's tests need it too; a third copy was the alternative. Imported for its side effect by the two test files that open a Select, so it carries none of `render.tsx`'s blast radius. |
`.gitattributes` | `solvo qa-scope` hashes the test plan and case set byte for byte, and `core.autocrlf` is `true` on this machine, so a fresh checkout would rewrite them to CRLF and every recorded approval would read as drifted. The generated `SOLVO` block covers only `/.solvo/**/*.json`. Added outside that block, scoped to `*.md`. Hygiene, not an AC — noted so it is a declared change rather than one riding along unannounced. |

## The two traps this story is most likely to fall into

**1. The `useEffect` at [TicketsTable.tsx:107](../../client/src/pages/TicketsTable.tsx#L107).** It resets
`pageIndex` whenever the `filters` **object identity** changes. Once `filters` is derived from search
params, a fresh object per render resets the page on every render: AC6 would pass while AC3, AC4 and
AC5 all fail. The fix is not memoisation — it is deleting the effect and resetting the page explicitly
at the point a filter or sort is changed, so the reset is caused by the user's action rather than
inferred from a reference comparison.

**2. An invalid param must never reach the API.** `ticketListQuerySchema` validates server-side with
`z.enum`, `validate` returns 400, and `TicketsTable` renders `ErrorAlert` on any query error. So an
unvalidated URL param does not degrade the list, it blanks it. Every param is validated client-side
against the same allow-lists before it is sent. The two traps that look plausible from the UI:
`?status=new` (a real `TicketStatus`, absent from `agentTicketStatuses`) and `?sortBy=senderEmail`
(the sender column renders an email, but `senderEmail` is not in `sortableColumns`).

## Open decision for GATE 1 — the sortable-column allow-list

`sortableColumns` in `core/schemas/tickets.ts` is **not exported** — only the derived
`TicketSortField` type is. The client needs the runtime list to satisfy AC7. Three ways, and this one
needs a decision because option A conflicts with an already-approved QA case:

- **A (recommended)** — move `sortableColumns` into `core/constants/ticket-sort.ts` and import it into
  the schema. Follows this repo's own stated convention ("define shared constants in
  `core/constants/`") and gives client and server one list. **But** approved case
  `CASE-071ab822b94e` asserts `core/schemas/tickets.ts` is unchanged, so that case needs rewording to
  assert what it actually meant: no change to the *accepted values* or the API behaviour. That is a
  new case-set revision and a re-approval.
- **B** — duplicate the list in the client. No core change, no QA amendment, and a drift bug waiting
  to happen: the next person to add a sortable column server-side gets a silent client-side rejection.
  That is precisely the AC7 failure class this story is about.
- **C** — derive the list from `TicketsTable`'s own `columns` array. No core change and no duplication
  today, because all five `accessorKey`s happen to be exactly the sortable set. It stops being true
  the moment a display-only column is added.

## Anti-regression plan

- `cd client && bun run test` in full — not a targeted file run. All 26 existing tests in
  `TicketsPage.test.tsx` stay green, and the exact-params assertion at
  [TicketsPage.test.tsx:186](../../client/src/pages/TicketsPage.test.tsx#L186) stays an exact match. It
  must **not** be loosened to `objectContaining` to accommodate new params — that assertion is the AC9
  control.
- `bun run test:e2e` — `tickets.spec.ts`, `ticket-detail.spec.ts`, `auth.spec.ts` in scope.
- No server test suite exists, so AC9's server half is proven by diff inspection.
- The 2 exploratory charters on the approved plan remain open obligations for a human after execution.

## Rollback

Pure client change: no migration, no feature flag, no config. Revert the commit. URLs shared while it
was live degrade cleanly after a revert — the params are simply ignored and the default list renders,
so no shared link 404s or errors.
