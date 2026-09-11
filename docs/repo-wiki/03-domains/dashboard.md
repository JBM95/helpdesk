---
tags: [dashboard, stats]
---

# Domain: Dashboard

> **Slug**: `dashboard`
> **Status**: active
> **Last refreshed**: 2026-09-08 by `explore-05-domain-mapper` (full-stack scope; was client-only before)

## Business purpose

The landing page after sign-in. Five stat cards show total tickets, open tickets, tickets resolved by AI, the AI resolution rate and average resolution time; a bar chart shows ticket volume over the last 30 days. It is the only place the AI's effectiveness is visible as a number.

## Code locations

**Backend**
- `server/src/routes/tickets.ts:20-32` — `GET /api/tickets/stats`, calls the stored function `get_ticket_stats(AI_AGENT_ID)` via `prisma.$queryRaw`
- `server/src/routes/tickets.ts:34-61` — `GET /api/tickets/stats/daily-volume`, rolling 30-day window, zero-fills missing dates

Both endpoints live in the tickets router but are consumed only here.

**Frontend**
- `client/src/pages/HomePage.tsx` (204 LOC) — the entire domain, in one file

**Core (shared vocabulary)**
- None. No Zod schema and no constant is specific to this domain — the only domain with no `core/` dependency at all.

**Data ownership (Prisma)**
- None. It reads `Ticket` but owns no model.

**Test coverage**
- **None.** No `HomePage.test.tsx`, and no E2E spec covers the dashboard's content. At 204 LOC this is the largest untested surface in the client. See [[11-testing]].

## Entry points

| Route | Component | Guard |
|-------|-----------|-------|
| `/` | `HomePage` | `ProtectedRoute` |

Nav link at `Layout.tsx:48-51`. Also the catch-all redirect target and the post-sign-in destination.

| Method | Route | Handler | Auth |
|--------|-------|---------|------|
| GET | `/api/tickets/stats` | `tickets.ts:20-32` | `requireAuth` |
| GET | `/api/tickets/stats/daily-volume` | `tickets.ts:34-61` | `requireAuth` |

Both require only `requireAuth` — agents and admins see the same dashboard.

## API surface, as the client calls it

| Method | Path | Query key | Called from |
|--------|------|-----------|-------------|
| GET | `/api/tickets/stats` | `["ticket-stats"]` | `HomePage.tsx:66` |
| GET | `/api/tickets/stats/daily-volume` | `["ticket-daily-volume"]` | `HomePage.tsx:78` |

**Neither key is invalidated by any mutation anywhere in the app.** The dashboard refreshes on mount and on window focus, never in response to a ticket change. A ticket resolved in another tab will not move these numbers until one of those two things happens.

## Backend implementation

**Stats** (`tickets.ts:20-32`):

```typescript
const [row] = await prisma.$queryRaw<[TicketStatsRow]>`SELECT * FROM get_ticket_stats(${AI_AGENT_ID})`;
res.json({
  totalTickets: Number(row.totalTickets),
  openTickets: Number(row.openTickets),
  resolvedByAI: Number(row.resolvedByAI),
  aiResolutionRate: row.aiResolutionRate,
  avgResolutionTime: row.avgResolutionTime,
});
```

The `Number()` casts exist because the function returns `BIGINT` columns, which arrive as JS `bigint` and are not JSON-serializable. The function itself is defined in migration 10 and excludes `new` and `processing` tickets from every count — see [[07-data-model]]. This is the only raw SQL call site in the codebase.

**Daily volume** (`tickets.ts:34-61`): computes `thirtyDaysAgo` as 29 days back at local midnight (`:35-37`), fetches tickets created since (`:39-42`), groups by `YYYY-MM-DD` from an ISO slice into a `Map<string, number>` (`:44-49`), then fills every one of the 30 days, zero included (`:51-58`). A **rolling** window, not a calendar range.

## Local logic

`formatDuration(seconds)` at `HomePage.tsx:39-49` renders `"2d 5h"` / `"3h 15m"` / `"15m"`. Local to the file, not shared. The card shows `"N/A"` when `avgResolutionTime <= 0` (`:40`).

## Dependencies

**Inbound** — none. Nothing depends on this domain.

**Outbound**
- [[tickets]] — reads two endpoints, no write coupling
- [[auth]] — `requireAuth` on both endpoints
- Recharts, through shadcn's chart wrapper (`components/ui/chart.tsx`)
- `ErrorAlert`, and `components/ui/*` (Card, Skeleton)

## Open questions

- Whether `avgResolutionTime` of `0` means "instant" or "no data" is ambiguous. The UI treats it as no data (`:40`). The `get_ticket_stats` body would settle which the database actually returns; it was not read line by line in this pass.
- The stats keys are never invalidated by a mutation. Whether that staleness is deliberate or an oversight is not determinable from the code.
- Resolved from the server side: the daily-volume window is confirmed rolling, not calendar-aligned.

## Related

- [[tickets]] — owns the endpoints this domain reads
- [[05-api-surface]] — both endpoints in full
- [[07-data-model]] — the `get_ticket_stats` stored function
- [[11-testing]] — the coverage gap on this page
- [[04-features/view-dashboard]]
