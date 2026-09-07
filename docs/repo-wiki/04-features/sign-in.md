---
tags: [auth, feature]
---

# Feature: Sign in

> **Slug** `sign-in` · **Domain** [[auth]] · **Personas** Support Agent, Admin
> Cataloged 2026-09-07 (client scope).

## What the user does

Enters an email and password to get into the helpdesk. Sign-up is disabled by design ([[00-vision]]) — the admin is seeded via `prisma/seed.ts` and creates agent accounts through [[create-user]], so this form is the only way in and there is no self-service route to an account.

## Entry

`/login` — the only public route. An already-authenticated visitor is redirected to `/` (`LoginPage.tsx:50-52`).

## Components

`pages/LoginPage.tsx` (135 LOC), `lib/auth-client.ts`.

## API

`signIn.email(data)` at `:57` — the Better Auth SDK, not Axios. Better Auth mounts under `/api/auth/*`; exact paths are the library's concern and were not traced, since the server was not explored.

## Validation

A local inline Zod schema (`:21-24`): valid email, non-empty password. Correctly *not* in `core/schemas/` — the endpoint belongs to Better Auth rather than to a route this repo writes.

## UI states

| State | Rendering |
|-------|-----------|
| Session loading | full-screen spinner (`:41-48`) |
| Already signed in | redirect to `/` (`:50-52`) |
| Ready | email + password fields, Sign in enabled |
| Validation error | `ErrorMessage` per field (`:102-104`, `:114-116`) |
| Auth error | `ErrorAlert` above the form (`:90-91`), falling back to "Login failed" |
| Submitting | disabled, "Signing in…", spinner (`:118-126`) |
| Success | navigate to `/` (`:64`) |

## Tests

No component test. Covered by `e2e/tests/auth.spec.ts`, which exercises the form, validation, success, error messaging and the already-authenticated redirect. Given the flow depends on real session cookies, E2E is the defensible home for it under CLAUDE.md's policy.
