---
tags: [tickets, support]
---

# Domain: Tickets

> **Slug**: `tickets`
> **Status**: active
> **Last refreshed**: 2026-09-07 by `explore-05-domain-mapper` (client scope only)

## Business purpose

Agents work the queue of tickets the AI could not resolve. The list view filters by status, category and free-text search, sorts by any column and paginates. The detail view shows the ticket body, the reply thread, an on-demand AI summary, and inline controls for status, category and assignment. Agents write replies, optionally asking the AI to polish a draft first.

## Code locations

- **Pages**: `client/src/pages/TicketsPage.tsx` (25 LOC), `TicketsFilters.tsx` (73), `TicketsTable.tsx` (280), `TicketDetailPage.tsx` (65)
- **Components**: `client/src/components/TicketDetail.tsx`, `TicketSummary.tsx`, `UpdateTicket.tsx`, `ReplyForm.tsx`, `ReplyThread.tsx`, `StatusBadge.tsx`, `TicketDetailSkeleton.tsx`
- **Tests**: `pages/TicketsPage.test.tsx` (400 LOC), `pages/TicketDetailPage.test.tsx`, `components/TicketDetail.test.tsx`, `TicketSummary.test.tsx`, `ReplyForm.test.tsx`, `ReplyThread.test.tsx`

## Entry points

| Route | Component | Guard |
|-------|-----------|-------|
| `/tickets` | `TicketsPage` | `ProtectedRoute` |
| `/tickets/:id` | `TicketDetailPage` | `ProtectedRoute` |

Nav link at `client/src/components/Layout.tsx:52-55`.

## API surface, as the client calls it

| Method | Path | Called from |
|--------|------|-------------|
| GET | `/api/tickets` | `TicketsTable.tsx:121` — params `sortBy`, `sortOrder`, `status?`, `category?`, `search?`, `page`, `pageSize` |
| GET | `/api/tickets/:id` | `TicketDetailPage.tsx:20` |
| PATCH | `/api/tickets/:id` | `UpdateTicket.tsx:37` — `{ status? , category?, assignedToId? }` |
| GET | `/api/tickets/:id/replies` | `ReplyThread.tsx:29` |
| POST | `/api/tickets/:id/replies` | `ReplyForm.tsx:36` |
| POST | `/api/tickets/:id/replies/polish` | `ReplyForm.tsx:50` |
| POST | `/api/tickets/:id/replies/summarize` | `TicketSummary.tsx:16` |
| GET | `/api/agents` | `UpdateTicket.tsx:30` — populates the assignment dropdown |

Two further ticket endpoints (`/api/tickets/stats`, `/api/tickets/stats/daily-volume`) are consumed only by [[dashboard]].

## State ownership

State is split across three components. This is the single most important structural fact about this domain.

| Concern | Owner | Detail |
|---------|-------|--------|
| Filters | `TicketsPage.tsx:14` | `useState<TicketFilters>({})` — all three fields optional and initially `undefined` |
| Sort | `TicketsTable.tsx:99-101` | `useState<SortingState>([{ id: "createdAt", desc: true }])` |
| Pagination | `TicketsTable.tsx:102-105` | `useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE })`, `PAGE_SIZE = 10` at line 96 |

`TicketFilters` is declared and exported in `TicketsPage.tsx:7-11`:

```ts
export interface TicketFilters {
  status?: TicketStatus;
  category?: TicketCategory;
  search?: string;
}
```

`TicketsPage` passes `filters` plus `setFilters` down to `TicketsFilters` (controlled), and `filters` read-only to `TicketsTable` (`TicketsPage.tsx:21-22`).

### Filter control defaults

`TicketsFilters.tsx:13` declares `const ALL = "__all__"`. All three controls store `undefined` in state and adapt at the display layer:

| Control | Displayed value | Written to state |
|---------|----------------|------------------|
| Search (`:28-33`) | `filters.search ?? ""` | `e.target.value \|\| undefined` — an emptied input becomes `undefined`, never `""` |
| Status (`:36-53`) | `filters.status ?? ALL` | `value === ALL ? undefined : value` |
| Category (`:55-70`) | `filters.category ?? ALL` | `value === ALL ? undefined : value` |

The `"__all__"` sentinel exists only because Radix `Select` cannot hold an empty value; it never reaches state or the network.

Status options map over `agentTicketStatuses` (`:47`), so only `open`, `resolved` and `closed` appear — `new` and `processing` are system-managed and deliberately absent. **Category options are hardcoded** at `:66-68` rather than mapping over `ticketCategories`, unlike `UpdateTicket.tsx:86`. Recorded as [[tech-debt|TD-01]].

### How the query is keyed and sent

`TicketsTable.tsx:119`:

```ts
queryKey: ["tickets", sortBy, sortOrder, filters, pagination.pageIndex]
```

`pageSize` is *not* in the key — it is a module constant, so it cannot vary at runtime.

Request params (`:122-128`) spread `...filters`, so `undefined` fields are **omitted from the query string entirely** rather than sent as empty values. `page` is sent 1-based (`pagination.pageIndex + 1`) while state is 0-based.

### Pagination reset mechanism

`TicketsTable.tsx:107-109`:

```ts
useEffect(() => {
  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
}, [filters]);
```

The dependency is the `filters` **object identity**, not its contents. `TicketsFilters` constructs a fresh object on every change (`{ ...filters, ... }`), so this fires on any filter interaction. Sorting resets the page separately inside `onSortingChange` (`:141-144`); sort state itself is never reset by a filter change.

## Dependencies

**On `core/`**: `constants/ticket.ts` (`Ticket`), `constants/ticket-status.ts` (`TicketStatus`, `agentTicketStatuses`, `statusLabel`), `constants/ticket-category.ts` (`TicketCategory`, `ticketCategories`, `categoryLabel`), `constants/sender-type.ts`, `schemas/replies.ts` (`createReplySchema`).

**On shared client code**: `ErrorAlert`, `ErrorMessage`, `BackLink`, `StatusBadge`, `components/ui/*`, DOMPurify (sanitises `bodyHtml` before `dangerouslySetInnerHTML`), TanStack Table.

**Consumed by**: [[dashboard]], via the two stats endpoints only — no component coupling.

## Test coverage

6 of 11 components have a direct test file. `TicketsFilters.tsx`, `TicketsTable.tsx`, `UpdateTicket.tsx`, `StatusBadge.tsx` and `TicketDetailSkeleton.tsx` do not; the first two are exercised indirectly through `TicketsPage.test.tsx`. See [[11-testing]].

## Open questions

- `GET /api/agents` and `GET /api/users` ([[user-management]]) may or may not be the same population. From the client alone the relationship is undeterminable — resolving it needs the server, which was not explored.
- `UpdateTicket.tsx` renders no error UI for a failed `PATCH`; the mutation error is not surfaced. Whether that is deliberate is unclear from the client.
- Whether the server caps or ignores `pageSize` is unknown from here.

## Related

- [[06-frontend-map]] — full query-key and component inventory
- [[04-features/view-tickets-list]], [[04-features/view-ticket-detail]]
- [[tech-debt]] — TD-01, TD-02
