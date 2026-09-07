---
tags: [user-management, feature]
---

# Feature: Create user

> **Slug** `create-user` · **Domain** [[user-management]] · **Persona** Admin only
> Cataloged 2026-09-07 (client scope).

## What the user does

An admin clicks "New User", fills in name, email and password in a modal, and submits. Since sign-up is disabled ([[00-vision]]), this is the **only** account-provisioning path in the product.

## Entry

Users page, "New User" button (`UsersPage.tsx:58-61`).

## Components

`pages/UsersPage.tsx` (dialog state), `pages/UserForm.tsx` (shared with [[edit-user]]; mode is decided by whether a `user` prop is passed).

## API

`POST /api/users` at `UserForm.tsx:47`, body `{ name, email, password }`. Invalidates `["users"]` (`:51`).

## Validation

`createUserSchema` from `core/schemas/users.ts` via `zodResolver` (`:33`). The same schema is applied server-side at `routes/users.ts:23` per [[08-standards/observed]].

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

`pages/UserForm.test.tsx` (287 LOC) covers field rendering, validation (short name, short password, missing email), `aria-invalid`, the request, the success callback, form reset, a 409 conflict surfaced via `data.error`, a generic non-Axios error, and the loading state.
