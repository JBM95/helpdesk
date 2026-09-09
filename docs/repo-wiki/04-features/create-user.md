---
tags: [user-management, feature]
---

# Feature: Create user

> **Slug** `create-user` · **Domain** [[user-management]] · **Persona** Admin only
> Cataloged 2026-09-07 (client scope); server trace added 2026-09-08.

## What the user does

An admin clicks "New User", fills in name, email and password in a modal, and submits. Because sign-up is disabled ([[00-vision]]), this is the **only** account-provisioning path in the product.

## Entry

Users page, "New User" button (`UsersPage.tsx:60-63`).

## Components

`pages/UsersPage.tsx` (dialog state), `pages/UserForm.tsx` (shared with [[edit-user]]).

## API

`POST /api/users` at `UserForm.tsx:64`, body `{ name, email, password }`. Invalidates `["users"]` (`:68`).

### Server trace

**Handler:** `server/src/routes/users.ts:22-69`
**Guards:** `requireAuth` + `requireAdmin`
**Request DTO:** `createUserSchema` (`core/schemas/users.ts:4-8`) — `{ name: trimmed min 3, email, password: trimmed min 8 }`
**Validation:** `validate(createUserSchema, req.body, res)` at `:23`. No `.strict()`, so extra keys are stripped silently ([[13-cross-cutting]]).

**Uniqueness check, before the transaction** — `users.ts:28-32`:

```typescript
const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  res.status(409).json({ error: "Email already exists" });
  return;
}
```

**Prisma writes, wrapped in `prisma.$transaction([...])`** (`users.ts:38-61`) — both succeed or both roll back:

1. `User.create` (`:39-49`) — `id: crypto.randomUUID()`, `name`, `email`, `emailVerified: false`, `createdAt`/`updatedAt` set by the application, and:

   ```typescript
   role: Role.agent,   // users.ts:45 — hardcoded
   ```

2. `Account.create` (`:50-60`) — `providerId: "credential"`, `userId`, and the password hashed by `better-auth/crypto` at `:34`.

**Post-transaction read** — `users.ts:63-66` re-selects `{ id, name, email, role, createdAt }`.

**Response:** `201` with `{ user }`, including `role`.
**Error paths:** 400 validation · 409 duplicate email · 401 unauthenticated · 403 non-admin.

**No `role` parameter is accepted.** It is absent from `createUserSchema`, so a client cannot set it, and `:45` hardcodes `agent`. The single admin in this system exists because `server/prisma/seed.ts` creates it — there is no in-product way to make another ([[07-data-model]]).

The password crosses the wire in plaintext under TLS and is hashed server-side.

## Validation

`createUserSchema` via `zodResolver` (`:33`) on the client and via `validate` at `routes/users.ts:23` on the server — the same schema on both sides ([[08-standards/observed]]).

## UI states

| State | Rendering |
|-------|-----------|
| Closed | dialog hidden |
| Open | "Create User" modal, empty form (`:67-80`) |
| Validation error | `ErrorMessage` per field (`:72-74`, `:86-88`, `:100-102`) |
| Submitting | disabled, "Creating…" (`:114`) |
| Error | `ErrorAlert` in the form (`:104-109`) |
| Success | `onSuccess()` (`:54`) closes the dialog, `["users"]` invalidated, form reset |

## Tests

**Component:** `pages/UserForm.test.tsx` (287 LOC) — field rendering, validation (short name, short password, missing email), `aria-invalid`, the request, the success callback, form reset, a 409 surfaced via `data.error`, a generic non-Axios error, and the loading state.

**E2E:** `e2e/tests/users.spec.ts` — the dialog opens with the expected fields; a successful creation returns 201 and the new row shows the correct name, email, the **`agent`** role, and both edit and delete buttons (`:139-149`).

That E2E assertion is the existing guard on creation defaulting to `agent`, and it is the regression test any change to role handling must keep green.

## Related

[[user-management]] · [[edit-user]] · [[delete-user]] · [[view-users-list]] · [[05-api-surface]] · [[07-data-model]] · [[11-testing]]
