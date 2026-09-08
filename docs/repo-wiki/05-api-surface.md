---
tags: [api, server, endpoints]
---

# API Surface — Helpdesk Server

> Mapped by `explore-06-api-surface-mapper` via `/setup-05-explore server` on 2026-09-08.
> **Scope:** `server/` sub-system only (23 files, 2,526 LOC including seed fixtures).
> **Stack:** Express 5.2.1 + TypeScript on Bun runtime, Better Auth 1.4.18, Prisma 7.3.0, pg-boss 12.13.0.
> **No requests were made.** Every claim below is read from source, with `file:line` citations.

## Pipeline and middleware

All requests flow through this stack, in order, defined in `server/src/index.ts`:

```
1. helmet() — security headers (index.ts:25)
2. cors() — configured via TRUSTED_ORIGINS env var (index.ts:26-31)
3. authLimiter — 20 req/15min on /api/auth/* only, skipped outside production (index.ts:35-42, 47)
4. Better Auth handler — mounted at /api/auth/{*any} BEFORE express.json() (index.ts:47-49)
   ^ Order is load-bearing: Better Auth parses its own request bodies
5. express.json() — body parser for all other routes (index.ts:51)
6. Route-specific guards: requireAuth, requireAuth + requireAdmin, requireWebhookSecret
7. Sentry.setupExpressErrorHandler() — error capture (index.ts:68)
```

**There is no global auth enforcement.** Each route explicitly chains its own guard. Routes without a guard are public — only `/api/health` and Better Auth's own paths.

### Guard middleware

| Guard | File | Behaviour |
|-------|------|-----------|
| `requireAuth` | `middleware/require-auth.ts:5-23` | Calls `auth.api.getSession()` **per request**, rejects if session is null or the user has `deletedAt` set. Populates `req.user` and `req.session`. 401 on failure. |
| `requireAdmin` | `middleware/require-admin.ts:4-10` | Checks `req.user.role === Role.admin`. Must chain AFTER `requireAuth`. 403 on failure. |
| `requireWebhookSecret` | `middleware/require-webhook-secret.ts:3-19` | Validates `WEBHOOK_SECRET` from the `x-webhook-secret` header or a `secret` query param. 500 if `WEBHOOK_SECRET` is unset, 401 on mismatch. |

### Background job queues

pg-boss workers registered at boot (`lib/queue.ts:18-26`), before `app.listen()`:

| Queue | Handler | Enqueued by | Retry | Purpose |
|-------|---------|-------------|-------|---------|
| `classify-ticket` | `lib/classify-ticket.ts` | Webhook on new ticket (`webhooks.ts:83`) | 3 attempts, 30s exponential backoff | GPT classification of inbound ticket |
| `auto-resolve-ticket` | `lib/auto-resolve-ticket.ts` | Webhook on new ticket (`webhooks.ts:87`) | same | Attempt GPT resolution; `ESCALATE` → `open` |
| `send-email` | `lib/send-email.ts` | Reply creation (`replies.ts:61`), auto-resolve job | same | SendGrid outbound email |

**Graceful shutdown:** `SIGTERM`/`SIGINT` handlers stop the queue before exit (`index.ts:92-100`).

## Auth policy reference

**Session model:** Better Auth with the Prisma adapter, database-backed sessions (`lib/auth.ts:6-31`).

**User fields:**
- `role` — `"admin"` or `"agent"`, default `"agent"`, `input: false` so it cannot be set through auth forms (`auth.ts:17-23`)
- `deletedAt` — soft-delete timestamp, `input: false` (`auth.ts:24-28`)

**Sign-up disabled:** `emailAndPassword.disableSignUp: true` (`auth.ts:14`). New users are created only by an admin at `POST /api/users`.

**Rate limiting:** 20 requests per 15 minutes on `/api/auth/*`, enforced only when `NODE_ENV=production` (`index.ts:33-42`).

**No `session` block is configured** in `betterAuth()` (`auth.ts:6-31`) — see [Authorization refresh behaviour](#authorization-refresh-behaviour) below, which turns on exactly that absence.

### Auth levels

| Level | Persona | Guard chain | Routes |
|-------|---------|-------------|--------|
| **Public** | Anyone | none | `/api/health`, `/api/auth/*` (Better Auth) |
| **Authenticated** | Agent, Admin | `requireAuth` | `/api/me`, `/api/tickets`, `/api/tickets/:id`, `/api/tickets/:ticketId/replies`, `/api/agents` |
| **Admin-only** | Admin | `requireAuth` + `requireAdmin` | `/api/users` (all verbs) |
| **Webhook** | SendGrid | `requireWebhookSecret` | `/api/webhooks/inbound-email` |

## Versioning strategy

**None.** No `/v1/` prefix, no header-based versioning. All routes are mounted directly under `/api/`.

## Role mutation: current state and the authorization-refresh question

Recorded here because [[user-management]] and [[auth]] split ownership of `User.role`, and the split is where role-change work lands.

**Current state:**
- `POST /api/users` hardcodes `role: Role.agent` (`routes/users.ts:45`) — new users are always agents.
- `PUT /api/users/:id` accepts only `name`, `email`, `password` (`routes/users.ts:71-104`, validated by `updateUserSchema` at `core/schemas/users.ts:11-18`) — **no `role` field in the schema, not extracted from the request, not passed to Prisma.**
- **There is no way to change a user's role through the API today.** Admins are seeded (`server/prisma/seed.ts`) or promoted by direct database write.

### Authorization refresh behaviour

The question that role-change work turns on: does a role change take effect for a session that is **already authenticated**, or does that session keep its old role until it expires?

`requireAuth` (`middleware/require-auth.ts:5-23`) calls `auth.api.getSession({ headers })` on **every** request (line 6) and then assigns `req.user = session.user` (line 20). So the answer depends on whether `getSession()` reads the user row or replays a cached snapshot.

**Three code facts settle it as a fresh read:**

1. **No `session` block is configured at all** in `betterAuth()` (`lib/auth.ts:6-31`). Better Auth's `session.cookieCache` is opt-in and off by default, so no signed session snapshot is being served from the cookie.
2. **The `Session` table denormalizes nothing.** It carries `userId` as a foreign key and no copy of `role` (`prisma/schema.prisma:58-70`, and see [[07-data-model]]). There is no stale column for a snapshot to live in.
3. **`getSession()` runs per request**, not once per session (`require-auth.ts:6`), and returns `session.user` populated through the Prisma adapter.

A fourth, independent reason points the same way: Better Auth does not cookie-cache custom `additionalFields`, and `role` is declared as one (`auth.ts:17-23`). So even if a cookie cache were switched on later, `role` would still be re-fetched.

**Confidence and its limit.** Facts 1–3 are read directly from this repo. The step from "no cookie cache configured" to "therefore a DB read happens" rests on documented Better Auth behaviour, which is **library behaviour this codebase does not itself prove**. Treat the conclusion as well-grounded inference, not as verified behaviour, and settle it empirically before relying on it for an authorization decision: hold a live session as an admin, demote that user, then call an admin-only `/api/users` route on the existing session and observe whether it is refused.

**If fresh (expected):** adding role mutation is sufficient on its own — the next request reads the current role.
**If stale (contradicted by the three facts above, but cheap to rule out):** role mutation alone would leave a demoted admin privileged until session expiry, and would additionally need session invalidation for the affected user — the precedent already exists at `routes/users.ts:130`.

## Master endpoint table

18 endpoints across 5 route modules plus 2 inline handlers, plus Better Auth's catch-all.

| Method | Route | Controller | Guard | Deprecated? | Notes |
|--------|-------|------------|-------|-------------|-------|
| `GET` | `/api/health` | `index.ts:53-55` | none | no | Liveness check |
| `GET` | `/api/me` | `index.ts:57-60` | `requireAuth` | no | Current user profile |
| `*` | `/api/auth/{*any}` | Better Auth | `authLimiter` | no | Sign-in, sign-out, session management (library-owned) |
| `GET` | `/api/users` | [Users router](#users-router) | `requireAuth` + `requireAdmin` | no | List users (excludes AI agent and soft-deleted) |
| `POST` | `/api/users` | [Users router](#users-router) | `requireAuth` + `requireAdmin` | no | Create user — hardcodes `role: agent` |
| `PUT` | `/api/users/:id` | [Users router](#users-router) | `requireAuth` + `requireAdmin` | no | Update name, email, password — **no role change** |
| `DELETE` | `/api/users/:id` | [Users router](#users-router) | `requireAuth` + `requireAdmin` | no | Soft-delete, unassign tickets, delete sessions |
| `GET` | `/api/tickets/stats` | [Tickets router](#tickets-router) | `requireAuth` | no | Aggregate stats via stored function |
| `GET` | `/api/tickets/stats/daily-volume` | [Tickets router](#tickets-router) | `requireAuth` | no | Rolling 30-day ticket counts |
| `GET` | `/api/tickets` | [Tickets router](#tickets-router) | `requireAuth` | no | List tickets (paginated, filtered, sorted) |
| `GET` | `/api/tickets/:id` | [Tickets router](#tickets-router) | `requireAuth` | no | Single ticket detail |
| `PATCH` | `/api/tickets/:id` | [Tickets router](#tickets-router) | `requireAuth` | no | Update assignee, status, category |
| `GET` | `/api/agents` | [Agents router](#agents-router) | `requireAuth` | no | Assignable agents (excludes AI agent, soft-deleted) |
| `GET` | `/api/tickets/:ticketId/replies` | [Replies router](#replies-router) | `requireAuth` | no | Reply thread for a ticket |
| `POST` | `/api/tickets/:ticketId/replies` | [Replies router](#replies-router) | `requireAuth` | no | Create reply, enqueue outbound email |
| `POST` | `/api/tickets/:ticketId/replies/summarize` | [Replies router](#replies-router) | `requireAuth` | no | GPT ticket summary (not cached) |
| `POST` | `/api/tickets/:ticketId/replies/polish` | [Replies router](#replies-router) | `requireAuth` | no | GPT-polished reply draft (not cached) |
| `POST` | `/api/webhooks/inbound-email` | [Webhooks router](#webhooks-router) | `requireWebhookSecret` | no | SendGrid inbound email → ticket or reply |

**No deprecated endpoints.** No `Obsolete` markers, no "legacy" comments.

**All routes return JSON.** One route (`POST /api/webhooks/inbound-email`) accepts `multipart/form-data` in SendGrid's inbound-parse format; every other route expects `application/json`.

## Security review notes

| Finding | Location | Assessment |
|---------|----------|------------|
| Every business endpoint requires `requireAuth` or `requireWebhookSecret`. Only `/api/health` and Better Auth's own routes are public. | — | Good |
| Admin-deletion protection: admins cannot be deleted. | `routes/users.ts:115-118` | Good |
| Session invalidation on user deletion: all sessions removed when a user is soft-deleted. | `routes/users.ts:130` | Good |
| Soft-delete enforced in the auth guard: users with `deletedAt` are rejected even holding a valid session. | `middleware/require-auth.ts:15-18` | Good |
| Role immutability: no way to change a user's role, so promotion and demotion are impossible through the product. | `routes/users.ts:71-104` | Feature gap |
| Admin-deletion protection is composable-around **once role mutation exists**: demote an admin to agent, then delete them. Nothing today prevents the two-step path because step one is currently impossible. | `routes/users.ts:115-118` | Design decision required before role mutation ships |
| No output encoding for email bodies. Prisma is parameterized so there is no SQL-injection vector, but HTML is not escaped server-side. | All routes | Acceptable at current maturity per [[00-vision]] |
| GPT endpoints unbounded: `/summarize` and `/polish` have no rate limit or cost cap beyond the auth limiter, which does not cover them. | `routes/replies.ts:70, 112` | Known, accepted per [[00-scope]] |
| `PUT`/`DELETE /api/users/:id` do not validate the `id` route param — user ids are UUID strings, so the numeric `parseId` helper does not apply and nothing replaces it. | `routes/users.ts:71, 106` | Minor; a bad id falls through to a 404 |

## Counts

| Metric | Count |
|--------|-------|
| Total endpoints (excluding Better Auth's own) | 18 |
| HTTP verbs | GET 10, POST 6, PATCH 1, PUT 1, DELETE 1 |
| Deprecated endpoints | 0 |
| Endpoints with no guard | 2 (`/api/health`, Better Auth routes — both intentional) |
| Endpoints returning untyped shapes | 0 (all have an explicit Prisma `select` or a Zod-validated shape) |
| GPT-backed endpoints | 2, plus 2 background jobs |

---

## Router detail

### Users router

**File:** `server/src/routes/users.ts` · **Mount:** `/api/users` (`index.ts:62`)
**Guards:** every route requires `requireAuth` + `requireAdmin`

#### `GET /api/users`

**Handler:** `users.ts:13-20` · **Auth:** admin-only · **Query params:** none

```typescript
{ users: Array<{ id: string; name: string; email: string; role: "admin" | "agent"; createdAt: Date }> }
```

- Excludes the AI agent (`id !== AI_AGENT_ID`) and soft-deleted users (`deletedAt === null`) — `users.ts:15`
- Ordered by `createdAt` ascending — `users.ts:17`
- `role` **is** in the response `select`, so the list already carries the canonical role.

#### `POST /api/users`

**Handler:** `users.ts:22-69` · **Auth:** admin-only
**Request DTO:** `createUserSchema` (`core/schemas/users.ts:3-7`) — `{ name: min 3, email, password: min 8 }`
**Response:** the created user, 201

**Prisma writes**, wrapped in a transaction (`users.ts:38-61`):
1. `User.create()` — `users.ts:39-49` — **role hardcoded to `Role.agent`** (line 45)
2. `Account.create()` — `users.ts:50-60` — credential provider, hashed password

**Validation:** email uniqueness checked before the transaction — `users.ts:28-32`, 409 if taken.

New users are always agents. No `role` parameter is accepted.

#### `PUT /api/users/:id`

**Handler:** `users.ts:71-104` · **Auth:** admin-only
**Route param:** `id` — a UUID string, not validated (`parseId` is numeric-only and does not apply)
**Request DTO:** `updateUserSchema` (`core/schemas/users.ts:11-18`) — `{ name: min 3, email, password: "" | min 8 }`

Fields accepted and updated, verbatim:

```typescript
// users.ts:77
const { name, email, password } = data;

// users.ts:85-88
await prisma.user.update({
  where: { id: id },
  data: { name, email, updatedAt: new Date() },
});
```

`role` is absent from the schema, from the destructure, and from the Prisma `data`. **This is the endpoint role mutation would extend.**

**Validation:** email uniqueness against other users — `users.ts:79-83`, 409 if taken. Password optional; empty string means no change — `users.ts:90-96`.

#### `DELETE /api/users/:id`

**Handler:** `users.ts:106-133` · **Auth:** admin-only · **Response:** `{ message: "User deleted" }`

**Admin-deletion protection**, verbatim:

```typescript
// users.ts:115-118
if (user.role === Role.admin) {
  res.status(403).json({ error: "Admin users cannot be deleted" });
  return;
}
```

Note the rule reads the **currently stored** role at delete time. It is not a record of what the user once was.

**Session deletion**, verbatim:

```typescript
// users.ts:130
await prisma.session.deleteMany({ where: { userId: id } });
```

**Writes:** soft-delete via `deletedAt` (`users.ts:120-123`), unassign all tickets (`:125-128`), delete all sessions (`:130`).
**Validation:** user existence — `users.ts:109-113`, 404 if absent.

---

### Tickets router

**File:** `server/src/routes/tickets.ts` · **Mount:** `/api/tickets` (`index.ts:63`)
**Guards:** every route requires `requireAuth` — agents and admins alike

#### `GET /api/tickets/stats`

**Handler:** `tickets.ts:20-32` · Calls the stored function `get_ticket_stats(AI_AGENT_ID)` (`:23`), converting `bigint` to `number` for JSON (`:26-30`).

```typescript
{ totalTickets: number; openTickets: number; resolvedByAI: number; aiResolutionRate: number; avgResolutionTime: number }
```

#### `GET /api/tickets/stats/daily-volume`

**Handler:** `tickets.ts:34-61` · Rolling 30 days (29 days ago plus today, `:35-37`), missing days filled with 0 (`:52-58`).

```typescript
{ data: Array<{ date: string; tickets: number }> }
```

#### `GET /api/tickets`

**Handler:** `tickets.ts:63-107` · **Query params:** `ticketListQuerySchema` (`core/schemas/tickets.ts:31-39`)

- `sortBy` (default `createdAt`), `sortOrder` (default `desc`), `status`, `category`, `search`, `page` (default 1), `pageSize` (default 10, max 100)
- **System-managed statuses hidden by default:** with no `status` filter, the where clause defaults to `{ in: ["open", "resolved", "closed"] }` — `tickets.ts:72`. Agents never see `new` or `processing`.
- Search is a case-insensitive `contains` across subject, senderName and senderEmail, OR-ed — `tickets.ts:79-85`

#### `GET /api/tickets/:id`

**Handler:** `tickets.ts:109-129` · `id` validated via `parseId` (`:110`), 400 if not a positive integer (`:111-114`), 404 if absent (`:123-126`). Includes `assignedTo: { id, name }`.

#### `PATCH /api/tickets/:id`

**Handler:** `tickets.ts:131-168` · **Request DTO:** `updateTicketSchema` (`core/schemas/tickets.ts:25-29`) — `assignedToId`, `status`, `category`, all optional.

Partial update — only present fields are written (`:159-162`). If `assignedToId` is given the user must exist and not be soft-deleted (`:141-149`, 400 otherwise). Status is restricted by schema to the agent-visible values, so `new` and `processing` cannot be set.

---

### Agents router

**File:** `server/src/routes/agents.ts` · **Mount:** `/api/agents` (`index.ts:64`) · **Guard:** `requireAuth`

#### `GET /api/agents`

**Handler:** `agents.ts:8-16` · Returns `{ agents: Array<{ id: string; name: string }> }`.

Excludes the AI agent and soft-deleted users (`:10`), ordered by name (`:12`). Populates the ticket-assignment dropdown. **Note it does not return `role`** — it is a name-and-id projection of the same `User` table that `/api/users` reads.

---

### Replies router

**File:** `server/src/routes/replies.ts` · **Mount:** `/api/tickets/:ticketId/replies` (`index.ts:65`)
**Guard:** `requireAuth` · **Router config:** `mergeParams: true` to inherit `:ticketId` (`replies.ts:11`)

#### `GET /api/tickets/:ticketId/replies`

**Handler:** `replies.ts:13-33` · Ordered ascending by `createdAt` (`:28`), includes the authoring user (`:29`). 400 on a bad id (`:15-18`), 404 if the ticket is absent (`:21-24`).

#### `POST /api/tickets/:ticketId/replies`

**Handler:** `replies.ts:35-68` · **Request DTO:** `createReplySchema` — `{ body: min 1 after trim }`

Creates the reply as `senderType: "agent"` with `userId: req.user.id` (`:51-58`), then enqueues a `send-email` job to `ticket.senderEmail` with subject `"Re: {subject}"` (`:61-65`). Email delivery is asynchronous with no guarantee surfaced to the caller.

#### `POST /api/tickets/:ticketId/replies/summarize`

**Handler:** `replies.ts:70-110` · No request body. Returns `{ summary: string }`.

Model `gpt-5-nano` (`:98`), system prompt asks for 2–4 sentences (`:99-102`), user prompt carries subject, body and the reply thread (`:103-106`). Not cached — every call is a fresh GPT request.

#### `POST /api/tickets/:ticketId/replies/polish`

**Handler:** `replies.ts:112-144` · **Request DTO:** `polishReplySchema` — `{ body: min 1, max 1000 }`. Returns `{ body: string }`.

Model `gpt-5-nano` (`:132`). System prompt preserves meaning, addresses the customer by first name and signs off with the agent name plus a hardcoded link (`:133-139`). Customer first name from `senderName`'s first token (`:129`), agent name from `req.user.name` (`:128`). Not cached.

---

### Webhooks router

**File:** `server/src/routes/webhooks.ts` · **Mount:** `/api/webhooks` (`index.ts:66`) · **Guard:** `requireWebhookSecret`

#### `POST /api/webhooks/inbound-email`

**Handler:** `webhooks.ts:28-90` · **Content-Type:** `multipart/form-data`, parsed by SendGrid's `inbound-mail-parser` (`:29-34`)
**Request DTO:** `inboundEmailSchema` (`core/schemas/tickets.ts:5-11`) applied to the parsed fields
**Response:** 200 with the existing ticket when a reply is appended (`:66`), 201 with the new ticket otherwise (`:81`)

Flow:
1. Parse the SendGrid multipart body (`:29-34`), extracting email and display name from `Name <email>` form (`:34`, helper `:18-24`)
2. Strip `Re:` / `Fwd:` prefixes from the subject (`:45`, helper `:14-16`)
3. Look for an existing `open`/`new`/`processing` ticket from the same sender with a case-insensitive subject match (`:48-54`)
   - Found → create a `Reply` with `senderType: "customer"`, `userId: null` (`:57-65`), return 200
   - Not found → create a `Ticket` with default `status: "new"` and `assignedToId: AI_AGENT_ID` (`:70-79`), return 201
4. Enqueue `classify-ticket` (`:83-85`) and `auto-resolve-ticket` (`:87-89`) — both fire-and-forget: errors are logged and never fail the response

**Not authenticated via Better Auth.** It uses the shared webhook secret, so there is no `req.user` in this handler.

---

## Related

- [[07-data-model]] — Prisma schema, enums, relations, and the `Session` table this doc's refresh argument depends on
- [[auth]] — the domain that owns the guards and the `User` model
- [[user-management]] — the domain that mutates `User` through this router
- [[tickets]] — the domain behind the ticket, reply, agent and webhook routes
- [[13-cross-cutting]] — client-side session handling (client scope only)
- [[11-testing]] — what is and is not covered
- [[00-vision]] — personas and maturity
- [[00-scope]] — sub-system priority bands
- [[recon]] — stack fingerprint and LOC counts
