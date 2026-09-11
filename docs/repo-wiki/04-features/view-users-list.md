---
tags: [user-management, feature]
---

# Feature: View users list

> **Slug** `view-users-list` · **Domain** [[user-management]] · **Persona** Admin only
> Cataloged 2026-09-07 (client scope); server trace added 2026-09-08.

## What the user does

An admin sees every account — agents and admins alike — with name, email, role badge and created date, plus per-row edit and delete actions.

## Entry

`/users`, behind `ProtectedRoute` + `AdminRoute`. Nav link at `Layout.tsx:56-61`, rendered only for admins.

## Components

`pages/UsersPage.tsx` (container, dialog and delete state), `pages/UsersTable.tsx` (table and row actions).

## API

`GET /api/users` at `UsersTable.tsx:39`, key `["users"]`. Shape `{ users: [{ id, name, email, role, createdAt }] }`. Invalidated by [[create-user]], [[edit-user]] and [[delete-user]].

### Server trace

**Handler:** `server/src/routes/users.ts:13-20`
**Guards:** `requireAuth` + `requireAdmin`
**Query params:** none · **Validation:** none · **Writes:** none

```typescript
// users.ts:14-18
prisma.user.findMany({
  where: { deletedAt: null, id: { not: AI_AGENT_ID } },
  select: { id: true, name: true, email: true, role: true, createdAt: true },
  orderBy: { createdAt: "asc" },
})
```

Excludes soft-deleted users and the AI pseudo-user, ordered oldest first. **`role` is in the `select`,** so the list already carries the canonical stored role — the value rendered as a badge is the database's, not a client-side guess. That matters: it means the list needs no change to reflect a role that has been altered elsewhere; invalidating `["users"]` is sufficient.

**Response:** `200` with `{ users }`.
**Error paths:** 401 unauthenticated, 403 non-admin — both from the guards. Nothing else can fail.

## UI states

| State | Rendering |
|-------|-----------|
| Loading | 5 skeleton rows (`:60-79`) |
| Error | `ErrorAlert` "Failed to fetch users" (`:44-46`) |
| Empty | empty table body |
| Populated | rows with actions (`:80-115`) |

## Delete visibility is display, not access control

`UsersTable.tsx:103` renders the delete button only when `user.role !== Role.admin`. That is a **display condition** — it stops a click, not a request. The enforcement that matters is server-side at `routes/users.ts:147-150`, which 403s a `DELETE` aimed at an admin regardless of what the client rendered. See [[delete-user]].

## Tests

**Component:** `pages/UsersPage.test.tsx` (273 LOC) — loading, render, date formatting, fetch error, empty table, dialog behaviour, and specifically that the delete button appears on agent rows and not on admin rows (`:190`). Since GH-8 it is no longer the only test of role-conditional UI: `e2e/tests/users.spec.ts` asserts that same Delete button disappearing when a user is promoted and returning when they are demoted, which is the transition this static case cannot cover ([[11-testing]]). `UsersTable.tsx` has no direct test but is fully exercised here and is used nowhere else.

**E2E:** `e2e/tests/users.spec.ts` — asserts the table renders columns Name, Email, **Role**, Created, Actions.

## Related

[[user-management]] · [[create-user]] · [[edit-user]] · [[delete-user]] · [[05-api-surface]] · [[07-data-model]] · [[11-testing]]
