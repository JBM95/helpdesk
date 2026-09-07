---
tags: [user-management, feature]
---

# Feature: Edit user

> **Slug** `edit-user` · **Domain** [[user-management]] · **Persona** Admin only
> Cataloged 2026-09-07 (client scope).

## What the user does

An admin clicks the pencil icon on a row, adjusts name, email or password in a modal, and saves. Leaving the password blank keeps the current one — the placeholder says so (`UserForm.tsx:95`).

## Entry

Users page, edit icon per row (`UsersTable.tsx:95-102`).

## Components

`pages/UsersPage.tsx` (dialog state carrying the target user), `pages/UserForm.tsx` (shared with [[create-user]]).

## API

`PUT /api/users/:id` at `UserForm.tsx:44`, body `{ name, email, password? }`. Invalidates `["users"]` (`:51`).

## Validation

`updateUserSchema` from `core/schemas/users.ts`, selected over the create schema by mode at `:33`. Password optional, but still length-checked when supplied. Applied server-side at `routes/users.ts:74`.

## UI states

Same shape as [[create-user]], differing in: "Edit User" title, form pre-populated from the row, "Save Changes" label, "Saving…" while submitting (`:113`), and an empty password permitted.

## Tests

`pages/UserForm.test.tsx` covers pre-population, the button label, the password placeholder, submitting with and without a password, the success callback, the loading state, that validation still applies to a supplied password, and error display on failure.
