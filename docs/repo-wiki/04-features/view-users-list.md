---
tags: [user-management, feature]
---

# Feature: View users list

> **Slug** `view-users-list` · **Domain** [[user-management]] · **Persona** Admin only
> Cataloged 2026-09-07 (client scope).

## What the user does

An admin sees every account — agents and admins alike — with name, email, role badge and created date, plus per-row edit and delete actions.

## Entry

`/users`, behind `ProtectedRoute` + `AdminRoute`. Nav link at `Layout.tsx:56-61`, rendered only for admins.

## Components

`pages/UsersPage.tsx` (container, dialog and delete state), `pages/UsersTable.tsx` (table and row actions).

## API

`GET /api/users` at `UsersTable.tsx:39`, key `["users"]`. Shape: `{ users: [{ id, name, email, role, createdAt }] }`. Invalidated by [[create-user]], [[edit-user]] and [[delete-user]].

## UI states

| State | Rendering |
|-------|-----------|
| Loading | 5 skeleton rows (`:60-79`) |
| Error | `ErrorAlert` "Failed to fetch users" (`:44-46`) |
| Empty | empty table body |
| Populated | rows with actions (`:80-115`) |

## Delete visibility

`UsersTable.tsx:103` renders the delete button only when `user.role !== Role.admin`, so admins cannot be removed through the UI. This is a **display condition, not an access control** — it does not stop a direct `DELETE` call. Server-side enforcement was not examined. See [[13-cross-cutting]].

## Tests

`pages/UsersPage.test.tsx` (273 LOC) covers loading, render, date formatting, fetch error, empty table, dialog behaviour, and specifically that the delete button appears on agent rows and not on admin rows. `UsersTable.tsx` has no direct test but is fully exercised here and is not used elsewhere.

E2E: `e2e/tests/users.spec.ts`.
