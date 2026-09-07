---
tags: [tickets, feature]
---

# Feature: View ticket detail

> **Slug** `view-ticket-detail` · **Domain** [[tickets]] · **Personas** Support Agent, Admin
> Cataloged 2026-09-07 (client scope).

## What the user does

Opens one ticket and sees everything about it: subject, sender, timestamps, body, the reply thread, an on-demand AI summary, and a sidebar for status, category and assignment.

## Entry

`/tickets/:id`, behind `ProtectedRoute`. Reached by clicking a subject in [[view-tickets-list]]. `BackLink` returns to `/tickets`.

## Components

`pages/TicketDetailPage.tsx` composes a two-column grid: `TicketDetail`, `TicketSummary`, `ReplyThread` and `ReplyForm` on the left; `UpdateTicket` in the sidebar. `TicketDetailSkeleton` covers loading.

## API

`GET /api/tickets/:id` at `TicketDetailPage.tsx:20`, query key `["ticket", id]`. Invalidated by [[update-ticket-metadata]].

## UI states

| State | Rendering |
|-------|-----------|
| Loading | `TicketDetailSkeleton` (`:29`) |
| 404 | `ErrorAlert` "Ticket not found" (`:31-39`) |
| Other error | `ErrorAlert` "Failed to load ticket" |
| Populated | two-column grid (`:42-61`) |

## HTML sanitisation

Both `TicketDetail.tsx` and `ReplyThread.tsx` pass `bodyHtml` through `DOMPurify.sanitize()` before `dangerouslySetInnerHTML`, falling back to the plain-text `body` with `whitespace-pre-wrap`. Ticket bodies originate from inbound email, so this is untrusted content and the sanitisation is load-bearing.

## Composed features

[[update-ticket-metadata]] · [[generate-ticket-summary]] · [[view-replies-thread]] · [[add-reply]] · [[polish-reply]]

## Tests

`pages/TicketDetailPage.test.tsx` (479 LOC) and `components/TicketDetail.test.tsx` (66 LOC). E2E: `e2e/tests/ticket-detail.spec.ts`.
