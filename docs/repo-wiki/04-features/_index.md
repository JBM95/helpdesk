---
tags: [features, index]
---

# Features — Index

> Cataloged by `explore-09-feature-cataloger` via `/setup-05-explore client` on 2026-09-07.
> **Server traces added 2026-09-08** for the four [[user-management]] cards, during the `server`/`core`/`e2e` exploration pass. The remaining cards carry their original client-scope trace plus the API and test columns below; their per-card server traces are pending.
> **Traced:** UI entry point → components → API call → (where marked) server handler → guards → validation → Prisma → response → UI states.

## Persona note

[[00-vision]] names three personas. Only two appear here. The **Student Sender** has no UI and no feature: they never sign in, their tickets arrive through the inbound-email webhook, and they receive replies by email — possibly AI-authored and sent with no human approval. Every feature below serves an internal user.

## Inventory

| Feature | Domain | Persona | Entry | API | E2E spec | Component test | Server trace |
|---------|--------|---------|-------|-----|----------|----------------|--------------|
| [[sign-in]] | [[auth]] | Agent, Admin | `/login` | Better Auth SDK | `auth.spec.ts` | — | pending |
| [[sign-out]] | [[auth]] | Agent, Admin | nav bar | Better Auth SDK | `auth.spec.ts` | — | pending |
| [[view-dashboard]] | [[dashboard]] | Agent, Admin | `/` | `GET /api/tickets/stats`, `…/stats/daily-volume` | — | — | pending |
| [[view-tickets-list]] | [[tickets]] | Agent, Admin | `/tickets` | `GET /api/tickets` | `tickets.spec.ts` | `TicketsPage.test.tsx` | pending |
| [[view-ticket-detail]] | [[tickets]] | Agent, Admin | `/tickets/:id` | `GET /api/tickets/:id` | `ticket-detail.spec.ts` | `TicketDetailPage.test.tsx`, `TicketDetail.test.tsx` | pending |
| [[update-ticket-metadata]] | [[tickets]] | Agent, Admin | detail sidebar | `PATCH /api/tickets/:id`, `GET /api/agents` | `ticket-detail.spec.ts` | via `TicketDetailPage.test.tsx` | pending |
| [[generate-ticket-summary]] | [[tickets]] | Agent, Admin | detail page | `POST /api/tickets/:id/replies/summarize` | — | `TicketSummary.test.tsx` | pending |
| [[view-replies-thread]] | [[tickets]] | Agent, Admin | detail page | `GET /api/tickets/:id/replies` | `ticket-detail.spec.ts` | `ReplyThread.test.tsx` | pending |
| [[add-reply]] | [[tickets]] | Agent, Admin | reply form | `POST /api/tickets/:id/replies` | `ticket-detail.spec.ts` | `ReplyForm.test.tsx` | pending |
| [[polish-reply]] | [[tickets]] | Agent, Admin | reply form | `POST /api/tickets/:id/replies/polish` | `ticket-detail.spec.ts` | `ReplyForm.test.tsx` | pending |
| [[view-users-list]] | [[user-management]] | Admin | `/users` | `GET /api/users` | `users.spec.ts` | `UsersPage.test.tsx` | **done** |
| [[create-user]] | [[user-management]] | Admin | users dialog | `POST /api/users` | `users.spec.ts` | `UserForm.test.tsx` | **done** |
| [[edit-user]] | [[user-management]] | Admin | users dialog | `PUT /api/users/:id` | `users.spec.ts` | `UserForm.test.tsx` | **done** |
| [[delete-user]] | [[user-management]] | Admin | users dialog | `DELETE /api/users/:id` | `users.spec.ts` | `UsersPage.test.tsx` | **done** |
| [[toggle-theme]] | — (UI concern) | Agent, Admin | nav bar | none — `localStorage` only | — | — | n/a — no server call |

15 features across 4 domains, plus one cross-cutting UI preference. Full endpoint detail for every row is in [[05-api-surface]] regardless of whether the card itself has been extended.

## Current state worth recording

- **Role is not editable** through [[edit-user]] — absent from the validation schema, the route handler and the UI. Admins are seeded or promoted by direct database write. The `User.role` column and both enum members already exist, so nothing about this is a schema limitation ([[07-data-model]]).
- **No clear-filters control exists** on the tickets list; the three filters reset individually.
- **Filter, sort and pagination state is not in the URL**, so no filtered view can be linked or restored ([[06-frontend-map]]).
- **Three features are GPT-backed** — [[generate-ticket-summary]], [[polish-reply]], and the unattended auto-resolution that runs server-side before this UI is involved. The first two fire from a button with no throttle and no rate limit ([[13-cross-cutting]]).
- **Agent-visible statuses are restricted** to `open`, `resolved`, `closed`. `new` and `processing` are system-managed and never offered.

## Test coverage gaps

- **[[view-dashboard]]** — 204 LOC, no component test; E2E only checks that the redirect lands, never the content. The largest untested surface in the client.
- **[[sign-in]], [[sign-out]]** — no component tests; E2E only, which is defensible since both depend on real session cookies.
- **[[toggle-theme]]** — no test at any level, appropriately: a `localStorage`-backed CSS class toggle carries no business logic.
- **Authorization is tested only through the UI.** No test anywhere asserts a role or permission at the API level — see [[11-testing]], including the two tests commented out at `auth.spec.ts:384-397` awaiting a seeded non-admin user.

## Related

[[03-domains/_index]] · [[05-api-surface]] · [[06-frontend-map]] · [[07-data-model]] · [[10-integrations]] · [[11-testing]] · [[13-cross-cutting]]
