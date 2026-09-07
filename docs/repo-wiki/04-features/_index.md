---
tags: [features, index]
---

# Features — Index

> Cataloged by `explore-09-feature-cataloger` via `/setup-05-explore client` on 2026-09-07.
> **Traced:** UI entry point → components → API call (method + path + params) → UI states.
> **Not traced:** server handlers, database, background jobs. The API boundary is where this catalog stops, because `server/` was deliberately not explored — see [[00-scope]].

## Persona note

[[00-vision]] names three personas. Only two appear here. The **Student Sender** has no UI and no feature: they never log in, their tickets arrive through the inbound-email webhook, and they receive replies by email — possibly AI-authored and sent with no human approval. Every feature below serves an internal user.

## Inventory

| Feature | Domain | Persona | Entry | API |
|---------|--------|---------|-------|-----|
| [[sign-in]] | [[auth]] | Agent, Admin | `/login` | Better Auth SDK |
| [[sign-out]] | [[auth]] | Agent, Admin | nav bar | Better Auth SDK |
| [[view-dashboard]] | [[dashboard]] | Agent, Admin | `/` | `GET /api/tickets/stats`, `…/stats/daily-volume` |
| [[view-tickets-list]] | [[tickets]] | Agent, Admin | `/tickets` | `GET /api/tickets` |
| [[view-ticket-detail]] | [[tickets]] | Agent, Admin | `/tickets/:id` | `GET /api/tickets/:id` |
| [[update-ticket-metadata]] | [[tickets]] | Agent, Admin | detail sidebar | `PATCH /api/tickets/:id`, `GET /api/agents` |
| [[generate-ticket-summary]] | [[tickets]] | Agent, Admin | detail page | `POST /api/tickets/:id/replies/summarize` |
| [[view-replies-thread]] | [[tickets]] | Agent, Admin | detail page | `GET /api/tickets/:id/replies` |
| [[add-reply]] | [[tickets]] | Agent, Admin | reply form | `POST /api/tickets/:id/replies` |
| [[polish-reply]] | [[tickets]] | Agent, Admin | reply form | `POST /api/tickets/:id/replies/polish` |
| [[view-users-list]] | [[user-management]] | Admin | `/users` | `GET /api/users` |
| [[create-user]] | [[user-management]] | Admin | users dialog | `POST /api/users` |
| [[edit-user]] | [[user-management]] | Admin | users dialog | `PUT /api/users/:id` |
| [[delete-user]] | [[user-management]] | Admin | users dialog | `DELETE /api/users/:id` |
| [[toggle-theme]] | — (UI concern) | Agent, Admin | nav bar | none — localStorage only |

15 features across 4 domains, plus one cross-cutting UI preference.

## Current state worth recording

- **No clear-filters control exists** on the tickets list. The three filters are reset individually, each through its own control.
- **Filter, sort and pagination state is not in the URL**, so no filtered view can be linked or restored ([[06-frontend-map]]).
- **Three features are GPT-backed** — [[generate-ticket-summary]], [[polish-reply]], and the unattended auto-resolution that happens server-side before any of this UI is involved. The first two are triggered by a button with no client-side throttle.
- **Agent-visible statuses are restricted** to `open`, `resolved`, `closed` via `agentTicketStatuses`. `new` and `processing` are system-managed and never offered in the UI.

## Related

- [[03-domains/_index]] · [[06-frontend-map]] · [[11-testing]] · [[13-cross-cutting]]
