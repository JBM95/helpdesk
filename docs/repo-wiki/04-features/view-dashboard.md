---
tags: [dashboard, feature]
---

# Feature: View dashboard

> **Slug** `view-dashboard` · **Domain** [[dashboard]] · **Personas** Support Agent, Admin
> Cataloged 2026-09-07 (client scope).

## What the user does

Lands here after signing in and sees five stat cards — total tickets, open tickets, resolved by AI, AI resolution rate, average resolution time — plus a bar chart of ticket volume over the last 30 days. This is the only place the AI's effectiveness is visible as a number.

## Entry

`/`, behind `ProtectedRoute`. Nav link at `Layout.tsx:48-51`. Also the post-sign-in and catch-all redirect target.

## Components

`pages/HomePage.tsx` (204 LOC) — the whole feature. Charts via shadcn's Recharts wrapper.

## API

| Method | Path | Key | Line |
|--------|------|-----|------|
| GET | `/api/tickets/stats` | `["ticket-stats"]` | `:66` |
| GET | `/api/tickets/stats/daily-volume` | `["ticket-daily-volume"]` | `:78` |

Neither is invalidated by any mutation, so the dashboard refreshes on mount and window focus rather than in response to ticket activity.

## UI states

| State | Rendering |
|-------|-----------|
| Loading stats | skeletons inside the stat cards (`:133-134`) |
| Stats error | `ErrorAlert` replaces the whole page (`:83-95`) |
| Loading chart | skeleton in the chart card (`:157`) |
| Chart error | `ErrorAlert` inside the chart card only (`:151-155`) |
| Populated | 5 cards + chart (`:116-200`) |

The two failure modes differ in blast radius: a stats failure blanks the page, a chart failure degrades one card.

## Formatting

`formatDuration(seconds)` (`:39-49`) renders `"2d 5h"` / `"3h 15m"` / `"15m"`. Local to this file, not shared. The card shows `"N/A"` when `avgResolutionTime <= 0` (`:40`), which conflates "no data" with "instant".

## Tests

**None.** No `HomePage.test.tsx`, and no E2E asserts dashboard content — `auth.spec.ts` only checks the redirect to `/` lands. At 204 LOC this is the largest untested surface in the client. See [[11-testing]].
