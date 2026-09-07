---
tags: [auth, authentication]
---

# Domain: Authentication

> **Slug**: `auth`
> **Status**: active
> **Last refreshed**: 2026-09-07 by `explore-05-domain-mapper` (client scope only)

## Business purpose

Signs internal users in with email and password, exposes session state to the rest of the app, and keeps unauthenticated visitors out of protected routes. Sign-up is disabled by design — accounts are seeded or created by an admin.

## Code locations

- `client/src/pages/LoginPage.tsx`
- `client/src/components/ProtectedRoute.tsx`, `client/src/components/AdminRoute.tsx`
- `client/src/lib/auth-client.ts` — Better Auth client; exports `signIn`, `signOut`, `useSession`
- `client/src/components/Layout.tsx:19-22` (sign-out), `:56-61` (admin-only nav item)

## Entry points

| Route | Component | Guard |
|-------|-----------|-------|
| `/login` | `LoginPage` | none — public |

Guards applied elsewhere: `ProtectedRoute` wraps `/`, `/tickets`, `/tickets/:id`, `/users`; `AdminRoute` additionally wraps `/users` (`client/src/App.tsx:15-24`).

## API surface

Sign-in and sign-out go through the Better Auth client SDK (`signIn.email()` at `LoginPage.tsx:57`, `signOut()` at `Layout.tsx:19`), not through Axios. Better Auth mounts under `/api/auth/*`; the exact paths are the library's concern and were not traced, since the server was not explored.

Session state comes from `useSession()` (`auth-client.ts:5`), consumed at `ProtectedRoute.tsx:5`, `AdminRoute.tsx:6`, `Layout.tsx:15`, `LoginPage.tsx:29`.

## Dependencies

- `core/constants/role.ts` — `Role.admin`, used at `AdminRoute.tsx:16`
- `better-auth/react`
- `ErrorAlert`, `ErrorMessage`, `components/ui/*`

Every other domain depends on this one for its guard.

## What the client enforces vs merely hides

`AdminRoute` genuinely redirects a non-admin away from `/users`. The hidden nav link at `Layout.tsx:56` and the hidden delete button at `UsersTable.tsx:103` are display conditions, not access controls — they do not prevent a direct API call. The server is the enforcement boundary; it was not examined. See [[13-cross-cutting]].

## Test coverage

No component test for `LoginPage`, `ProtectedRoute` or `AdminRoute`. All three are covered by `e2e/tests/auth.spec.ts` (not deep-read this pass). See [[11-testing]].

## Open questions

- Session expiry is detected lazily: there is no Axios 401 interceptor, so an expired session surfaces only on the next navigation when `useSession()` returns null. Whether that is intended is unclear from the client alone.
- Better Auth's server configuration (`server/src/lib/auth.ts`) governs session lifetime and cookie flags and was not read.

## Related

- [[13-cross-cutting]] — session handling, guards, the absent interceptor
- [[04-features/sign-in]], [[04-features/sign-out]]
- [[00-vision]] — records sign-up as a standing non-goal
