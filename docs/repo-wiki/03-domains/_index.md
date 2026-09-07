---
tags: [domains, index]
---

# Client Domains

> Mapped by `explore-05-domain-mapper` via `/setup-05-explore client` on 2026-09-07.
> **Scope caveat:** these are *client* bounded contexts. `server/`, `core/` internals and `e2e/` were deliberately not explored — see [[00-scope]]. API endpoints are recorded as the client calls them; no server implementation was read.

Four domains, derived from the actual route tree (`client/src/App.tsx:14-24`) and page/component organisation rather than an idealised model. Three require authentication; one is admin-only.

| Domain | Slug | Routes | Guard | Personas |
|--------|------|--------|-------|----------|
| [[auth]] | `auth` | `/login` | none (public) | Support Agent, Admin |
| [[tickets]] | `tickets` | `/tickets`, `/tickets/:id` | `ProtectedRoute` | Support Agent, Admin |
| [[user-management]] | `user-management` | `/users` | `ProtectedRoute` + `AdminRoute` | Admin only |
| [[dashboard]] | `dashboard` | `/` | `ProtectedRoute` | Support Agent, Admin |

The **Student Sender** persona from [[00-vision]] appears in no domain as a UI actor — they never log in. Their tickets arrive by email webhook and they receive replies by email. Every domain below serves an internal user.

`tickets` is the largest and the only domain under change this horizon.

## Related

- [[04-features/_index|Feature catalog]] — the workflows these domains expose
- [[06-frontend-map]] — route tree, component inventory, query keys
- [[00-vision]] — personas
- [[00-scope]] — `client` is the Critical band this horizon
