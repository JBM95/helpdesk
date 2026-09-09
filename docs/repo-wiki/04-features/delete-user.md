---
tags: [user-management, feature]
---

# Feature: Delete user

> **Slug** `delete-user` · **Domain** [[user-management]] · **Persona** Admin only
> Cataloged 2026-09-07 (client scope); server trace added 2026-09-08.

## What the user does

An admin clicks the trash icon on a non-admin row, confirms in a destructive alert dialog, and the account is removed.

## Entry

Users page, delete icon per row (`UsersTable.tsx:104-111`) — rendered only when `user.role !== Role.admin` (`:103`).

## Components

`pages/UsersPage.tsx` (mutation and confirmation state), `pages/UsersTable.tsx` (button, delegating via `onDelete`).

## API

`DELETE /api/users/:id` at `UsersPage.tsx:49`. Invalidates `["users"]` (`:51`) and clears the pending target (`:52`).

### Server trace

**Handler:** `server/src/routes/users.ts:138-165`
**Guards:** `requireAuth` + `requireAdmin`
**Route param:** `:id` — a UUID string, **not validated**
**Request body:** none · **Validation:** none

**Existence check** — `users.ts:141-145`: 404 `{ error: "User not found" }` when absent.

**Admin-deletion protection** — `users.ts:147-150`:

```typescript
if (user.role === Role.admin) {
  res.status(403).json({ error: "Admin users cannot be deleted" });
  return;
}
```

**This tests the currently stored role.** It is a check on what the user *is*, not a record of what they have been. Since GH-8 made role writable (2026-09-08) that distinction has a consequence: demoting an admin to `agent` and then deleting them reaches, in two individually-legal steps, the outcome this rule refuses in one.

**Resolved as intended.** GH-8's AC7 requires that a user whose *current stored role* is admin stay protected — which this rule does, unchanged. It does not require the composed path to be closed. `e2e/tests/users.spec.ts` asserts both halves explicitly: refused while admin, permitted once demoted. See [[user-management]] §Delete protection.

**Prisma writes — three, and not transactional** (`users.ts:152-162`):

1. Soft-delete: `prisma.user.update({ where: { id }, data: { deletedAt: new Date() } })`
2. Unassign tickets: `prisma.ticket.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } })`
3. Invalidate sessions: `prisma.session.deleteMany({ where: { userId: id } })`

A failure part-way leaves the sequence half-applied — a soft-deleted user with tickets still assigned, or with sessions still live. The `deletedAt` check in `requireAuth` (`middleware/require-auth.ts:15-18`) is the backstop for that last case, which is why it is not the dead code it might look like ([[13-cross-cutting]]).

Write 3 was the repo's **only precedent for invalidating sessions in response to a change in a user's standing** until GH-8 followed it: `PUT /api/users/:id` now runs the same `deleteMany` on a demotion. Strictly, a role change does not *need* it — `getSession()` re-reads the user row on every request (see [[auth]] for the library-source evidence) — so it is defence in depth rather than the mechanism, chosen so privilege loss does not depend on a library behaviour a future `session.cookieCache` setting could change.

**Response:** `200` with `{ message: "User deleted" }`.
**Error paths:** 404 absent user · 403 target is an admin · 401 unauthenticated · 403 caller is not an admin.

## Deletion is soft, and permanent

`User.deletedAt` is set and the row stays. Added by migration `20260218190509_add_user_deleted_at` ([[07-data-model]]). Nothing prunes soft-deleted rows, so a soft delete is permanent in practice, and the user's `Account` row — their credential — is **never cleaned up**.

## UI states

| State | Rendering |
|-------|-----------|
| Closed | dialog hidden |
| Open | alert dialog naming the user, Cancel + Confirm (`:81-102`) |
| Mutating | **no loading state — Confirm stays clickable**, so a double-click fires a second request |
| Error | `ErrorAlert` inside the dialog (`:89-91`), dialog stays open |
| Success | dialog closes, `["users"]` invalidated |

The second `DELETE` of a double-click hits the existence check and 404s, so the damage is a spurious error rather than a double deletion — but the missing pending state is a real gap.

## Tests

**Component:** `pages/UsersPage.test.tsx` — the confirmation dialog, Cancel issuing no request, Confirm calling `DELETE`, the list refreshing, and the button's absence on admin rows.

**E2E:** `e2e/tests/users.spec.ts` — the confirmation dialog names the user and offers Cancel and Confirm; confirming removes the row.

**Since GH-8 the 403 is asserted at the API.** `e2e/tests/users.spec.ts` → *"should refuse to delete a user whose stored role is admin"* issues a direct `DELETE` against a promoted user and asserts both the 403 and the `"Admin users cannot be deleted"` body; a companion case asserts the delete succeeds once that user is demoted. Before GH-8 the protection was only ever verified through the UI's hidden button — see [[11-testing]] §Authorization coverage today.

## Related

[[user-management]] · [[view-users-list]] · [[create-user]] · [[edit-user]] · [[05-api-surface]] · [[07-data-model]] · [[13-cross-cutting]] · [[11-testing]]
