---
tags: [tickets, ai, feature]
---

# Feature: Generate ticket summary

> **Slug** `generate-ticket-summary` · **Domain** [[tickets]] · **Personas** Support Agent, Admin
> Cataloged 2026-09-07 (client scope).

## What the user does

Clicks "Summarize" on a ticket to get an AI-generated précis of the ticket and its replies, rendered in a card below the button. Per [[00-vision]], a trustworthy summary is one of the Support Agent's critical needs — it is what lets them skip reading a full thread on an escalated ticket.

## Entry

Ticket detail page, between the body card and the reply thread.

## Components

`components/TicketSummary.tsx` (58 LOC).

## API

`POST /api/tickets/:id/replies/summarize` at `:16`. Returns `{ summary: string }`. A mutation with no cache write — the result lives in mutation state only, so it is lost on navigation and regenerated on each click.

## UI states

| State | Rendering |
|-------|-----------|
| Ready | "Summarize" button (`:25-33`) |
| Loading | disabled, "Summarizing…" (`:28,32`) |
| Error | `ErrorAlert` below the button (`:35-40`), no card |
| Success | summary card, `chart-3` tokens, sparkles icon, `whitespace-pre-wrap` (`:42-55`) |

## Cost note

This is a GPT call triggered directly by a button, with no client-side throttle, debounce or confirmation. Repeated clicking issues repeated calls. Whether the server rate-limits it is unknown — the server was not explored.

## Tests

`components/TicketSummary.test.tsx` (104 LOC) — covers the button, absence of a card before first click, the request, success, loading, error, and regeneration on repeat click. No E2E, which is the right call under CLAUDE.md's policy.
