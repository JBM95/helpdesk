---
tags: [auth, feature]
---

# Feature: Sign out

> **Slug** `sign-out` · **Domain** [[auth]] · **Personas** Support Agent, Admin
> Cataloged 2026-09-07 (client scope).

## What the user does

Clicks "Sign out" in the nav bar to end the session and return to the login page.

## Entry

Nav bar, top right. `components/Layout.tsx:79-85`.

## Components

`components/Layout.tsx`, `lib/auth-client.ts`.

## API

`signOut()` via the Better Auth SDK (`Layout.tsx:19`), then `navigate("/login", { replace: true })` (`:21`).

## UI states

No intermediate state — there is no pending or disabled treatment on the button, and navigation follows immediately. A slow or failed `signOut()` would give the user no feedback; the handler does not branch on failure.

## Tests

No component test. Covered by `e2e/tests/auth.spec.ts`, which also asserts that protected routes are inaccessible afterwards and that signing in is required again.
