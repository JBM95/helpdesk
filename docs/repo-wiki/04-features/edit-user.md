---
tags: [user-management, feature]
---

# Feature: Edit user

> **Slug** `edit-user` · **Domain** [[user-management]] · **Persona** Admin only
> Cataloged 2026-09-07 (client scope); server trace added 2026-09-08.

## What the user does

An admin clicks the pencil icon on a row, adjusts name, email or password in a modal, and saves. Leaving the password blank keeps the current one — the placeholder says so (`UserForm.tsx:95`).

**Role is not editable.** The form has no role control, the schema has no role field, and the handler neither reads nor writes one. The Users table *displays* a role badge, so the UI shows a value this feature cannot change.

## Entry

Users page, edit icon per row (`UsersTable.tsx:95-102`).

## Components

`pages/UsersPage.tsx` (dialog state carrying the target user), `pages/UserForm.tsx` (shared with [[create-user]]; mode is decided by whether a `user` prop is passed).

## API

`PUT /api/users/:id` at `UserForm.tsx:44`, body `{ name, email, password }`. Invalidates `["users"]` (`:51`).

### Server trace

**Handler:** `server/src/routes/users.ts:71-104`
**Guards:** `requireAuth` + `requireAdmin`
**Route param:** `:id` — a UUID string, **not validated**. `parseId` is numeric-only and does not apply, and nothing replaces it, so a malformed id reaches Prisma and surfaces as a 404.
**Request DTO:** `updateUserSchema` (`core/schemas/users.ts:11-18`)
**Validation:** `validate(updateUserSchema, req.body, res)` at `:74` — 400 with the first issue's message if it fails

The schema, in full:

```typescript
export const updateUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.email("Invalid email address"),
  password: z.union([
    z.literal(""),
    z.string().trim().min(8, "Password must be at least 8 characters"),
  ]),
});
```

All three keys are **required to be present**; `password` may be the empty string but may not be omitted. There is no `.strict()`, so any additional key — `role` included — is silently stripped rather than rejected (see [[13-cross-cutting]]).

**Fields destructured** — `users.ts:77`:

```typescript
const { name, email, password } = data;
```

**Uniqueness check** — `users.ts:79-83`:

```typescript
const existing = await prisma.user.findUnique({ where: { email } });
if (existing && existing.id !== id) {
  res.status(409).json({ error: "Email already exists" });
  return;
}
```

**Prisma writes — two, and not transactional:**

1. `users.ts:85-88`:

   ```typescript
   await prisma.user.update({
     where: { id: id },
     data: { name, email, updatedAt: new Date() },
   });
   ```

2. Conditionally, when `password` is truthy (`users.ts:90-96`):

   ```typescript
   await prisma.account.updateMany({
     where: { userId: id, providerId: "credential" },
     data: { password: hashedPassword, updatedAt: new Date() },
   });
   ```

Because the two are separate writes, a failure between them leaves the profile updated and the password not.

**Post-write read** — `users.ts:98-101` re-selects `{ id, name, email, role, createdAt }`.

**Response:** `200` with `{ user }`, **including the unchanged `role`**.

**Error paths:** 400 on validation failure · 409 on an email already held by another user · 401 unauthenticated · 403 non-admin · 404 when the id matches no user.

### As-is baseline for role mutation

Recorded precisely, because this is the card any role-mutation work changes:

| Layer | Location | Present state |
|-------|----------|---------------|
| Validation contract | `core/schemas/users.ts:11-18` | no `role` key |
| Handler destructure | `server/src/routes/users.ts:77` | `{ name, email, password }` — no `role` |
| Prisma `data` | `server/src/routes/users.ts:87` | `{ name, email, updatedAt }` — no `role` |
| Client form | `client/src/pages/UserForm.tsx` | no role control rendered |
| Response | `server/src/routes/users.ts:98-101` | `role` **is** selected and returned |
| Database column | `server/prisma/schema.prisma:46` | `role Role @default(agent)` — exists, both enum members present, **no migration needed** |

A request carrying `role` today is accepted with a 200 and the role is ignored — stripped by Zod before the handler sees it.

## Validation

`updateUserSchema`, chosen over the create schema by mode at `UserForm.tsx:33` and applied server-side at `routes/users.ts:74`. The same schema on both sides is the house pattern ([[08-standards/observed]]); the server call is the gate, the client call is the affordance.

## UI states

As [[create-user]], differing in: an "Edit User" title, the form pre-populated from the row, a "Save Changes" label, "Saving…" while submitting (`:113`), and an empty password permitted.

## Tests

**Component:** `pages/UserForm.test.tsx` (287 LOC) — pre-population, the button label, the password placeholder, submitting with and without a password, the success callback, the loading state, validation still applying to a supplied password, and error display on failure.

**E2E:** `e2e/tests/users.spec.ts` — the dialog opens pre-populated with an empty password field and the "leave blank to keep current" placeholder; editing name and email together updates the table and the old values disappear.

Neither asserts anything about role, because there is nothing to assert.

## Related

[[user-management]] · [[create-user]] · [[delete-user]] · [[view-users-list]] · [[05-api-surface]] · [[07-data-model]] · [[13-cross-cutting]] · [[11-testing]]
