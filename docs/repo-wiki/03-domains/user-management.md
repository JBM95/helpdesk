---
tags: [user-management, admin]
---

# Domain: User Management

> **Slug**: `user-management`
> **Status**: active
> **Last refreshed**: 2026-09-07 by `explore-05-domain-mapper` (client scope only)

## Business purpose

Admins manage the agent roster — creating, editing and removing accounts. Because sign-up is disabled ([[00-vision]]), this is the only account-provisioning surface in the product.

## Code locations

- `client/src/pages/UsersPage.tsx` (dialog state, delete mutation)
- `client/src/pages/UsersTable.tsx` (table, row actions)
- `client/src/pages/UserForm.tsx` (create and edit, one component, mode by prop)
- Tests: `UsersPage.test.tsx`, `UserForm.test.tsx`

## Entry points

| Route | Component | Guard |
|-------|-----------|-------|
| `/users` | `UsersPage` | `ProtectedRoute` + `AdminRoute` |

Nav link at `Layout.tsx:56-61`, rendered only for admins.

## API surface, as the client calls it

| Method | Path | Called from |
|--------|------|-------------|
| GET | `/api/users` | `UsersTable.tsx:39` |
| POST | `/api/users` | `UserForm.tsx:47` — `{ name, email, password }` |
| PUT | `/api/users/:id` | `UserForm.tsx:44` — `{ name, email, password? }`, password optional on edit |
| DELETE | `/api/users/:id` | `UsersPage.tsx:47` |

All four invalidate the `["users"]` query key on success.

## Dependencies

- `core/constants/role.ts` — `Role`, `Role.admin`
- `core/schemas/users.ts` — `createUserSchema`, `updateUserSchema`; `UserForm.tsx:33` selects between them by mode
- `ErrorAlert`, `ErrorMessage`, `components/ui/*` (Dialog, AlertDialog, Table, Badge, Skeleton)

## Delete protection

`UsersTable.tsx:103` renders the delete button only when `user.role !== Role.admin`. This is a display condition; it does not stop a direct `DELETE` call. Server-side enforcement was not examined.

## Test coverage

2 of 3 files have direct tests. `UsersTable.tsx` has none but is fully exercised through `UsersPage.test.tsx`, and is not used outside that page.

## Open questions

- User IDs are UUID strings, so the server's numeric `parseId` helper does not apply to these routes ([[08-standards/observed]] records this as a domain-appropriate deviation).
- The table lists admins as well as agents. Whether that is deliberate is not determinable from the client.
- The relationship between `/api/users` here and `/api/agents` in [[tickets]] is unresolved without the server.

## Related

- [[04-features/view-users-list]], [[04-features/create-user]], [[04-features/edit-user]], [[04-features/delete-user]]
- [[00-vision]] — account provisioning is a standing non-goal beyond this admin surface
