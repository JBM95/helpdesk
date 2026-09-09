---
tags: [data-model, persistence, prisma]
---

# Data Model — Helpdesk

> Mapped by `explore-08-data-model-mapper` via `/setup-05-explore server core` on 2026-09-08.
> **Scope:** `server/prisma/`, `core/schemas/`, `core/constants/` — the Prisma persistence layer plus the Zod validation contract that guards writes to it.
> **No queries were run.** Every claim is read from schema, migrations and source, with `file:line` citations.

## Persistence stack

- **ORM:** Prisma 7.3.0 (`prisma-client`)
- **Database:** PostgreSQL (no version pinned in recon)
- **Adapter:** `@prisma/adapter-pg` on the Bun runtime (`server/src/db.ts:1-7`)
- **Schema:** `server/prisma/schema.prisma`
- **Generated client:** `server/src/generated/prisma/` (gitignored build output)
- **External schema:** `pgboss`, auto-created by pg-boss 12.13.0 and not modelled in Prisma

## Connection strategy

`DATABASE_URL` in `.env` (template at `.env.example:8`), loaded via `dotenv/config` in `server/prisma/seed.ts:1` and implicitly by Bun.

```typescript
// server/src/db.ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
export default prisma;
```

A singleton client. No pooling, retry or circuit-breaker configuration beyond Prisma defaults. Secrets live in local `.env` files — no vault, no rotation — consistent with the maturity recorded in [[00-vision]].

## Entity catalog

6 Prisma models, 4 enums, grouped by [[03-domains/_index|domain]].

### [[auth]] domain

#### User — `server/prisma/schema.prisma:40-56`

| Field | Type | Nullable | Attributes | Notes |
|-------|------|----------|-----------|-------|
| `id` | `String` | no | `@id` | UUID, set in the application layer, not by the DB |
| `name` | `String` | no | — | — |
| `email` | `String` | no | `@unique` | — |
| `emailVerified` | `Boolean` | no | — | Better Auth contract field |
| `image` | `String` | yes | — | Better Auth contract field, unused |
| **`role`** | **`Role`** | **no** | **`@default(agent)`** | **Enum `admin \| agent`. Added by migration `20260210200027`, converted to an enum by `20260210200100`.** |
| `createdAt` | `DateTime` | no | — | Application-set, not `@default(now())` |
| `updatedAt` | `DateTime` | no | — | Application-set, not `@updatedAt` |
| **`deletedAt`** | **`DateTime`** | **yes** | — | **Soft-delete column. Added by migration `20260218190509`.** |

**Relations:** `sessions: Session[]`, `accounts: Account[]`, `assignedTickets: Ticket[]` (FK `assignedToId`), `replies: Reply[]` (optional `userId`).

`User` is the auth root. `Session` and `Account` are Better Auth's tables; `assignedTickets` and `replies` are domain FKs.

#### Session — `server/prisma/schema.prisma:58-70`

| Field | Type | Nullable | Attributes | Notes |
|-------|------|----------|-----------|-------|
| `id` | `String` | no | `@id` | — |
| `expiresAt` | `DateTime` | no | — | — |
| `token` | `String` | no | `@unique` | — |
| `createdAt` | `DateTime` | no | — | — |
| `updatedAt` | `DateTime` | no | — | — |
| `ipAddress` | `String` | yes | — | — |
| `userAgent` | `String` | yes | — | — |
| `userId` | `String` | no | FK | **The only user reference. No copy of `role` or any other user field.** |

**Relation:** `user: User` via `@relation(fields: [userId], references: [id], onDelete: Cascade)`.

**The `Session` table denormalizes no user fields.** It carries `userId` and nothing else about the user. There is therefore no column in which a stale `role` could persist across a role change.

That is a fact about *this schema*. Whether it follows that a role change takes effect for an already-authenticated session is a separate question, because a snapshot could in principle live in a signed cookie rather than a table. See [Does a role change reach an active session?](#does-a-role-change-reach-an-active-session) below, which is the honest version of that answer, and [[05-api-surface]] for the same question from the guard's side.

#### Account — `server/prisma/schema.prisma:72-89`

Better Auth's credential table. Stores the `password` hash (via `better-auth/crypto`) and OAuth token fields that are unused here. One row per user per provider; this project uses only `providerId: "credential"`.

#### Verification — `server/prisma/schema.prisma:123-132`

Better Auth's email-verification table. Live but unused, since `disableSignUp: true` (`server/src/lib/auth.ts:14`). Has no FKs in or out.

### [[tickets]] domain

#### Ticket — `server/prisma/schema.prisma:91-107`

| Field | Type | Nullable | Attributes | Notes |
|-------|------|----------|-----------|-------|
| `id` | `Int` | no | `@id @default(autoincrement())` | — |
| `subject` | `String` | no | — | 255-char cap enforced at the Zod layer only |
| `body` | `String` | no | — | 1,000-char cap at the Zod layer only |
| `bodyHtml` | `String` | yes | — | 2,000-char cap at the Zod layer only |
| `status` | `TicketStatus` | no | `@default(new)` | Default changed from `open` to `new` by migration `20260227155314` |
| `category` | `TicketCategory` | yes | — | Nullable — set by the AI classifier, never by the sender |
| `senderName` | `String` | no | — | — |
| `senderEmail` | `String` | no | — | Not an FK; senders are not modelled as entities |
| `assignedToId` | `String` | yes | FK | → `User.id`. Null when unassigned. |
| `createdAt` | `DateTime` | no | `@default(now())` | — |
| `updatedAt` | `DateTime` | no | `@updatedAt` | — |

**Relations:** `assignedTo: User` (optional, `onDelete: SET NULL`), `replies: Reply[]`.

Lifecycle `new` → `processing` → `open` or `resolved` → `closed`. The agent UI excludes `new` and `processing` (`server/src/routes/tickets.ts:72`).

#### Reply — `server/prisma/schema.prisma:109-121`

| Field | Type | Nullable | Attributes | Notes |
|-------|------|----------|-----------|-------|
| `id` | `Int` | no | `@id @default(autoincrement())` | — |
| `body` | `String` | no | — | — |
| `bodyHtml` | `String` | yes | — | Added by migration `20260225181704` |
| `senderType` | `SenderType` | no | — | `agent \| customer` |
| `ticketId` | `Int` | no | FK | — |
| `userId` | `String` | yes | FK | Null for customer replies and AI-authored replies |
| `createdAt` | `DateTime` | no | `@default(now())` | — |

**Relations:** `ticket: Ticket` (`onDelete: CASCADE`), `user: User` (optional, `onDelete: SET NULL`).

AI-authored replies carry `senderType: "agent"` with `userId: null` — they are deliberately not attributed to the AI pseudo-user row.

## Enums — `server/prisma/schema.prisma:16-38`

### Role

```prisma
enum Role {
  admin
  agent
}
```

Applied to `User.role` with `@default(agent)`. The core-package equivalent is `core/constants/role.ts:1-6` — an `as const` object plus a type alias, matching Prisma 1:1. Both members are already present in the database.

### TicketStatus

`new | processing | open | resolved | closed`, applied to `Ticket.status` with `@default(new)`. Core equivalent `core/constants/ticket-status.ts:1-24` exposes both the full list and `agentTicketStatuses` (the `open`/`resolved`/`closed` subset agents see). `new` and `processing` were added by migration `20260227155141`.

### TicketCategory

`general_question | technical_question | refund_request`, applied to the nullable `Ticket.category`. Core equivalent `core/constants/ticket-category.ts:1-13`.

### SenderType

`agent | customer`, applied to `Reply.senderType`. Core equivalent `core/constants/sender-type.ts:1-8`.

## Relationship summary

| Parent | Child | FK column | Cardinality | Delete rule | Notes |
|--------|-------|-----------|-------------|-------------|-------|
| User | Session | `userId` | 1:N | CASCADE | Better Auth standard |
| User | Account | `userId` | 1:N | CASCADE | Better Auth standard |
| User | Ticket | `assignedToId` | 1:N optional | SET NULL | Unassignment preserves the ticket |
| User | Reply | `userId` | 1:N optional | SET NULL | Customer and AI replies have null `userId` |
| Ticket | Reply | `ticketId` | 1:N | CASCADE | The thread dies with the ticket |

**No many-to-many relationships and no join tables.** Everything is 1:N or optional 1:N.

### Orphan potential

- **Soft-deleted users** keep their `Session` and `Account` rows, because cascade deletes only fire on a hard delete. `DELETE /api/users/:id` compensates for sessions (`server/src/routes/users.ts:162`) but **not** for `Account` rows.
- **AI-authored replies** have `userId: null` and no FK to the AI pseudo-user, so "all AI replies" cannot be found by a user join.

## Migration timeline

10 migrations under `server/prisma/migrations/`:

| # | Date | Name | Effect |
|---|------|------|--------|
| 1 | 2026-02-10 18:54 | `add_better_auth_tables` | Created `user`, `session`, `account`, `verification`. No `role` or `deletedAt` yet. |
| 2 | 2026-02-10 20:00 | `add_user_role` | Added `User.role` as `TEXT NOT NULL DEFAULT 'agent'`. |
| 3 | 2026-02-10 20:01 | `change_role_to_enum` | Created the `Role` enum, cast existing values, kept the default. |
| 4 | 2026-02-18 19:05 | `add_user_deleted_at` | Added nullable `User.deletedAt`. |
| 5 | 2026-02-19 17:04 | `add_ticket_model` | Created `ticket`, `TicketStatus` (`open\|resolved\|closed`), `TicketCategory`. Default status `open`. |
| 6 | 2026-02-24 16:44 | `add_reply_model` | Created `reply` and `SenderType`. |
| 7 | 2026-02-25 18:17 | `add_body_html_to_reply` | Added nullable `Reply.bodyHtml`. |
| 8 | 2026-02-27 15:51 | `add_new_and_processing_ticket_status` | Added `new` and `processing` to `TicketStatus`. |
| 9 | 2026-02-27 15:53 | `change_ticket_default_status_to_new` | Changed `Ticket.status` default to `new`. |
| 10 | 2026-03-02 00:00 | `add_get_ticket_stats_function` | Created the `get_ticket_stats(ai_agent_id TEXT)` function. |

**Does role mutation need a migration? No.** `User.role` has existed since migration 2 and has been a full `Role` enum with both `admin` and `agent` members since migration 3. Adding role mutation is an application-layer change only — validation contract, route handler, and UI.

## Raw SQL and stored procedures

### `get_ticket_stats`

`server/prisma/migrations/20260302000000_add_get_ticket_stats_function/migration.sql:1-32`

```sql
CREATE OR REPLACE FUNCTION get_ticket_stats(ai_agent_id TEXT)
RETURNS TABLE (
  "totalTickets"      BIGINT,
  "openTickets"       BIGINT,
  "resolvedByAI"      BIGINT,
  "aiResolutionRate"  DOUBLE PRECISION,
  "avgResolutionTime" DOUBLE PRECISION
)
```

Dashboard stats. `STABLE`, reads `ticket`, and excludes `new`/`processing` from every count (line 13). Called from `server/src/routes/tickets.ts:19-31` via `prisma.$queryRaw`.

**This is the only raw SQL in the codebase.** Grepping `$queryRaw` / `$executeRaw` found nothing else; the user-creation flow in `server/src/routes/users.ts:38-61` uses Prisma's transaction API, not raw SQL.

## Soft delete and audit conventions

**Column:** `User.deletedAt` (`DateTime?`).

**Read by:**
- `GET /api/users` — `where: { deletedAt: null, ... }` (`server/src/routes/users.ts:15`)
- `GET /api/agents` — same (`server/src/routes/agents.ts:10`)
- `requireAuth` — rejects a session whose user is soft-deleted (`server/src/middleware/require-auth.ts:15-17`)

**Written by:** `DELETE /api/users/:id` (`server/src/routes/users.ts:152-155`).

**Gaps:** `Account` rows are never cleaned for a soft-deleted user, and no job prunes soft-deleted rows, so a soft delete is permanent in practice.

**Audit columns:** `createdAt` on all 6 models; `updatedAt` on `User`, `Session`, `Account`, `Ticket`. There is **no** `createdBy`, `modifiedBy` or `rowVersion` anywhere — timestamps without actor attribution. Nothing in the schema records *who* changed a user, which is worth knowing before designing any change that should be attributable.

## Concurrency control

**None.** No optimistic-concurrency token, no row version, no explicit transaction isolation level. Concurrent writes to the same row are last-write-wins. The only uniqueness constraints are `User.email` and `Session.token`.

## Validation contract layer (Zod)

`core/schemas/` holds the request-body schemas. Writes reach Prisma only through these.

| Prisma model | Zod schema | Fields validated | Role coverage |
|--------------|------------|------------------|---------------|
| User | `createUserSchema` | `name`, `email`, `password` | **No `role` field.** Role is hardcoded to `Role.agent` at `server/src/routes/users.ts:45`. |
| User | `updateUserSchema` | `name`, `email`, `password` | **No `role` field.** Role is not writable through `PUT /api/users/:id`. |
| Ticket | `inboundEmailSchema` | `from`, `fromName`, `subject`, `body`, `bodyHtml` | — |
| Ticket | `updateTicketSchema` | `assignedToId`, `status`, `category` | — |
| Ticket | `ticketListQuerySchema` | `sortBy`, `sortOrder`, `status`, `category`, `search`, `page`, `pageSize` | — |
| Reply | `createReplySchema` | `body` | — |
| Reply | `polishReplySchema` | `body` | — |

**`User.role` is unreachable through the validation contract.** The column exists and is fully formed; no schema declares a `role` field, so no endpoint accepts a role value. Enabling role mutation means adding it to the contract, the handler and the UI — and no migration.

### Better Auth `additionalFields` — `server/src/lib/auth.ts:17-29`

```typescript
user: {
  additionalFields: {
    role:      { type: "string", required: true,  defaultValue: Role.agent, input: false },
    deletedAt: { type: "date",   required: false,                           input: false },
  },
}
```

`input: false` means Better Auth will not accept `role` or `deletedAt` on sign-up or profile update. Both are application-managed, mutated directly through Prisma rather than through Better Auth's own endpoints. That is deliberate, and it means Better Auth and the custom API split ownership of the `User` row.

### Does a role change reach an active session?

The question any role-mutation work turns on, kept here because the schema supplies two of the three facts.

**Evidence from this repo:**

1. `Session` denormalizes no user fields — only `userId` (`schema.prisma:58-70`). No table column can hold a stale role.
2. `betterAuth()` configures **no `session` block at all** (`server/src/lib/auth.ts:6-31`), so `session.cookieCache` is left at its default, which is off. No signed cookie snapshot is being served.
3. `requireAuth` calls `auth.api.getSession()` on every request and assigns `req.user = session.user` (`server/src/middleware/require-auth.ts:6-20`).

Together these say the role is resolved per request from the `User` row, so a demotion or promotion would take effect on the very next request.

**This is inference, not verified behaviour.** Facts 1–3 are read from this repo, but the step from them to "a database read happens" depends on documented Better Auth behaviour that this codebase does not itself demonstrate. A second, independent line points the same way — Better Auth does not cookie-cache custom `additionalFields`, and `role` is one — but that is also library behaviour rather than local evidence.

Settle it empirically before relying on it for an authorization decision: hold a live admin session, demote that user, then call an admin-only `/api/users` route on the same session and observe whether it is refused. Do not treat this section as the answer.

## Seeded data — `server/prisma/seed.ts:11-86`

| ID | Name | Email | Role | Password | Notes |
|----|------|-------|------|----------|-------|
| env-driven UUID | Admin | `SEED_ADMIN_EMAIL` | `admin` | `SEED_ADMIN_PASSWORD`, hashed | Created only if the email does not already exist |
| `ai-agent` | AI | `ai@helpdesk.local` | `agent` | none, no `Account` row | The AI actor; never signs in |

`AI_AGENT_ID` is the hardcoded constant `"ai-agent"` (`core/constants/ai-agent.ts:1`).

**There is exactly one seeded admin.** Any test or feature that can demote an admin should account for the roster being one admin deep by default — the seed does not create a spare.

## The `pgboss` schema (external)

pg-boss 12.13.0 creates its own `pgboss` schema on first `boss.start()`. It is **not modelled in Prisma** and is invisible to `prisma migrate`. Instantiated from `DATABASE_URL` with no custom schema name (`server/src/lib/queue.ts:7-9`). Its tables (`job`, `schedule`, `version`) are inferred from pg-boss's own documentation, not inspected here.

Three queues are registered (`server/src/lib/queue.ts:21-23`): `classify-ticket`, `auto-resolve-ticket`, `send-email`. No Prisma transaction spans both a Prisma write and a pg-boss send — they are separate consistency boundaries.

## Inconsistencies and gaps

| Gap | Evidence | Impact |
|-----|----------|--------|
| ~~`User.role` has no Zod schema~~ — **closed by GH-8 (2026-09-08)** | `updateUserSchema` now declares `role: z.enum(Role, …)`, required (`core/schemas/users.ts:12-20`) | The column is writable through `PUT /api/users/:id`, admin-only. `createUserSchema` still declares no `role`, deliberately — creation stays agent-only. |
| `Ticket.subject` / `body` / `bodyHtml` length caps exist only in Zod | `core/schemas/tickets.ts:10` vs unbounded `String` in Prisma | The API is protected; direct DB writes, seeds and migrations are not. |
| No actor attribution on any model | No `createdBy` / `modifiedBy` columns anywhere | Nothing records who changed a user's role. |
| AI pseudo-user has no `Account` row | `server/prisma/seed.ts:59-77` | Cannot be excluded by an "has credentials" query; every exclusion is by hardcoded id. |
| Soft-deleted users keep `Account` rows | `server/src/routes/users.ts:152-162` | Credential rows outlive the user they belong to. |

## Counts

| Metric | Count | Notes |
|--------|-------|-------|
| Prisma models | 6 | `User`, `Session`, `Account`, `Verification`, `Ticket`, `Reply` |
| Enums | 4 | `Role`, `TicketStatus`, `TicketCategory`, `SenderType` |
| Prisma-managed tables | 6 | 1:1 with models |
| External tables | ~3 | pg-boss `pgboss` schema, inferred |
| Stored functions | 1 | `get_ticket_stats(ai_agent_id)` |
| Raw SQL call sites | 1 | `server/src/routes/tickets.ts:20-22` |
| Relationships | 5 FKs, 2 of them optional | No many-to-many |
| Models with no FK either way | 1 | `Verification` |

---

## Related

- [[05-api-surface]] — every route, its guard, and the same active-session question from the guard's side
- [[auth]] — owns `User`, `Session`, `Account` and the guards
- [[user-management]] — mutates `User` through `/api/users`
- [[tickets]] — owns `Ticket` and `Reply`
- [[11-testing]] — coverage over this layer
- [[00-vision]] — personas and maturity
- [[00-scope]] — sub-system priority bands
- [[recon]] — stack fingerprint, Prisma version, sub-system sizes
