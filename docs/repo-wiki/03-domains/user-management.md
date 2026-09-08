---
tags: [user-management, admin, t3-domain]
---

# Domain: User Management

> **Slug**: `user-management`
> **Status**: active
> **Tier**: T3 (declared in `solvo.json` → `tiers.t3Domains`)
> **Last refreshed**: 2026-09-08 by `explore-05-domain-mapper` (full-stack scope; was client-only before)

## Business purpose

Admins manage the agent roster — creating, editing and removing accounts. Because sign-up is disabled ([[00-vision]]), this is the only account-provisioning surface in the product.

## Code locations

**Backend**
- `server/src/routes/users.ts` (135 LOC) — user CRUD; every route guarded by `requireAuth` + `requireAdmin`

**Frontend**
- `client/src/pages/UsersPage.tsx` (105 LOC) — dialog state, delete mutation
- `client/src/pages/UsersTable.tsx` (120 LOC) — table and row actions
- `client/src/pages/UserForm.tsx` (120 LOC) — create and edit in one component, mode by prop
- Tests: `UsersPage.test.tsx` (273 LOC), `UserForm.test.tsx` (287 LOC)

**Core (shared vocabulary)**
- `core/schemas/users.ts` — `createUserSchema`, `updateUserSchema` (Zod)
- `core/constants/role.ts` — `Role.admin`, `Role.agent`

**Data ownership (Prisma)**
- None of its own. It operates on the `User` model, which [[auth]] owns (`server/prisma/schema.prisma:40-56`).

**Test coverage**
- Component: 2 of 3 files have direct tests; `UsersTable` is exercised indirectly through `UsersPage.test.tsx`
- E2E: `e2e/tests/users.spec.ts` (393 LOC) — CRUD flow and admin-only access

## Entry points

| Route | Component | Guard |
|-------|-----------|-------|
| `/users` | `UsersPage` | `ProtectedRoute` + `AdminRoute` |

Nav link at `Layout.tsx:56-61`, rendered for admins only.

| Method | Route | Handler | Auth | Purpose |
|--------|-------|---------|------|---------|
| GET | `/api/users` | `users.ts:13-20` | `requireAuth` + `requireAdmin` | List users; excludes soft-deleted and the AI agent |
| POST | `/api/users` | `users.ts:22-69` | `requireAuth` + `requireAdmin` | Create user plus credential account, transactionally |
| PUT | `/api/users/:id` | `users.ts:71-104` | `requireAuth` + `requireAdmin` | Update name, email, optional password — **not role** |
| DELETE | `/api/users/:id` | `users.ts:106-133` | `requireAuth` + `requireAdmin` | Soft-delete, unassign tickets, delete sessions |

Full detail with citations in [[05-api-surface]].

## API surface, as the client calls it

| Method | Path | Called from | Request body | Response |
|--------|------|-------------|--------------|----------|
| GET | `/api/users` | `UsersTable.tsx:39` | — | `{ users: { id, name, email, role, createdAt }[] }` |
| POST | `/api/users` | `UserForm.tsx:47` | `{ name, email, password }` | `{ user: { id, name, email, role, createdAt } }` |
| PUT | `/api/users/:id` | `UserForm.tsx:44` | `{ name, email, password? }` | `{ user: { id, name, email, role, createdAt } }` |
| DELETE | `/api/users/:id` | `UsersPage.tsx:47` | — | `{ message: "User deleted" }` |

All four invalidate the `["users"]` query key on success.

User ids are UUID strings, so the server's numeric `parseId` helper does not apply to these routes — and nothing replaces it, so `PUT`/`DELETE` do not validate the `id` param at all. See [[08-standards/observed]].

## Role handling — current state

**Creation** (`users.ts:45`):

```typescript
role: Role.agent,  // hardcoded; no choice offered
```

**Update** (`users.ts:85-88`):

```typescript
await prisma.user.update({
  where: { id: id },
  data: { name, email, updatedAt: new Date() },  // role is absent
});
```

**Validation contract** (`core/schemas/users.ts:3-7`, `:11-18`): neither `createUserSchema` nor `updateUserSchema` declares a `role` field.

**Role is therefore immutable after creation.** Every user created through the product is an `agent`. The one admin exists because `server/prisma/seed.ts` creates it; there is no second admin and no in-product way to make one. `role` *is* returned by `GET /api/users` and rendered as a badge in `UsersTable.tsx`, so the UI displays a value it cannot change.

## Delete protection

**Client** (`UsersTable.tsx:103`):

```typescript
{user.role !== Role.admin && (
  <Button variant="ghost" size="sm" ...>Delete</Button>
)}
```

A display condition only — it does not stop a direct `DELETE` call.

**Server** (`users.ts:115-118`):

```typescript
if (user.role === Role.admin) {
  res.status(403).json({ error: "Admin users cannot be deleted" });
  return;
}
```

Server enforcement is correct, and it reads the **currently stored** role at delete time — it is not a record of what the user once was. That distinction has no consequence today, because role is immutable. It would acquire one the moment role became writable: an admin could be demoted and then deleted, reaching an outcome the rule blocks in one step through two steps that are each individually legal. Recorded as an open question below rather than as a defect, because whether demote-then-delete is the intended way to retire an admin is a product decision, not a code fact.

**Side effects of deletion** (`users.ts:125-130`):

```typescript
await prisma.ticket.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } });
await prisma.session.deleteMany({ where: { userId: id } });
```

Ticket assignments are nulled — a dependency on [[tickets]] — and active sessions are removed, a dependency on [[auth]]. That second call is the repo's only existing precedent for invalidating sessions in response to a change in a user's standing.

## Dependencies

**Inbound** — who depends on this domain
- [[tickets]] — `GET /api/agents` (`server/src/routes/agents.ts`) reads the same `User` table, filtered to non-deleted non-AI users, to populate the assignment dropdown in `UpdateTicket.tsx`

**Outbound** — what this domain depends on
- [[auth]] — the `requireAuth` and `requireAdmin` guards; the `User` model it mutates; `hashPassword` from `better-auth/crypto`
- [[tickets]] — nulls `Ticket.assignedToId` on deletion (`users.ts:125-128`)
- `core/constants/role.ts`, `core/schemas/users.ts`
- Prisma client

## AI agent exclusion pattern

`users.ts:15` and `agents.ts:10` both exclude `AI_AGENT_ID` (`core/constants/ai-agent.ts:1`, the literal `"ai-agent"`):

```typescript
where: { deletedAt: null, id: { not: AI_AGENT_ID } },
```

The AI agent is a pseudo-user used as `assignedToId` while the AI works a ticket. It must not appear in the user list or the agent dropdown. The pattern is consistent across both routes. Note the AI pseudo-user's stored role is `agent` (`server/prisma/seed.ts:71`), so it is excluded by id, never by role.

## Relationship with the auth domain

- This domain **mutates** `User.name`, `User.email` and `User.deletedAt`
- [[auth]] **owns** the `User` model and **provides** the guards protecting this domain
- auth **reads** `User.role` at `require-admin.ts:5` to enforce access
- This domain **creates** `Account` rows transactionally alongside `User` (`users.ts:38-61`)

`User.role` sits exactly on the seam: auth-owned, auth-enforced, and written by nobody. Making it writable is a user-management change to an auth-owned field that feeds an authorization decision, which is why work here touches both T3 domains at once.

## Open questions

Recorded as questions because they are product decisions the code cannot settle:

- **Demote-then-delete.** With role writable, an admin could be demoted to `agent` and then deleted, reaching an outcome `users.ts:115-118` blocks directly. Is that the intended way to retire an admin, or should the path be closed?
- **Self-demotion.** Nothing would stop an admin demoting themselves, after which their next request fails `requireAdmin` and they lose access to the very screen they were using. Block it server-side, disable the control for the current user, or allow it?
- **Last-admin demotion.** There is one seeded admin and no spare (`server/prisma/seed.ts`). Demoting the last admin would leave the system with no one able to administer it, and — sign-up being disabled — no in-product way to recover. Should a floor be enforced?
- **Attribution.** No `modifiedBy` column exists anywhere ([[07-data-model]]), so a role change would leave no record of who made it. Acceptable, or a gap?
- The table lists admins as well as agents. Confirmed deliberate: the server returns every user except the AI agent.
- The relationship between `/api/users` here and `/api/agents` in [[tickets]] is resolved: same table, different projections and filters.

## Related

- [[auth]] — owns the `User` model and the guards; owns `User.role`
- [[tickets]] — consumes `/api/agents`; this domain nulls its assignments on delete
- [[05-api-surface]] — every route, guard and validation schema
- [[07-data-model]] — the `User` model, the `Role` enum, and the seeded roster
- [[11-testing]] — component and E2E coverage
- [[04-features/view-users-list]], [[04-features/create-user]], [[04-features/edit-user]], [[04-features/delete-user]]
- [[00-vision]] — account provisioning as a bounded non-goal
