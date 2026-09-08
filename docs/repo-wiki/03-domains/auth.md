---
tags: [auth, authentication, t3-domain]
---

# Domain: Authentication

> **Slug**: `auth`
> **Status**: active
> **Tier**: T3 (declared in `solvo.json` → `tiers.t3Domains`)
> **Last refreshed**: 2026-09-08 by `explore-05-domain-mapper` (full-stack scope; was client-only before)

## Business purpose

Signs internal users in with email and password, exposes session state to the rest of the app, and keeps unauthenticated visitors out of protected routes. Sign-up is disabled by design — accounts are seeded or created by an admin. Enforces two roles: `admin` (full access) and `agent` (no user management).

## Code locations

**Backend**
- `server/src/lib/auth.ts` — Better Auth config; Prisma adapter, email/password enabled, sign-up disabled
- `server/src/middleware/require-auth.ts` — session guard; sets `req.user` and `req.session`; rejects soft-deleted users
- `server/src/middleware/require-admin.ts` — role guard; 403 for non-admins
- `server/src/index.ts:47-49` — auth handler mount (`/api/auth/*`), rate-limited to 20 per 15 min in production
- `server/src/index.ts:57-60` — `/api/me`

**Frontend**
- `client/src/pages/LoginPage.tsx`
- `client/src/components/ProtectedRoute.tsx`, `client/src/components/AdminRoute.tsx`
- `client/src/lib/auth-client.ts` — Better Auth client; exports `signIn`, `signOut`, `useSession`
- `client/src/components/Layout.tsx:19-22` (sign-out), `:56-61` (admin-only nav item)

**Core (shared vocabulary)**
- `core/constants/role.ts` — `Role.admin`, `Role.agent` as an `as const` object, not a TS `enum` (the client has `erasableSyntaxOnly` enabled)

**Data ownership (Prisma)**
- `User` (`server/prisma/schema.prisma:40-56`) — `id`, `name`, `email`, `role`, `deletedAt`, relations to `Session`, `Account`, `Ticket`, `Reply`
- `Session` (`:58-70`) — `id`, `token`, `expiresAt`, `userId`, `ipAddress`, `userAgent`
- `Account` (`:72-89`) — Better Auth credential storage; `password`, `userId`, provider fields
- `Verification` (`:123-132`) — live but unused while sign-up is disabled
- `Role` enum (`:16-19`) — `admin | agent`, default `agent`

**Test coverage**
- E2E: `e2e/tests/auth.spec.ts` — login form, valid and invalid credentials, redirects, logout
- Component: none for `LoginPage`, `ProtectedRoute` or `AdminRoute`. See [[11-testing]].

## API surface

| Method | Route | Handler | Auth | Purpose |
|--------|-------|---------|------|---------|
| ALL | `/api/auth/*` | Better Auth SDK | none (rate-limited) | Sign-in, sign-out, session refresh; library-owned paths |
| GET | `/api/me` | `server/src/index.ts:57-60` | `requireAuth` | Returns the current user |

The client SDK talks to `/api/auth/*` directly — `signIn.email()` at `LoginPage.tsx:57`, `signOut()` at `Layout.tsx:19`. The exact sub-paths are the library's concern and were not traced. Session state comes from `useSession()` (`auth-client.ts:5`), consumed at `ProtectedRoute.tsx:5`, `AdminRoute.tsx:6`, `Layout.tsx:15` and `LoginPage.tsx:29`.

Full endpoint detail in [[05-api-surface]].

## Entry points

| Route | Component | Guard |
|-------|-----------|-------|
| `/login` | `LoginPage` | none (public) |

**Guards this domain applies elsewhere**
- `ProtectedRoute` wraps `/`, `/tickets`, `/tickets/:id`, `/users` (`client/src/App.tsx:15-24`)
- `AdminRoute` additionally wraps `/users` (`:20`)
- `requireAuth` guards every route in `users.ts`, `tickets.ts`, `agents.ts`, `replies.ts`
- `requireAdmin` guards every route in `users.ts`

## Better Auth configuration

`server/src/lib/auth.ts:6-31`, in full:

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

- **Sign-up disabled** (`:14`) — the admin user-management UI is the only account-provisioning surface
- **Additional fields** (`:17-28`) — `role` defaults to `agent`; `input: false` stops a client setting either field through Better Auth's own endpoints
- **No `session` block** — session lifetime, `updateAge` and `cookieCache` are all left at Better Auth defaults. The absence of `cookieCache` in particular is load-bearing; see below.
- **Rate limiting** — 20 requests per 15 min, production only (`server/src/index.ts:35-42`)

## Enforcement vs display

**Enforced by the client**
- `ProtectedRoute` redirects an unauthenticated session to `/login` (`ProtectedRoute.tsx:17-19`)
- `AdminRoute` redirects an authenticated non-admin to `/` (`AdminRoute.tsx:16-21`)

**Only hidden by the client — not enforced**
- The admin nav link (`Layout.tsx:56`) and the delete button (`UsersTable.tsx:103`) are display conditions. Neither prevents a direct API call.

**Enforced by the server — the real boundary**
- `require-auth.ts:10-13` — 401 when there is no session
- `require-auth.ts:15-18` — 401 when the user is soft-deleted, checked on every request
- `require-admin.ts:5-8` — 403 when `req.user.role !== Role.admin`
- `users.ts:115-118` — 403 when deleting a user whose stored role is `admin`

## How a role reaches an authorization decision

`require-admin.ts:5` reads `req.user?.role`, which `require-auth.ts:20` set from `session.user` after `auth.api.getSession()`. So the freshness of an authorization decision is exactly the freshness of `session.user.role`.

Three facts from this repo bear on whether a role change reaches an already-authenticated session:

1. `Session` denormalizes no user fields — only `userId` (`schema.prisma:58-70`). No table column holds a stale role.
2. `betterAuth()` configures no `session` block (`lib/auth.ts:6-31`), so `session.cookieCache` stays at its default of off. No signed cookie snapshot is in play.
3. `getSession()` runs per request, not once per session (`require-auth.ts:6`).

Together these indicate the role is resolved from the `User` row on every request, so a role change would take effect on the next one. **That is inference, not verified behaviour** — the step from "no cookie cache configured" to "a database read happens" rests on documented Better Auth behaviour this codebase does not itself prove. Verify empirically before depending on it for an authorization decision. Same analysis, from the guard's side, in [[05-api-surface]]; from the schema's side, in [[07-data-model]].

## Session handling

Session expiry is detected lazily. There is no Axios 401 interceptor, so an expired session surfaces only on the next navigation, when `useSession()` returns null. Whether that is intended is not determinable from the code. See [[13-cross-cutting]].

## Relationship with user-management

- auth **provides** the `User` and `Session` models and the `requireAuth` / `requireAdmin` guards
- [[user-management]] **mutates** `User.name`, `User.email`, `User.deletedAt` through `/api/users`
- `User.role` is auth-owned and currently mutated by nothing — it is set once at creation and never written again

Any change to how roles are written is a user-management change to an auth-owned field, and lands in both T3 domains at once.

## Open questions

- Better Auth's default session lifetime was never read from the library docs, and no `session.expiresIn` is configured. Whether the default suits this product is unknown.
- Session expiry has no client-side handling strategy — no interceptor, no explicit refresh.
- `deletedAt` is checked on every request (`require-auth.ts:15-18`), so a soft delete should take effect immediately. That has not been integration-tested.
- Nothing in the schema records **who** changed a user, or when a role last changed — there are no `modifiedBy` columns anywhere ([[07-data-model]]). Any requirement to attribute an authorization change would need new columns.

## Related

- [[user-management]] — mutates the `User` row this domain owns
- [[05-api-surface]] — every route and guard, with citations
- [[07-data-model]] — `User`, `Session`, `Account`, and the `Role` enum
- [[13-cross-cutting]] — session handling and the absent interceptor (client scope)
- [[11-testing]] — coverage gaps on the guards
- [[04-features/sign-in]], [[04-features/sign-out]]
- [[00-vision]] — sign-up as a standing non-goal
