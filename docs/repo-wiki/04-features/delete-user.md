---
tags: [user-management, feature]
---

# Feature: Delete user

> **Slug** `delete-user` · **Domain** [[user-management]] · **Persona** Admin only
> Cataloged 2026-09-07 (client scope).

## What the user does

An admin clicks the trash icon on a non-admin row, confirms in a destructive alert dialog, and the account is removed.

## Entry

Users page, delete icon per row (`UsersTable.tsx:104-111`) — rendered only when `user.role !== Role.admin` (`:103`).

## Components

`pages/UsersPage.tsx` (mutation and confirmation state), `pages/UsersTable.tsx` (button, delegating via `onDelete`).

## API

`DELETE /api/users/:id` at `UsersPage.tsx:47`. Invalidates `["users"]` (`:49`) and clears the pending target (`:50`).

## UI states

| State | Rendering |
|-------|-----------|
| Closed | dialog hidden |
| Open | alert dialog naming the user, Cancel + Confirm (`:81-102`) |
| Mutating | **no loading state — Confirm stays clickable**, so a double-click can fire a second request |
| Error | `ErrorAlert` inside the dialog (`:89-91`), dialog stays open |
| Success | dialog closes, `["users"]` invalidated |

## Two things to be clear about

**The admin protection is presentational.** Hiding the button (`UsersTable.tsx:103`) stops a click, not a request. Whether the server refuses to delete an admin was not examined — the server is out of scope for this pass. Do not read the hidden button as evidence the rule is enforced.

**Whether deletion is soft or hard is not visible from the client.** The Prisma schema carries a `User.deletedAt` column (added in migration `20260218190509_add_user_deleted_at`, per [[12-build-deploy]]), which suggests soft deletion, but the client cannot confirm what the endpoint does.

## Tests

`pages/UsersPage.test.tsx` covers the confirmation dialog, that Cancel issues no request, that Confirm calls `DELETE`, the list refresh afterwards, and that the button is absent on admin rows.
