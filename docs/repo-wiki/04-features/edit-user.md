---
tags: [user-management, feature]
---

# Feature: Edit user

> **Slug** `edit-user` · **Domain** [[user-management]] · **Persona** Admin only
> Cataloged 2026-09-07 (client scope); server trace added 2026-09-08.

## What the user does

An admin clicks the pencil icon on a row, adjusts name, email, password or **role** in a modal, and saves. Leaving the password blank keeps the current one — the placeholder says so (`UserForm.tsx:112`).

**Role is editable, admin-only, since GH-8** (2026-09-08). The modal carries a two-option `Select` (Agent / Admin) pre-set to the user's stored role, rendered in edit mode only. The server is the authority: see [[user-management]] §Role handling for the two guards that constrain the transition, and the As-is baseline table below for what each layer looked like beforehand.

## Entry

Users page, edit icon per row (`UsersTable.tsx:95-102`).

## Components

`pages/UsersPage.tsx` (dialog state carrying the target user), `pages/UserForm.tsx` (shared with [[create-user]]; mode is decided by whether a `user` prop is passed).

## API

`PUT /api/users/:id` at `UserForm.tsx:59`, body `{ name, email, password, role }` — all four required since GH-8. Invalidates `["users"]` (`:68`).

### Server trace

**Handler:** `server/src/routes/users.ts:71-136`
**Guards:** `requireAuth` + `requireAdmin`
**Route param:** `:id` — a UUID string, **not validated**. `parseId` is numeric-only and does not apply, and nothing replaces it. Since GH-8 the handler loads the target row first, so an id matching no user is a clean 404 rather than an unhandled Prisma error.
**Request DTO:** `updateUserSchema` (`core/schemas/users.ts`)
**Validation:** `validate(updateUserSchema, req.body, res)` — 400 with the first issue's message if it fails

The schema, in full:

```typescript
export const updateUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.email("Invalid email address"),
  password: z.union([
    z.literal(""),
    z.string().trim().min(8, "Password must be at least 8 characters"),
  ]),
  role: z.enum(Role, "Role must be either agent or admin"),
});
```

All four keys are **required to be present**; `password` may be the empty string but may not be omitted, and `role` must be one of the two enum members. There is still no `.strict()`, so any *other* additional key is silently stripped rather than rejected (see [[13-cross-cutting]]) — GH-8 deliberately did not change that, since rejecting unknown keys is a wider contract change than the story called for.

**Fields destructured:**

```typescript
const { name, email, password, role } = data;
```

**Order of checks**, chosen so nothing is written on a rejected request:

1. **Validation** → 400 (this is where a missing or unsupported `role` stops).
2. **Target row loaded** → 404 when the id matches no user. New in GH-8, and needed by both rules below.
3. **Self role change refused** → 403 `"You cannot change your own role"` when the caller's own id is the target and `role` differs from the stored one. Placed before the uniqueness check so an authorization refusal is never masked by a data conflict.
4. **Email uniqueness** → 409 when another user already holds the email.

**Prisma writes — two statements, only the first transactional:**

1. Always — the profile write, with the demotion session drop batched into the **same
   transaction** so the role and the sessions can never disagree:

   ```typescript
   const demoted = target.role === Role.admin && role === Role.agent;

   await prisma.$transaction([
     prisma.user.update({
       where: { id: id },
       data: { name, email, role, updatedAt: new Date() },
     }),
     ...(demoted
       ? [prisma.session.deleteMany({ where: { userId: id } })]
       : []),
   ]);
   ```

2. Conditionally, when `password` is truthy — **outside** that transaction:

   ```typescript
   await prisma.account.updateMany({
     where: { userId: id, providerId: "credential" },
     data: { password: hashedPassword, updatedAt: new Date() },
   });
   ```

GH-8 chose the transaction for step 1 specifically so a demoted user is never left holding live
session rows — the one divergence here with an authorization consequence. The profile/password
split in step 2 is untouched and still non-transactional: a failure between the two leaves the
profile saved and the password unchanged. That remains [[tech-debt|TD-10]].

**Post-write read** re-selects `{ id, name, email, role, createdAt }`.

**Response:** `200` with `{ user }`, including the **new** `role`.

**Error paths:** 400 on validation failure (including a missing or unsupported role) · 403 non-admin, **or an admin changing their own role** · 409 on an email already held by another user · 401 unauthenticated · 404 when the id matches no user.

### As-is baseline for role mutation — superseded by GH-8

Kept as a historical record. The "before" column is what this card documented up to
2026-09-08; the "after" column is current.

| Layer | Before GH-8 | After GH-8 |
|-------|-------------|------------|
| Validation contract | no `role` key | `role: z.enum(Role, …)`, **required** |
| Handler destructure | `{ name, email, password }` | `{ name, email, password, role }` |
| Prisma `data` | `{ name, email, updatedAt }` | `{ name, email, role, updatedAt }` |
| Client form | no role control rendered | two-option `Select`, edit mode only |
| Response | `role` selected and returned | unchanged |
| Database column | `role Role @default(agent)` | unchanged — **no migration was needed** |
| Target-row read | none | loaded before writing, for the guards below |
| Unknown id | Prisma `P2025` → Express default handler → **500** | **404** |

Before GH-8 a request carrying `role` was accepted with a 200 and the role silently
ignored — stripped by Zod before the handler saw it. That is still true of
`POST /api/users`, which remains agent-only by design.

## Validation

`updateUserSchema`, chosen over the create schema by mode at `UserForm.tsx:47` and applied server-side at `routes/users.ts:74`. The same schema on both sides is the house pattern ([[08-standards/observed]]); the server call is the gate, the client call is the affordance.

## UI states

As [[create-user]], differing in: an "Edit User" title, the form pre-populated from the row, a "Save Changes" label, "Saving…" while submitting (`:147`), and an empty password permitted.

## Tests

**Component:** `pages/UserForm.test.tsx` (28 tests) — pre-population, the button label, the password placeholder, submitting with and without a password, the success callback, the loading state, validation still applying to a supplied password, and error display on failure. Since GH-8 also: the role control pre-selected from the user's stored role for both roles, exactly two options offered, promotion and demotion each reaching the `PUT` payload, and the control's **absence** in create mode.

**E2E:** `e2e/tests/users.spec.ts` (30 tests) — the dialog opens pre-populated with an empty password field and the "leave blank to keep current" placeholder; editing name and email together updates the table and the old values disappear. Since GH-8, a `Role management` describe covers the transitions and their authorization boundary, including the two session-scoped cases described in [[auth]].

**Gotcha for anyone adding a component test here.** `TicketDetailPage.test.tsx:13-28` replaces `window.PointerEvent` with an `Event` subclass to satisfy Radix. Copying that block wholesale into a form test **breaks native click-to-submit** — Radix opens on `pointerdown`, but submitting a form needs a real `MouseEvent` click, so every submit assertion fails while the dropdown still appears to work. `UserForm.test.tsx` stubs only the pointer-capture methods and `scrollIntoView`, which is all Radix actually needs.

## Related

[[user-management]] · [[create-user]] · [[delete-user]] · [[view-users-list]] · [[05-api-surface]] · [[07-data-model]] · [[13-cross-cutting]] · [[11-testing]]
