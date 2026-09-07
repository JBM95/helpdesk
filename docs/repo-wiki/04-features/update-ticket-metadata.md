---
tags: [tickets, feature]
---

# Feature: Update ticket metadata

> **Slug** `update-ticket-metadata` · **Domain** [[tickets]] · **Personas** Support Agent, Admin
> Cataloged 2026-09-07 (client scope).

## What the user does

Changes a ticket's status, category or assigned agent from three dropdowns in the detail sidebar. Each selection applies immediately — there is no submit button.

## Entry

Ticket detail page (`/tickets/:id`), right sidebar.

## Components

`components/UpdateTicket.tsx` (123 LOC).

## API

| Method | Path | Body | Line |
|--------|------|------|------|
| PATCH | `/api/tickets/:id` | `{ status? }` or `{ category? \| null }` or `{ assignedToId? \| null }` | `:37` |
| GET | `/api/agents` | — populates the assignment dropdown, key `["agents"]` | `:30` |

Invalidates `["ticket", String(id)]` on success (`:41`).

## Options

Status maps over `agentTicketStatuses`, so only `open`, `resolved`, `closed` are offered — `new` and `processing` are system-managed. Category maps over `ticketCategories` (`:86-88`), plus a "None" option sending `null`. Assignment offers the agent list plus "Unassigned", sending `null`.

Note that this component maps over the shared `ticketCategories` constant while the list filter hardcodes the same values — see [[tech-debt]] TD-01.

## UI states

| State | Rendering |
|-------|-----------|
| Loading agents | dropdown renders, empty until the query resolves |
| Mutating | no feedback — dropdowns stay interactive, nothing disabled |
| **Error** | **none — no `ErrorAlert` is rendered** |
| Success | `["ticket", id]` invalidated, sidebar re-renders |

## Gap worth knowing

This is the only mutation in the client with **no error surface**. A failed `PATCH` is silent: the dropdown snaps back when the ticket refetches, with nothing explaining why. Every other mutation in the codebase renders an `ErrorAlert`. Recorded in [[13-cross-cutting]] as behavioural rather than as debt, since it is a missing affordance rather than decaying code.

## Tests

No direct test file. Fully exercised through `pages/TicketDetailPage.test.tsx:190-441`, which asserts all three dropdowns and both `null` cases.
