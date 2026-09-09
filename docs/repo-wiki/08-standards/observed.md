---
tags: [standards, observed, patterns]
---

# Observed Standards

> De-facto patterns sampled from code by `explore-02-standards-extractor` via `/setup-05-explore global` on 2026-09-07. Sample sizes and adherence counts below.
>
> **Excluded from all counts:** `server/src/generated/prisma/` (~11,930 LOC of gitignored generated Prisma client) and the internals of `client/src/components/ui/` (~1,351 LOC of vendored shadcn primitives). Including either would swamp frequency counts with code the project did not write. See [[recon]] Correction log.

## Headline

Adherence to the declared conventions is unusually high — most declared rules sit at 100% of sampled sites. The gaps that exist are **structural** (missing server tooling, no enforcement) rather than behavioural. See [[conflicts]].

## Runtime and tooling

**Bun**: 100% — root `package.json` declares workspaces, all package scripts use `bun`, `bun.lock` present, no `package-lock.json` or `yarn.lock`.

**TypeScript**: 100% — all 92 source files are `.ts`/`.tsx`; no `.js`/`.jsx` source files.

## Import patterns

### Path aliases

**Client `@/` alias**: 78 imports across 34 files. Sample:

- `client/src/pages/UsersPage.tsx:22` — `import ErrorAlert from "@/components/ErrorAlert"`
- `client/src/pages/UserForm.tsx:12` — `import { Button } from "@/components/ui/button"`
- `client/src/components/ReplyForm.tsx:7` — `import { Textarea } from "@/components/ui/textarea"`
- `client/src/pages/TicketsTable.tsx:15` — `import ErrorAlert from "@/components/ErrorAlert"`

**Adherence**: 100% — no relative component/UI imports found in sampled pages and components.

### Zod imports

`import { z } from "zod/v4"` — **3 of 3** schema files: `core/schemas/tickets.ts:1`, `core/schemas/users.ts:1`, `core/schemas/replies.ts:1`. **100%.**

### Axios vs fetch

**Axios**: 18 imports across 18 client files. **`fetch` calls: 0.** **100%.**

## Server conventions

15 endpoints surveyed across 5 route files: `tickets.ts` (5), `users.ts` (4), `replies.ts` (4), `webhooks.ts` (1), `agents.ts` (1).

### Try/catch in route handlers

**0 try/catch blocks** across 15 route handlers. The Express 5 auto-catch convention is followed at **100%**.

### Validation via the `validate` helper

**6 of 6** body-validation sites:

- `routes/tickets.ts:64` (`ticketListQuerySchema`), `routes/tickets.ts:138` (`updateTicketSchema`)
- `routes/users.ts:23` (`createUserSchema`), `routes/users.ts:74` (`updateUserSchema`)
- `routes/replies.ts:42` (`createReplySchema`), `routes/replies.ts:119` (`polishReplySchema`)

**100%.**

### ID param parsing via `parseId`

**5 of 5** numeric ID params: `routes/tickets.ts:110,132`, `routes/replies.ts:14,36,71`.

**Domain-appropriate deviation, not a violation:** `routes/users.ts:72,107` use `req.params.id as string` without `parseId`. User IDs are UUIDs (strings), and `parseId` is typed for `number`. Counted as out-of-population rather than non-compliant.

### `Role` constant vs string literals

**13 uses** of `Role.admin` / `Role.agent` across 8 files (`server/src/routes/users.ts:45,115`, `server/src/middleware/require-admin.ts:5`, `server/prisma/seed.ts:38,71`, `server/src/lib/auth.ts:21`, `client/src/components/AdminRoute.tsx:16`, `client/src/components/Layout.tsx:56`, `client/src/pages/UsersTable.tsx:86,103`, `e2e/fixtures/auth.ts:12`).

**String literals in role checks: 0.** **100%.**

## Client conventions

### React Hook Form + zodResolver

**3 of 3** forms use both: `pages/LoginPage.tsx:3,37-39`, `pages/UserForm.tsx:1,42-54`, `components/ReplyForm.tsx:1,28-30`. **100%.**

### TanStack Query

Sampled 5 data-fetching components, all using `useQuery`/`useMutation`: `pages/UsersPage.tsx:2`, `pages/UserForm.tsx:9`, `pages/TicketsTable.tsx:3`, `components/ReplyForm.tsx:3`, `pages/TicketDetailPage.tsx:3`.

**`useEffect` + `useState` for data fetching: 0 files.** Two files use both hooks for non-fetching purposes — `pages/TicketsTable.tsx:107-109` resets pagination when filters change, and `lib/theme.tsx:21-29` syncs theme to DOM/localStorage. **100%.**

> `TicketsTable.tsx:107-109` is directly relevant to GH-4: pagination reset on filter change is already implemented there, which bears on AC6.

### Error components

`ErrorAlert` — 5 of 5 sampled mutation-heavy components: `pages/UsersPage.tsx:22,92`, `pages/UserForm.tsx:22,138-143`, `components/ReplyForm.tsx:9,63,66`, `pages/TicketsTable.tsx:15,154`, `pages/LoginPage.tsx:17,91`.

`ErrorMessage` — 3 of 3 sampled forms: `pages/UserForm.tsx:23,90,104,118`, `pages/LoginPage.tsx:18,103,114`, `components/ReplyForm.tsx:10,75`.

**100% on both.**

### Semantic colour tokens

**Hardcoded Tailwind colours outside `components/ui/`: 0 files.** Semantic tokens: `bg-*` in 18 files, `text-*` in 20 files. Sample: `pages/UsersPage.tsx:98` (`bg-destructive text-white hover:bg-destructive/90`), `components/TicketDetail.tsx:20` (`text-muted-foreground`), `components/ReplyThread.tsx:15` (`text-foreground`). **100%.**

## Shared code conventions

### Union types vs enums

**TypeScript `enum` declarations: 0.** Union types with `as const` in `core/constants/`:

- `role.ts:1-6` — `const Role = { admin: "admin", agent: "agent" } as const`
- `ticket-status.ts:1-3`, `ticket-category.ts:1-7`, `sender-type.ts:1-3` — `as const` arrays plus derived union types

**100%** — consistent with the client's `erasableSyntaxOnly`.

## File naming

| Area | Convention | Adherence |
|------|-----------|-----------|
| Client pages + components | PascalCase | 30 of 30 |
| Server routes, lib, middleware | kebab-case | 16 of 16 |
| Core schemas + constants | kebab-case | 9 of 9 |

Two coexisting conventions split cleanly by area — PascalCase for React components, kebab-case for everything else. Consistent, and worth preserving.

## Test naming and distribution

**Component tests** (`*.test.tsx`) — 8 files: `pages/UserForm.test.tsx`, `pages/UsersPage.test.tsx`, `pages/TicketDetailPage.test.tsx`, `pages/TicketsPage.test.tsx`, `components/ReplyForm.test.tsx`, `components/ReplyThread.test.tsx`, `components/TicketDetail.test.tsx`, `components/TicketSummary.test.tsx`.

**E2E tests** (`*.spec.ts`) — 5 files: `e2e/tests/auth.spec.ts`, `ticket-detail.spec.ts`, `tickets.spec.ts`, `users.spec.ts`, `webhook-inbound-email.spec.ts`.

**Adherence: 100%** on the naming split.

**Distribution**: E2E suite 2,051 LOC ([[recon]]) vs server logic ~1,091 LOC — E2E is ~1.88× the server logic surface. Flagged in [[conflicts]] as inverting the declared policy.

> `pages/TicketsPage.test.tsx` is 400 LOC and is the file GH-4's AC7 will extend.

## Coverage thresholds

**None configured** — verified across `client/vite.config.ts`, `playwright.config.ts`, all `package.json` files; no `.nycrc`, no standalone `vitest.config.ts`. Combined with the absence of a build/test CI ([[00-scope]]), every quality gate is local-only and unenforced.

## Related

- [[declared]] — what configs and CLAUDE.md require
- [[conflicts]] — where declared and observed disagree
- [[12-build-deploy]] — the commands that run these checks
