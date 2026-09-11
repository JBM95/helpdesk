---
tags: [domains, index]
---

# Domains

> Initially mapped by `explore-05-domain-mapper` (client scope only) on 2026-09-07.
> Extended with `server/`, `core/` and `e2e/` evidence by `explore-05-domain-mapper` on 2026-09-08.

Four domains, derived from the actual route tree (`client/src/App.tsx:14-24`), the API mounts (`server/src/index.ts:62-66`), the Prisma models (`server/prisma/schema.prisma`) and the Playwright specs (`e2e/tests/*.spec.ts`). Each is confirmed by three or more of those signals. Three require authentication; one is admin-only.

| Domain | Slug | Client routes | API prefix | Prisma models | E2E spec | Guard |
|--------|------|---------------|------------|---------------|----------|-------|
| [[auth]] | `auth` | `/login` | `/api/auth/*` (Better Auth), `/api/me` | `User`, `Session`, `Account`, `Verification` | `auth.spec.ts` | none (public) |
| [[tickets]] | `tickets` | `/tickets`, `/tickets/:id` | `/api/tickets`, `/api/tickets/:ticketId/replies`, `/api/agents`, `/api/webhooks/inbound-email` | `Ticket`, `Reply` | `tickets.spec.ts`, `ticket-detail.spec.ts`, `webhook-inbound-email.spec.ts` | `ProtectedRoute` |
| [[user-management]] | `user-management` | `/users` | `/api/users` | `User` | `users.spec.ts` | `ProtectedRoute` + `AdminRoute` |
| [[dashboard]] | `dashboard` | `/` | `/api/tickets/stats`, `/api/tickets/stats/daily-volume` | none (reads `Ticket`) | none | `ProtectedRoute` |

`auth` and `user-management` are the repo's declared T3 domains (`solvo.json` → `tiers.t3Domains`).

## What is not a domain

- **`core/`** (9 files, 139 LOC) — a shared Bun workspace package holding domain vocabulary: Zod schemas (`core/schemas/*.ts`) and TypeScript constants (`core/constants/*.ts`), imported by both `client` and `server` via `workspace:*`. Infrastructure, not a bounded context. It has no routes, no models and no independent behaviour — it is the contract layer the other sub-systems agree on.
- **`e2e/`** (8 files, 2,051 LOC) — the Playwright suite that exercises the four domains from the outside. The verification layer, not a domain.

Recorded explicitly rather than being given a domain slot to fill: both were named as un-explored sub-systems, and the honest answer for both is that they are cross-cutting layers.

The **Student Sender** persona from [[00-vision]] appears in no domain as a UI actor — they never sign in. Their tickets arrive by email webhook (`/api/webhooks/inbound-email`) and they receive replies by email. Every domain serves an internal user.

`tickets` is the largest domain and the only one under active change this horizon, per [[00-scope]].

## Dependency structure

Every domain depends on **auth** for session and role enforcement.

- **auth** — zero outbound dependencies. The foundation domain.
- **user-management** → auth (guards, and it mutates auth's `User` model), tickets (nulls `Ticket.assignedToId` on user deletion, `server/src/routes/users.ts:157-160`)
- **tickets** → auth (guards), user-management (`GET /api/agents` supplies the assignment dropdown)
- **dashboard** → tickets (two stats endpoints, read-only), auth (guards)

The auth ↔ user-management pair is worth reading twice: auth **owns** `User.role` and reads it to enforce access (`server/src/middleware/require-admin.ts:5`), while user-management is the domain that **mutates** the `User` row. Any change to how roles are written is a user-management change to an auth-owned field, and touches both T3 domains at once.

## Related

- [[04-features/_index|Feature catalog]] — the workflows these domains expose
- [[05-api-surface]] — every endpoint, its guard and its validation
- [[07-data-model]] — Prisma models, enums and relations
- [[06-frontend-map]] — route tree, component inventory, query keys (client scope only)
- [[00-vision]] — personas
- [[00-scope]] — sub-system priority bands
