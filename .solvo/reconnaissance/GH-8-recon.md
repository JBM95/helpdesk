# Reconnaissance: GH-8 — Allow admins to promote and demote users safely

**Work item:** GH-8
**Mapped:** 2026-09-08
**Mapper:** recon-worker (Sonnet 4.5)
**Repo mode:** Partial intelligence (client fresh, core/server/e2e un-explored)

## Staleness pre-check

Sub-systems affected:
- core — staleness: new (un-explored)
- server — staleness: new (un-explored)
- e2e — staleness: new (un-explored)
- client — staleness: fresh (explored 2026-09-07)

Churn measurement: All sub-systems report churn.source unavailable, measuredAt null.
Operator should run solvo churn before trusting age-based staleness tokens.

Proceeding with code-direct mapping for core, server, e2e since repo-wiki intelligence
does not exist. Client mapping uses repo-wiki where available.

## Conceptual areas

| Area | Slug | Status |
|------|------|--------|
| User role management | user-management | T3 domain |
| Authentication authorization | auth | T3 domain |
| API validation layer | core | Shared schemas constants |

## Code map

### 1. Core layer

core/constants/role.ts (7 lines): Defines Role.admin and Role.agent as const object plus type.

core/schemas/users.ts (21 lines):
- createUserSchema validates name (≥3 chars), email, password (≥8 chars)
- updateUserSchema same but password optional (empty string or ≥8 chars)
- Critical gap: neither includes role field

Blast radius: server/src/routes/users.ts:3-4, client/src/pages/UserForm.tsx:3-8

### 2. Server layer

server/src/routes/users.ts (135 lines)

All routes admin-protected via requireAuth plus requireAdmin:
- GET / (lines 13-20): Lists users excluding AI agent; returns id name email role createdAt
- POST / (lines 22-69): Creates user with role: Role.agent hardcoded (line 45)
- PUT /:id (lines 71-104): Updates name email password; does NOT update role
- DELETE /:id (lines 106-133): Admin-deletion protection lines 115-118; soft-deletes user;
  deletes all sessions line 130

Admin-deletion protection (lines 115-118): Checks user.role === Role.admin, returns 403.

Session invalidation (line 130): prisma.session.deleteMany({ where: { userId: id } })
Establishes DB-backed sessions can be invalidated server-side.

server/src/middleware/require-auth.ts (23 lines):
Calls auth.api.getSession(), populates req.user from session.user, checks session.user.deletedAt.

Critical question: Does session.user.role come from cached session or fresh User table join?

Better Auth config (server/src/lib/auth.ts:16-30) defines role and deletedAt as additionalFields
with input: false. Prisma schema shows role column on User table. Session references userId FK
but does not store role itself.

Hypothesis: Better Auth Prisma adapter likely joins Session to User on getSession(), meaning
session.user.role is fetched fresh. If correct, role changes take effect immediately.
Requires verification via docs or testing.

Alternative: If Better Auth caches user fields in session token, AC4 (demotion immediate effect)
would require session invalidation or force DB re-read.

server/src/middleware/require-admin.ts (10 lines):
Guards admin routes. Returns 403 if req.user.role !== Role.admin.

### 3. Client layer

client/src/pages/UserForm.tsx (120 lines):
Renders name, email, password. Does not render role field.
Uses createUserSchema (create) or updateUserSchema (edit).
Submits POST /api/users or PUT /api/users/:id.

client/src/pages/UsersPage.tsx (105 lines):
Hosts UserForm in dialog (create or edit mode). Delete confirmation.
Passes { id, name, email } to UserForm; role NOT passed.

client/src/pages/UsersTable.tsx (120 lines):
Displays table: Name, Email, Role, Created, Actions.
Role as Badge (admin default variant, agent secondary).
Edit button for all users. Delete button hidden for admins (line 103-112).
Queries GET /api/users.

User interface (line 18-24): role RECEIVED from API, not SENT.

## Blast radius

Files to modify:
1. core/schemas/users.ts — add role to updateUserSchema (create stays agent-only per AC6)
2. server/src/routes/users.ts — PUT route: accept, validate, apply role
3. client/src/pages/UserForm.tsx — add role Select (edit mode), pass in PUT
4. client/src/pages/UsersPage.tsx — pass role to UserForm for editing
5. client/src/pages/UsersTable.tsx — User interface already has role

Conditional: server/src/middleware/require-auth.ts or require-admin.ts
ONLY if Better Auth caches role and does not re-fetch (AC4 compliance).

Callers:
- core/schemas/users.ts imported by server/src/routes/users.ts:3,
  client/src/pages/UserForm.tsx:3. No other callers.
- Role constant: server/src/routes/users.ts:4, server/src/middleware/require-admin.ts:2,
  client/src/pages/UsersTable.tsx:3, client/src/pages/UsersPage.test.tsx:5

Database:
User.role column exists (Prisma schema line 46, default: agent).
Role enum (lines 16-19: admin, agent). No migration needed.

Test coverage:
Client: UsersPage.test.tsx (273 lines), UserForm.test.tsx (287 lines)
E2E: users.spec.ts (393 lines), auth.spec.ts (452 lines)
Server: None (per solvo.json: backend test suite does not exist)

## Prior work

Git: Single commit 65da45b created all files. No subsequent edits to role or user-management code.

Repo-wiki memories: No _capability-index.md. Grep for role in _memories/ returned zero results.

Patterns:
- Delete-protection (users.ts:115-118): checks role before delete. AC7 requires this survives.
- Session invalidation (users.ts:130): prisma.session.deleteMany. Precedent if AC4 needs manual invalidation.

Functional spec baseline:
specs.functionalDir empty, specs.badocsDir empty. No spec baseline. GH-8 ACs are authoritative.

## Gaps and unknowns

1. Better Auth session behavior (AC4 blocker):
   Does auth.api.getSession() fetch user.role fresh from User table or cache in Session?
   Resolution: read Better Auth docs/source for Prisma adapter, or test demotion with active
   session, or assume caching and invalidate sessions (conservative).

2. Role change on self:
   Should admin be allowed to demote self? Edge case not in ACs. If allowed, next request
   fails requireAdmin and locks out. If forbidden, add check: req.user.id === id && data.role
   !== Role.admin → return 403.

3. Role validation rigor:
   AC3 says only agent/admin accepted. Missing role in PUT payload: reject, leave unchanged,
   or default to agent? Consistent: reject if role key present but invalid; leave unchanged
   if omitted (partial update). Schema make role optional.

4. Test coverage AC4:
   No server tests. AC4 (active session) requires E2E with two browser contexts (admin demotes
   user, demoted user request fails) or manual QA. E2E feasible but complex.

5. Client role display during edit:
   Disable role dropdown for current user (prevent self-demotion UI) or server enforcement?
   Better UX to disable; simpler to allow and let server reject.

6. Seed data:
   server/prisma/seed.ts not read. If creates users, fixture roles should remain unchanged or
   be updated consistently.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Better Auth caches role (AC4) | Demoted admin retains privileges until re-login | Research Better Auth before implementing; add session invalidation if needed |
| Missing role validation | Agent promotes self via API | Enforce requireAdmin on PUT; validate role enum strictly |
| Self-demotion locks admin out | Admin demotes self, loses user management access | Add server check: reject req.user.id === targetUserId && newRole !== admin |
| Admin-deletion protection weakened | Demotion plus deletion bypasses current block | Preserve DELETE protection unchanged; test explicitly |
| Client tests break on mock data | UsersPage.test.tsx expects role in GET response | Update mock data to include role |

## Confidence check (7 of 7)

1. Every file changes touch — known? YES
   core/schemas/users.ts, server/src/routes/users.ts, client UserForm/UsersPage/UsersTable, tests.

2. Every caller every function modify — known? YES
   Grep traced updateUserSchema to server PUT and client form; Role to 4 locations; PUT route no internal callers.

3. Every test passing through code — known? YES
   UsersPage.test.tsx (273L), UserForm.test.tsx (287L), users.spec.ts (393L), auth.spec.ts. No server tests.

4. Established patterns area — known? YES
   Admin-deletion protection, session invalidation, admin-protected routes, Zod validation, shared schemas.

5. Feature flags / branching logic — known? YES
   None. No feature flags per repo-wiki cross-cutting.

6. Database / external state — known? YES
   User.role column exists (Prisma line 46), Role enum (16-19), Session FK. No migration needed.

7. Vault memories checked — known? YES
   No _capability-index.md; Grep role in _memories/ returned zero. No bug post-mortems for user-management/auth.

Confidence: 7/7 (with noted uncertainty about Better Auth session caching, addressable during build).

## Recommendation

Proceed to plan. Blast radius small (5-6 files, ~10 call sites for Role constant).
Patterns clear, tests exist to catch regressions. Better Auth session-caching question
only unknown that could expand scope; resolvable in Gate 2 (read docs or spike test).

Build order:
1. Spike: confirm Better Auth session behavior (fetch vs cache)
2. Add role field to updateUserSchema (optional, validates to admin or agent)
3. Server PUT route: accept role, validate it, update User.role
4. Client: add role Select to UserForm (edit mode only), pass it in PUT payload
5. Tests: update mocks, add role-change assertions, add AC4 E2E if feasible
6. Verify admin-deletion protection still works (existing test should catch regression)

No escalation recommended despite T3 domain classification. Change is additive (one field),
validation strict, auth middleware chain already enforces role checks.
