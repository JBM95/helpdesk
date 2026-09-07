---
tags: [tickets, feature]
---

# Feature: View tickets list

> **Slug** `view-tickets-list` · **Domain** [[tickets]] · **Personas** Support Agent, Admin
> Cataloged 2026-09-07 (client scope).

## What the user does

Opens the ticket queue and narrows it down. Filters by free-text search, by status (`open` / `resolved` / `closed`) and by category. Sorts any column. Pages through results 10 at a time. Clicks a subject to open the ticket.

This is the Support Agent's primary work surface — per [[00-vision]] they filter to `open` and work down the list.

## Entry

`/tickets`, behind `ProtectedRoute`. Nav link at `Layout.tsx:52-55`.

## Components

| File | Role |
|------|------|
| `pages/TicketsPage.tsx` | container; owns filter state (`:14`) |
| `pages/TicketsFilters.tsx` | search input, status select, category select |
| `pages/TicketsTable.tsx` | TanStack Table; owns sort (`:99-101`) and pagination (`:102-105`); issues the query |
| `components/StatusBadge.tsx` | status pill |

State ownership, control defaults, the `"__all__"` sentinel, the query-key composition and the pagination-reset effect are documented in full in [[tickets]].

## API

`GET /api/tickets` at `TicketsTable.tsx:121`.

Params (`:122-128`): `sortBy`, `sortOrder`, `page` (1-based), `pageSize` always sent; `search`, `status`, `category` spread from `filters` and therefore **omitted entirely when undefined**.

Response: `{ tickets, total, page, pageSize }`.

Query key (`:119`): `["tickets", sortBy, sortOrder, filters, pagination.pageIndex]`.

## Columns

Subject (link to detail), Sender (name + muted email), Status (`StatusBadge`), Category (badge, or `—` when null), Created (localised date). All five sortable.

## UI states

| State | Rendering |
|-------|-----------|
| Loading | 5 skeleton rows (`:189-208`) |
| Error | `ErrorAlert`, table hidden (`:153-155`) |
| Empty | "No tickets" in the pagination summary (`:227-228`) |
| Populated | table rows (`:209-220`) |

## Notable behaviour

- Changing any filter resets to page 1, via the `useEffect` at `:107-109` keyed on the `filters` object identity.
- Changing sort also resets to page 1, separately, inside `onSortingChange` (`:141-144`).
- Sort is **not** reset by a filter change.
- The list is never invalidated by a mutation elsewhere in the app, so a status change made on the detail page is not reflected here until refocus or remount ([[13-cross-cutting]]).

## Tests

`pages/TicketsPage.test.tsx` (400 LOC) — the largest test file in the repo. `TicketsFilters` and `TicketsTable` have no direct test files; both are exercised through this one. Dropdown *interaction* is not asserted, nor is sort preservation across a filter change. See [[11-testing]].

E2E: `e2e/tests/tickets.spec.ts` covers navigation and webhook→list integration.
