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
- `server/src/routes/users.ts` (167 LOC) — user CRUD; every route guarded by `requireAuth` + `requireAdmin`

**Frontend**
- `client/src/pages/UsersPage.tsx` (107 LOC) — dialog state, delete mutation
- `client/src/pages/UsersTable.tsx` (119 LOC) — table and row actions
- `client/src/pages/UserForm.tsx` (153 LOC) — create and edit in one component, mode by prop
- Tests: `UsersPage.test.tsx` (273 LOC), `UserForm.test.tsx` (421 LOC)

**Core (shared vocabulary)**
- `core/schemas/users.ts` — `createUserSchema`, `updateUserSchema` (Zod)
- `core/constants/role.ts` — `Role.admin`, `Role.agent`

**Data ownership (Prisma)**
- None of its own. It operates on the `User` model, which [[auth]] owns (`server/prisma/schema.prisma:40-56`).

**Test coverage**
- Component: 2 of 3 files have direct tests; `UsersTable` is exercised indirectly through `UsersPage.test.tsx`
- E2E: `e2e/tests/users.spec.ts` (911 LOC) — CRUD flow and admin-only access

## Entry points

| Route | Component | Guard |
|-------|-----------|-------|
| `/users` | `UsersPage` | `ProtectedRoute` + `AdminRoute` |

Nav link at `Layout.tsx:56-61`, rendered for admins only.

| Method | Route | Handler | Auth | Purpose |
|--------|-------|---------|------|---------|
| GET | `/api/users` | `users.ts:13-20` | `requireAuth` + `requireAdmin` | List users; excludes soft-deleted and the AI agent |
| POST | `/api/users` | `users.ts:22-69` | `requireAuth` + `requireAdmin` | Create user plus credential account, transactionally |
| PUT | `/api/users/:id` | `users.ts:71-136` | `requireAuth` + `requireAdmin` | Update name, email, optional password, **and role** |
| DELETE | `/api/users/:id` | `users.ts:138-165` | `requireAuth` + `requireAdmin` | Soft-delete, unassign tickets, delete sessions |

Full detail with citations in [[05-api-surface]].

## API surface, as the client calls it

| Method | Path | Called from | Request body | Response |
|--------|------|-------------|--------------|----------|
| GET | `/api/users` | `UsersTable.tsx:39` | — | `{ users: { id, name, email, role, createdAt }[] }` |
| POST | `/api/users` | `UserForm.tsx:64` | `{ name, email, password }` | `{ user: { id, name, email, role, createdAt } }` |
| PUT | `/api/users/:id` | `UserForm.tsx:59` | `{ name, email, password, role }` — all four required | `{ user: { id, name, email, role, createdAt } }` |
| DELETE | `/api/users/:id` | `UsersPage.tsx:49` | — | `{ message: "User deleted" }` |

All four invalidate the `["users"]` query key on success.

User ids are UUID strings, so the server's numeric `parseId` helper does not apply to these routes — and nothing replaces it, so `PUT`/`DELETE` do not validate the `id` param at all. See [[08-standards/observed]].

## Role handling — current state

> Changed by GH-8 (2026-09-08). Role was immutable after creation until then; the
> paragraphs below describe the state *after* that story.

**Creation** (`users.ts:45`): unchanged and deliberately so — still hardcoded, no choice offered.

```typescript
role: Role.agent,
```

`createUserSchema` declares no `role` field, and `UserForm` renders no role control in create mode. A `role` supplied to `POST /api/users` is silently stripped by Zod, so it cannot be smuggled in at creation.

**Update**: role is writable, admin-only, through the existing `PUT /api/users/:id`. The write is batched with the demotion session drop so the two can never diverge:

```typescript
const demoted = target.role === Role.admin && role === Role.agent;

await prisma.$transaction([
  prisma.user.update({
    where: { id: id },
    data: { name, email, role, updatedAt: new Date() },
  }),
  ...(demoted ? [prisma.session.deleteMany({ where: { userId: id } })] : []),
]);
```

**Validation contract** (`core/schemas/users.ts`): `updateUserSchema` declares `role: z.enum(Role, "Role must be either agent or admin")` — **required**, not optional. A `PUT` omitting `role` is a 400 and writes nothing. That asymmetry with `createUserSchema` is intentional: creation has no role to change, updates always carry one.

**Two rules guard the transition** (`users.ts`):

1. **No self role change** — 403 when the caller's own id is the target and the requested role differs from their stored one. This closes every sequential path to zero admins, though it is not a floor under concurrency — see Open questions below.
2. **Demotion drops sessions** — `admin → agent` batches `prisma.session.deleteMany({ where: { userId: id } })` into the **same `$transaction`** as the role write, so the demoted user's next request is a 401 rather than a 403 and the two can never disagree. Promotion deliberately leaves sessions intact, so a promoted user gains access on their existing session with no re-login.

The handler now loads the target user before writing, which it previously never did. A `PUT` against an unknown id is therefore a clean 404; before GH-8 it reached Prisma as a `P2025` and surfaced through Express 5's default handler as a **500**, despite this wiki and [[edit-user]] both claiming 404.

## Delete protection

**Client** (`UsersTable.tsx:103-112`):

```tsx
{user.role !== Role.admin && (
  <Button
    variant="ghost"
    size="icon"
    onClick={() => onDelete(user)}
    aria-label={`Delete ${user.name}`}
  >
    <Trash2 className="h-4 w-4" />
  </Button>
)}
```

It is an icon-only button — the accessible name comes from `aria-label`, which is what the tests
select on, not visible text.

A display condition only — it does not stop a direct `DELETE` call.

**Server** (`users.ts:147-150`):

```typescript
if (user.role === Role.admin) {
  res.status(403).json({ error: "Admin users cannot be deleted" });
  return;
}
```

Server enforcement is correct, and it reads the **currently stored** role at delete time — it is not a record of what the user once was. Since GH-8 made role writable, that distinction has a consequence: an admin can be demoted and then deleted, reaching in two individually-legal steps an outcome the rule blocks in one.

**Resolved as intended, not a defect.** AC7 of GH-8 requires that a user *whose current stored role is admin* stay protected, which is exactly what the rule does. It does not require the two-step path to be closed. `users.spec.ts` asserts both halves: the delete is refused while the user is an admin, and permitted once demoted.

**Side effects of deletion** (`users.ts:157-162`):

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
- [[tickets]] — nulls `Ticket.assignedToId` on deletion (`users.ts:157-160`)
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

**Answered by GH-8** (2026-09-08), kept here with their answers because the reasoning is the useful part:

- ~~**Demote-then-delete.**~~ **Permitted, deliberately.** AC7 protects the currently stored role; the two-step path is not a bypass of it. See Delete protection above.
- ~~**Self-demotion.**~~ **Blocked server-side** with a 403. Chosen over disabling the control for the current user, because a client-side condition is a display rule and this is an authorization rule.
- **Last-admin demotion.** **Partly answered.** The self-role-change guard closes every *sequential* path: demoting the final admin can only be done by that admin, and the guard refuses it. With two admins it still holds sequentially, because once A demotes B, B's next request reads its fresh role and fails `requireAdmin`.
  **It is not a true floor under concurrency.** Two admins demoting each other inside the same window both pass `requireAdmin` before either write commits, landing on zero admins with no in-product recovery (sign-up is disabled). Accepted rather than solved by GH-8: no AC asked for a floor, and enforcing one properly needs a serializable transaction or row lock around a post-write admin count, not another `if`. Recorded here so the next person does not mistake the guard for a guarantee.
- **Attribution.** Still open, and still a gap. No `modifiedBy` column exists anywhere ([[07-data-model]]), so a role change — now a real privilege transition — leaves no record of who made it. GH-8 put an audit-log subsystem out of scope explicitly, so this was accepted rather than solved.
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
