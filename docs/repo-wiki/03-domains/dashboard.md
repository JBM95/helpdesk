---
tags: [dashboard, stats]
---

# Domain: Dashboard

> **Slug**: `dashboard`
> **Status**: active
> **Last refreshed**: 2026-09-07 by `explore-05-domain-mapper` (client scope only)

## Business purpose

The landing page after sign-in. Five stat cards show total tickets, open tickets, tickets resolved by AI, the AI resolution rate and average resolution time; a bar chart shows ticket volume over the last 30 days. It is the only place the AI's effectiveness is visible as a number.

## Code locations

- `client/src/pages/HomePage.tsx` (204 LOC) — the entire domain
- No test file

## Entry points

| Route | Component | Guard |
|-------|-----------|-------|
| `/` | `HomePage` | `ProtectedRoute` |

Nav link at `Layout.tsx:48-51`. Also the redirect target for the catch-all route and for post-sign-in.

## API surface, as the client calls it

| Method | Path | Query key | Called from |
|--------|------|-----------|-------------|
| GET | `/api/tickets/stats` | `["ticket-stats"]` | `HomePage.tsx:66` |
| GET | `/api/tickets/stats/daily-volume` | `["ticket-daily-volume"]` | `HomePage.tsx:78` |

Both are ticket endpoints, consumed only here. Neither is invalidated by any mutation, so the dashboard refreshes on mount and window focus rather than in response to ticket changes.

## Dependencies

- Recharts, via shadcn's chart wrapper (`components/ui/chart.tsx`)
- `ErrorAlert`, `components/ui/*` (Card, Skeleton)
- No dependency on `core/`
- No component-level dependency on [[tickets]] — the coupling is purely through the two endpoints

## Local logic

`formatDuration(seconds)` at `HomePage.tsx:39-49` renders durations as `"2d 5h"` / `"3h 15m"` / `"15m"`. It is local to this file and not shared. The card shows `"N/A"` when `avgResolutionTime <= 0` (`:40`).

## Test coverage

None — no `HomePage.test.tsx`, and no E2E spec covers the dashboard's content. This is the largest single untested page in the client (204 LOC). See [[11-testing]].

## Open questions

- The daily-volume endpoint takes no date parameter, so whether it returns a rolling 30-day window or a fixed calendar range is not determinable from the client.
- Whether `avgResolutionTime` of `0` means "instant" or "no data" is ambiguous; the UI treats it as no data.

## Related

- [[tickets]] — owns the endpoints this domain reads
- [[04-features/view-dashboard]]
