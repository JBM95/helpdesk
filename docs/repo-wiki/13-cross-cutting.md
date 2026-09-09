---
tags: [cross-cutting, patterns, client, server, core]
---

# Cross-Cutting Concerns

> Mapped by `explore-11-cross-cutting-mapper` via `/setup-05-explore server core` on 2026-09-08, extending the client-only version of 2026-09-07.
> **Scope: full-stack** — client, server and core. Per-concern scope markers appear where a finding applies to only one side.
> **One correction was applied by the orchestrator on write**, against library source rather than agent inference. It is flagged in place under [Does a role change reach an active session?](#does-a-role-change-reach-an-active-session).

The concerns every domain plugs into: the request pipeline, authentication, authorization, validation, error handling, logging, caching, rate limiting, observability and background processing.

## Request pipeline order (server)

`server/src/index.ts:25-68`. **The order is load-bearing.**

| # | Middleware | Applies to | Purpose |
|---|-----------|------------|---------|
| 1 | `helmet()` | all | Security headers |
| 2 | `cors({...})` | all | CORS with `credentials: true`, origins from `TRUSTED_ORIGINS` |
| 3 | `authLimiter` + Better Auth handler | `/api/auth/*` only | Rate limit, then auth — **before `express.json()`** |
| 4 | `express.json()` | everything except `/api/auth/*` | Body parsing |
| 5 | Route mounts, `/api/health`, `/api/me` | per endpoint | Application routes with per-route guards |
| 6 | `Sentry.setupExpressErrorHandler(app)` | all | Error capture |
| 7 | Static files + SPA fallback | production only | Serves the built client |

### Why Better Auth is mounted before `express.json()`

`server/src/index.ts:44-49`:

```typescript
// Mount Better Auth handler BEFORE express.json()
// Better Auth parses its own request bodies
app.all("/api/auth/{*any}", authLimiter, (req, res, next) => {
  toNodeHandler(auth)(req, res).catch(next);
});
```

`toNodeHandler` parses its own bodies. If `express.json()` ran first it would consume the stream and Better Auth would see an empty body. **Reversing this breaks sign-in.** It is a hard dependency of the library, not a house style.

The `.catch(next)` at `:48` is also required: Express 5 auto-catches rejections from async *route handlers*, but this is a manually-mounted handler, so without it a Better Auth failure would be an unhandled rejection.

## Authentication

### Client

Better Auth client at `client/src/lib/auth-client.ts:5-7`, exporting `signIn`, `signOut` and `useSession` with `inferAdditionalFields<typeof auth>()` so `session.user.role` is typed.

| Consumer | Purpose | Line |
|----------|---------|------|
| `ProtectedRoute.tsx` | redirect to `/login` when no session | 5 |
| `AdminRoute.tsx` | redirect to `/` when not admin | 6 |
| `Layout.tsx` | user name display, sign-out | 15 |
| `LoginPage.tsx` | redirect away if already signed in | 29 |

Tokens live in HTTP-only cookies managed by Better Auth. Nothing is reachable from JavaScript, and nothing is kept in `localStorage` or `sessionStorage`.

**Session expiry is handled lazily.** There is no 401 interceptor, so an expired session makes in-flight requests fail as ordinary errors; the redirect to `/login` happens only at the next navigation, when `useSession()` returns null and a guard re-evaluates. A user can keep clicking on a dead session and see error alerts rather than a sign-in prompt.

### Server — issuance

Better Auth with database-backed sessions via the Prisma adapter (`server/src/lib/auth.ts:6-31`):

```typescript
export const auth = betterAuth({
  basePath: "/api/auth",
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(",") ?? [],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: {
    additionalFields: {
      role: { type: "string", required: true, defaultValue: Role.agent, input: false },
      deletedAt: { type: "date", required: false, input: false },
    },
  },
});
```

Sign-up is disabled (`:14`); users are seeded. `role` defaults to `agent` and `input: false` prevents it being set through Better Auth's own endpoints (`:22`).

**There is no `session` key in this config.** Session lifetime, `updateAge`, `cookieCache` and `secondaryStorage` are all absent, so Better Auth's defaults apply throughout. That absence turns out to be the single most consequential fact in this document — see below.

### Server — the `requireAuth` guard

`server/src/middleware/require-auth.ts`:

```typescript
export const requireAuth: RequestHandler = async (req, res, next) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (session.user.deletedAt) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = session.user;
  req.session = session.session;
  next();
};
```

`getSession()` runs on **every** request, and `req.user` is whatever it returns.

The `deletedAt` check at `:15-18` is defence in depth rather than the primary mechanism: `DELETE /api/users/:id` already deletes the user's sessions (`routes/users.ts:162`), so in the normal flow `getSession()` returns null and `:10-13` fires first. The check still earns its place — a user soft-deleted by any other route (a direct database write, a future code path, a partially-failed delete, since those three writes are not transactional) would otherwise keep a working session.

**Express type augmentation** — `server/src/types/express.d.ts:3-10`:

```typescript
declare global {
  namespace Express {
    interface Request {
      user: typeof auth.$Infer.Session.user;
      session: typeof auth.$Infer.Session.session;
    }
  }
}
```

### Does a role change reach an active session?

**Yes. Immediately, on the next request. No code change is needed to make that true.**

> **Correction recorded.** The mapping agent for this document concluded the opposite — that `getSession()` returns user data snapshotted at sign-in, that a demoted admin would keep `role: "admin"` until expiry, and that the fix was to delete the user's sessions on role change. That conclusion was **checked against Better Auth's own source and does not hold.** It is recorded here because a wrong answer in this direction is expensive in both directions: it invents session-invalidation work that is not needed, and it makes a *promotion* force an unnecessary re-login.
>
> **GH-8 nevertheless drops sessions on demotion — read that as defence in depth, not as a contradiction.** The fresh read makes the drop *unnecessary*, not *wrong*: the property it rests on is a configuration absence (no `session` block), which any later config change can reverse silently. So privilege **loss** is made not to depend on it, while privilege **gain** still does — and the promotion test below is what guards that remaining dependency. A promotion deliberately does **not** force a re-login, which is the half of the agent's proposal that was genuinely wrong.

The evidence, from `better-auth@1.4.18` in `node_modules`:

**1. `findSession` has exactly two branches** — `better-auth/dist/db/internal-adapter.mjs:186-222`:

```javascript
findSession: async (token) => {
  if (secondaryStorage) {
    /* ... returns a cached snapshot, including user ... */
  }
  const result = await (await getCurrentAdapter(adapter)).findOne({
    model: "session",
    where: [{ value: token, field: "token" }],
    join: { user: true }
  });
  if (!result) return null;
  const { user, ...session } = result;
  if (!user) return null;
  return {
    session: parseSessionOutput(ctx.options, session),
    user: parseUserOutput(ctx.options, user)
  };
},
```

The first branch is the only one that returns a snapshot, and it requires `secondaryStorage`. **This repo configures none**, so it never runs. The second branch does `join: { user: true }` — a join against the `user` table — on every call, and `parseUserOutput` returns the row's live fields, `role` among them.

**2. The cookie cache cannot short-circuit it** — `better-auth/dist/api/routes/session.mjs:93`:

```javascript
if (sessionDataPayload?.session && ctx.context.options.session?.cookieCache?.enabled && !ctx.query?.disableCookieCache) {
```

The short-circuit is gated on `session.cookieCache.enabled`. With no `session` key in the config that is `undefined`, so the branch never fires. `better-auth/dist/cookies/index.mjs:67` returns early on the same condition, so the cache is never even written.

**3. The schema agrees.** `Session` carries only `userId` and no copy of any user field (`server/prisma/schema.prisma:58-70`, and [[07-data-model]]). There is nowhere for a stale role to live.

So: `requireAuth` → `getSession()` → `findSession` → a join on `user` → `req.user.role` is the current stored value, and `requireAdmin` decides on that. A demotion takes effect on the demoted user's next request; a promotion likewise.

**~~Independent corroboration~~ — withdrawn by GH-8 (2026-09-08).** This previously claimed that Better Auth does not cookie-cache custom `additionalFields`, so `role` would be re-fetched even with a cookie cache enabled, citing `.agents/skills/better-auth-best-practices/SKILL.md` gotcha #4. That gotcha reads *"Cookie cache — Custom session fields NOT cached, always re-fetched"*: it is about custom **session** fields, and `role` is a user `additionalField` (`lib/auth.ts:17-23`), not a session field. The claim does not transfer, and nothing else here establishes it.

So whether enabling `session.cookieCache` would serve a stale `role` is **unverified in either direction**. Both plausible outcomes are bad — a stale role, or an absent one that makes `requireAdmin` refuse everyone — so treat it as a change to test, not one the library protects you from.

**What would change this.** The property depends on configuration, not on application code, so it is quietly reversible. Adding `secondaryStorage`, or a `session.cookieCache` block, to `server/src/lib/auth.ts` would move role resolution off the live row and reintroduce exactly the staleness the agent wrongly reported. Anything touching that config should treat this as a behaviour it can break without touching a single line of authorization code.

**Now covered by an end-to-end test** — GH-8 added it, for exactly the reason stated above. `e2e/tests/users.spec.ts` → *"should authorize admin APIs on a promoted agent existing session"* signs an agent in, promotes them, and asserts their **pre-existing** session goes from 403 to 200 with no re-login. That is a live assertion of this property, so adding `secondaryStorage` or `session.cookieCache` to `lib/auth.ts` should now fail a test rather than silently regress authorization. The companion demotion case asserts a 401 instead, because a demotion also drops the target's sessions.

### Server — the `requireAdmin` guard

`server/src/middleware/require-admin.ts`:

```typescript
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.user?.role !== Role.admin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};
```

**It depends on `requireAuth` having run first.** Applied alone, `req.user` would be undefined, `undefined !== Role.admin` would hold, and it would send 403 where 401 is correct — denying access, but misreporting why, and doing so without ever validating a session. Every route chains them correctly as `requireAuth, requireAdmin` (see the audit below).

`Role` comes from `core/constants/role.ts:1-6` — an `as const` object plus a derived union, not a TS `enum`, because the client has `erasableSyntaxOnly` enabled.

### Server — webhook authentication, a third scheme

`server/src/middleware/require-webhook-secret.ts`:

```typescript
export const requireWebhookSecret: RequestHandler = (req, res, next) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Webhook secret is not configured" });
    return;
  }
  const provided = req.headers["x-webhook-secret"] || req.query.secret;
  if (provided !== secret) {
    res.status(401).json({ error: "Invalid webhook secret" });
    return;
  }
  next();
};
```

Used only by `POST /api/webhooks/inbound-email` (`routes/webhooks.ts:28`). Note it **fails closed** when misconfigured — a missing secret 500s rather than waving requests through — and that a boot-time warning already flags the condition (`index.ts:81-83`).

Two things to be aware of: the comparison is a plain `!==` rather than a constant-time compare, and the endpoint sits outside the rate limiter entirely.

### Router guard audit

| Router | Routes | Guards |
|--------|--------|--------|
| `users.ts` | all four verbs | `requireAuth` + `requireAdmin` |
| `tickets.ts` | all five | `requireAuth` only |
| `agents.ts` | `GET /api/agents` | `requireAuth` only |
| `replies.ts` | all four | `requireAuth` only |
| `webhooks.ts` | inbound email | `requireWebhookSecret` |
| `index.ts` | `GET /api/health` | none — deliberately public |
| `index.ts` | `GET /api/me` | `requireAuth` |

**No endpoint is accidentally unprotected.** User management is the only admin-gated area; everything else authenticated is open to agents and admins alike.

## Authorization

### Client

**Actually enforced:** `AdminRoute` (`AdminRoute.tsx:16`) redirects non-admins away from `/users` at the route level, so typing the URL does not reach the page.

**Hidden, not enforced:**

| Location | What is hidden |
|----------|----------------|
| `Layout.tsx:56-61` | the "Users" nav link, for non-admins |
| `UsersTable.tsx:103-111` | the delete button, on admin rows |

**A hidden control is not an access control.** Neither prevents the corresponding API call.

### Server — the real boundary

The hidden-control gaps above are safe **because the server independently enforces the same rules**. Every `/api/users` route carries `requireAuth` + `requireAdmin` (`routes/users.ts:13,22,71,138`), so a non-admin gets 403 whether the call came from the UI or from curl. And the admin-deletion rule is enforced server-side at `routes/users.ts:147-150`:

```typescript
if (user.role === Role.admin) {
  res.status(403).json({ error: "Admin users cannot be deleted" });
  return;
}
```

Note it tests the **currently stored** role, not a history of what the user has been.

**No resource-based authorization exists.** Authorization is purely role-based, with no ownership checks: any agent can reassign any ticket, change any ticket's status or category, and reply on any ticket.

| Role | Can | Cannot |
|------|-----|--------|
| `agent` | read and update all tickets, create replies, view the agent list, read own user info | manage users; change any role, including their own |
| `admin` | everything an agent can, plus create, update and delete users, and **promote or demote any other user** (since GH-8, 2026-09-08) | delete a user whose stored role is `admin`; change **their own** role (403) |

## Validation

### Server — the `validate` helper

`server/src/lib/validate.ts:4-17`:

```typescript
export function validate<T>(schema: ZodType<T>, body: unknown, res: Response): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0]?.message ?? "Validation failed" });
    return null;
  }
  return result.data;
}
```

It **sends the 400 itself** and returns `null`, so the caller's only job is to bail out:

```typescript
const data = validate(createUserSchema, req.body, res);
if (!data) return;
```

Only the **first** issue's message is returned, so a body with several problems surfaces one at a time.

A caller cannot silently forget the check: the return type is `T | null`, so using `data` without narrowing is a type error.

### Server — the `parseId` helper

`server/src/lib/parse-id.ts:1-4`:

```typescript
export function parseId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
```

Unlike `validate`, it sends nothing — the caller owns the message:

```typescript
const id = parseId(req.params.id);
if (!id) { res.status(400).json({ error: "Invalid ticket ID" }); return; }
```

**It is numeric-only, so it does not apply to user routes**, whose ids are UUID strings. Nothing replaces it there, so `PUT`/`DELETE /api/users/:id` validate the param not at all and a malformed id falls through to a 404.

### Core — the shared-schema pattern

One schema in `core/schemas/*.ts` serves both sides: the client through `zodResolver` (`UserForm.tsx:47`), the server through `validate` (`routes/users.ts:23`).

**Buys:** a single source of truth, so the two sides cannot drift on what is required; plus types for free via `z.infer`.
**Costs:** `core` must stay dependency-free to remain importable by both, and a schema change is a coordinated change.

| Schema | Defined | Client | Server |
|--------|---------|--------|--------|
| `createUserSchema` | `core/schemas/users.ts:4-8` | `UserForm.tsx:47` | `users.ts:23` |
| `updateUserSchema` | `core/schemas/users.ts:12-20` | `UserForm.tsx:47` | `users.ts:74` |
| `createReplySchema` | `core/schemas/replies.ts:3-5` | `ReplyForm.tsx:29` | `replies.ts:42` |
| `polishReplySchema` | `core/schemas/replies.ts:9-11` | — | `replies.ts:119` |
| `inboundEmailSchema` | `core/schemas/tickets.ts:5-11` | — | `webhooks.ts:36` |
| `updateTicketSchema` | `core/schemas/tickets.ts:25-29` | — | `tickets.ts:138` |
| `ticketListQuerySchema` | `core/schemas/tickets.ts:31-39` | — | `tickets.ts:64` |

Four of the seven are server-only, which is the clearest evidence that **client validation is a UX affordance and the server is always the gate.**

### Core — unknown fields are stripped, silently

**No schema in `core/schemas/` calls `.strict()` or `.passthrough()`**, so Zod v4's default `.strip()` applies. Verified directly against `core/schemas/users.ts:4-20`.

Send `{ name, email, password, role: "admin" }` to `POST /api/users` and the parsed result is `{ name, email, password }`. The `role` key is dropped, **no 400 is raised**, and the caller gets a 201 describing a user whose role is `agent`.

This is secure but mute: a client sending a field the server does not accept is told nothing. It is safe today only because no route reads `role` from a body — `POST` hardcodes `Role.agent` (`routes/users.ts:45`) and `updateUserSchema` has no `role` key. The moment a `role` key is *declared* in a schema, behaviour changes shape: a declared-but-invalid value fails enum validation and yields a 400, while an *undeclared* field is still silently dropped. Worth knowing which of those two a given requirement is actually asking for.

## Error handling

### Server

**Convention: no try/catch in async route handlers**, per CLAUDE.md — Express 5 catches rejected promises itself. `routes/users.ts:22-69` is representative: `findUnique`, `hashPassword` and `$transaction` are all unguarded.

The one legitimate exception is `lib/auto-resolve-ticket.ts:42-72`, which catches in order to *recover* — moving the ticket to `open` rather than letting the job die. Catching for recovery is a different thing from catching for reporting.

`Sentry.setupExpressErrorHandler(app)` is mounted after all routes (`index.ts:68`). Sentry itself is inert without a DSN (`lib/sentry.ts:3-8`, `enabled: !!process.env.SENTRY_DSN`) and traces at 100% when enabled.

**No error response leaks internals** — every manual error response in every router is `{ error: "<user-facing string>" }`. No stack traces, no raw Prisma errors, no SQL.

**Not verified in this pass:** the exact body Sentry's handler returns for an *unhandled* error. The client's `getErrorMessage` reads `response.data.error`, which matches the shape the routes send by hand, but whether the framework-level handler matches it was not tested. A mismatch would degrade to the `fallback` string, so the failure mode is cosmetic.

### Client

Two components, used consistently:

- **`ErrorAlert`** — a static `message`, or an `error` plus `fallback`. Extraction at `ErrorAlert.tsx:15-20`:

  ```ts
  export function getErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
      return error.response?.data?.error ?? fallback;
    }
    return fallback;
  }
  ```

- **`ErrorMessage`** — one destructive-styled line for a field error.

The Sentry error boundary at `main.tsx:14-22` catches **React render errors only**. Axios, query and mutation failures are shown to the user and then dropped — never reported.

**One place has no error surface at all:** `UpdateTicket.tsx` performs a `PATCH` and renders no `ErrorAlert`, so a failed status, category or assignment change is silent. It is the only inconsistency against an otherwise uniform convention.

## Logging

**`console.*` only.** No `winston`, no `pino`, no logger abstraction, verified by grep.

| File | Line | Level | What |
|------|------|-------|------|
| `index.ts` | 82 | warn | `WEBHOOK_SECRET is not set` — at boot |
| `index.ts` | 89 | log | server listening |
| `index.ts` | 93 | log | shutting down |
| `index.ts` | 105 | error | boot failure (also Sentry) |
| `queue.ts` | 13 | error | pg-boss error event (also Sentry) |
| `queue.ts` | 25 | log | queue started |
| `classify-ticket.ts` | 43 | warn | invalid category returned for a ticket |
| `auto-resolve-ticket.ts` | 66 | error | auto-resolve AI call failed |
| `send-email.ts` | 35 | log | email sent, with recipient and subject |
| `webhooks.ts` | 84, 88 | error | job enqueue failures |

**No correlation ids** — nothing links the lines belonging to one request or one ticket. **No aggregation** — stdout/stderr only, with no ELK, Datadog or CloudWatch. Sentry carries tags on exceptions (`{ queue, ticketId }`) but no breadcrumbs for routine events.

Note `send-email.ts:35` logs the recipient address, so email addresses reach the logs.

**Client:** no logging library. Errors surface through `ErrorAlert` and are not otherwise recorded.

## Caching

**Server: none.** No in-memory cache, no Redis, and no HTTP cache headers — grep finds no `Cache-Control`, `ETag` or `max-age`. Every request reads PostgreSQL.

**Client:** `QueryClient` is constructed with no options (`main.tsx:10`), so TanStack Query defaults hold — `staleTime: 0`, 5-minute `gcTime`, refetch on window focus, 3 retries.

| Mutation | Invalidates | Location |
|----------|-------------|----------|
| Delete user | `["users"]` | `UsersPage.tsx:51` |
| Create/update user | `["users"]` | `UserForm.tsx:68` |
| Update ticket | `["ticket", id]` | `UpdateTicket.tsx:41` |
| Create reply | `["replies", ticketId]` | `ReplyForm.tsx:43` |

**The ticket list key is never invalidated**, so a status change on the detail page leaves any cached `["tickets", …]` page stale until remount or refocus. With `staleTime: 0` it self-corrects fast enough that it has evidently never been felt as a bug. The two dashboard keys are likewise never invalidated.

No service worker, no offline support, no polling, no WebSocket or SSE.

## Rate limiting

`server/src/index.ts:35-42`:

```typescript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  skip: () => !isProduction,
});
```

Applied to `/api/auth/*` only (`:47`), and `skip` disables it entirely outside production (`:41`).

**Everything else is unlimited, in every environment:** all ticket, user-management, reply and webhook routes — including `POST /api/tickets/:id/replies/polish` and `/summarize`, which each make a paid OpenAI call from a single button click.

## Background jobs as a cross-cutting concern

`startQueue()` runs **before** `app.listen()` (`index.ts:86`), so a queue that cannot start means a server that never listens. Shutdown is symmetric (`index.ts:92-100`):

```typescript
const shutdown = async () => {
  console.log("Shutting down...");
  server.close();
  await stopQueue();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

`stopQueue()` allows in-flight jobs up to 30 seconds (`queue.ts:29`) while the server stops accepting connections.

All three workers report to Sentry and rethrow, so pg-boss retries them (3 attempts, 30s, exponential). After the final failure the job lands in pg-boss's failed table and nothing surfaces it.

**Enqueue failures are a separate, weaker path** — `routes/webhooks.ts:83-89`:

```typescript
sendClassifyJob(ticket).catch((error) =>
  console.error(`Failed to enqueue classify job for ticket ${ticket.id}:`, error)
);
```

The 201 has already gone out, so SendGrid will not retry, and the ticket exists with no classification and no auto-resolve attempt. Job *execution* retries three times; job *enqueueing* does not retry at all.

## Observability

**Server:** Sentry only (`lib/sentry.ts:3-8`) — inert without a DSN, `tracesSampleRate: 1.0`, no metrics, no custom spans, no breadcrumbs. Captures unhandled exceptions, pg-boss errors and explicit worker failures. Does **not** capture routine request completion, slow queries or rate-limit hits.

**Client:** `client/src/lib/sentry.ts:3-14` — inert without `VITE_SENTRY_DSN`, `tracesSampleRate: 1.0`, `replaysSessionSampleRate: 0` with `replaysOnErrorSampleRate: 1.0`, using `browserTracingIntegration` and `replayIntegration`. Captures React render errors, unhandled rejections and traces. Does not capture Axios errors in queries and mutations, nor validation errors — the latter correctly, since those are user input rather than faults.

Source maps build as `hidden` (`vite.config.ts:23`) and upload only when `SENTRY_AUTH_TOKEN` is set (`:16`), so they never ship to the browser.

## Internationalization

**None, either side.** All UI text is hardcoded English. Dates use `toLocaleDateString()` / `toLocaleString()` with the implicit browser locale (`HomePage.tsx:169`, `TicketsTable.tsx:92`, `ReplyThread.tsx:87`). Server error messages and outbound email bodies are hardcoded English with no locale negotiation.

## Absent concerns

Recorded so their absence is a known fact rather than an assumption: no feature flags · no client metrics beyond Sentry traces · no client-side rate limiting or throttle on the two GPT buttons · no recorded accessibility standard ([[00-scope]]) · no health check beyond `/api/health`, so nothing probes database or queue liveness · no HTTP retry (only background jobs retry) · no circuit breaker for OpenAI or SendGrid · no actor attribution on any table, so no record of who changed what ([[07-data-model]]).

## Three gotchas for a new contributor

1. **Better Auth must stay mounted before `express.json()`** (`index.ts:44-51`). Reversing it breaks sign-in, because the body stream is consumed before Better Auth can read it.

2. **Zod strips unknown fields silently.** No schema is `.strict()`, so an unexpected key in a request body is dropped without a 400. Secure, but it means a client can send a field, get a success response, and have been ignored.

3. **A role change takes effect on the next request — and that property lives in config, not code.** `getSession()` joins the user row every time (see the correction above), so authorization is always current. Adding `secondaryStorage` or a `session.cookieCache` block to `lib/auth.ts` would move role resolution off the live row. **Since GH-8 a test guards it** — the promotion case in `e2e/tests/users.spec.ts` asserts a pre-existing session picks up a new role — so that change should now break a test rather than pass quietly.

## Three inconsistencies

1. **The GPT endpoints are the least protected and the most expensive.** `/summarize` and `/polish` have no rate limit, no throttle and no cost cap, while the rate limiter guards only `/api/auth/*`.

2. **Session expiry behaves differently depending on what the user clicks.** The server 401s immediately, but with no client interceptor the user sees an error alert on a button press and a redirect to sign-in on a navigation — the same condition, two experiences.

3. **Enqueue failures are logged but not retried**, while execution failures retry three times — so the weaker guarantee sits on the path that has already returned 201 to a caller that will not retry.

## Related

- [[05-api-surface]] — endpoints, routers and guards in full
- [[07-data-model]] — the `User` and `Session` models the auth analysis rests on
- [[auth]] — authentication and authorization in domain terms
- [[user-management]] — the admin flow over auth-owned fields
- [[11-testing]] — which of these guards are actually covered, and which are not
- [[10-integrations]] — OpenAI, SendGrid and Sentry as boundaries
- [[08-standards/observed]] · [[08-standards/declared]] · [[08-standards/conflicts]]
- [[00-vision]] · [[00-scope]]
