---
tags: [build, deploy, config, infrastructure]
---

# Build & Deploy — Helpdesk

> Mapped by `explore-04-build-deploy-mapper` via `/setup-05-explore global` on 2026-09-07.
> Three claims in the agent's original output were corrected against the code by the orchestrating command — see [Correction log](#correction-log).

**Deployment status:** a Dockerfile and `.dockerignore` exist and are complete. There is no CI, no compose file, and no orchestration or cloud deployment config.

## Package layout and build order

| Package | Path | Type | Build output | Notes |
|---------|------|------|--------------|-------|
| `core` | `/core` | Library | None | Pure source, consumed via `workspace:*` and TypeScript path mapping. No build step. |
| `client` | `/client` | React SPA | `/client/dist` | Vite build. Dev server on 5173. |
| `server` | `/server` | Express API | None | Bun runs TypeScript directly; `noEmit: true` (`server/tsconfig.json:15`). **Requires `prisma generate` first** — see [the onboarding trap](#onboarding-trap-prisma-generate-is-not-wired). |
| `e2e` | `/e2e` | Playwright suite | `/e2e/test-results`, `/e2e/playwright-report` | Not a workspace member; uses the root `package.json` and root `tsconfig.json`. |

**Dependency order**: `core` has no build step. `server` depends on `core` plus generated Prisma client. `client` depends on `core`. There is no build-time dependency between `client` and `server`.

**Critical path on a fresh clone**: `bun install` → `bunx prisma generate` (server) → `vite build` / `tsc -b` (client) → `bun src/index.ts` (server). **The Prisma step is manual** — no script wires it.

## Frontend build

**Config**: `client/vite.config.ts`.

- **Dev**: `cd client && bun run dev` → Vite on port 5173 (`vite.config.ts:33`), proxying `/api/*` to `process.env.VITE_API_URL || 'http://localhost:3000'` (`vite.config.ts:34-39`).
- **Production**: `cd client && bun run build` → `tsc -b && vite build` (`client/package.json:8`). Type-checks via project references (`tsconfig.app.json`, `tsconfig.node.json`), then outputs to `/client/dist`. Source maps are `"hidden"` (`vite.config.ts:23`) — uploaded to Sentry when configured, not served.

**Plugins**: `@vitejs/plugin-react`, `@tailwindcss/vite`, and `@sentry/vite-plugin` (`vite.config.ts:15-20`) which is **inert unless `SENTRY_AUTH_TOKEN` is set**.

**Vitest is configured inside the Vite config** (`vite.config.ts:41-50`): `jsdom`, setup file `./src/test/setup.ts`, globals enabled, `@tanstack/react-table` inlined. There is no separate `vitest.config.ts`.

## Backend build

Express 5 on Bun, no transpile step. `server/tsconfig.json` targets `ESNext` with `module: Preserve`, `strict: true`, `noEmit: true`, and the `core/*` → `../core/*` path alias (line 30).

- **Dev**: `cd server && bun run dev` → `bun --watch src/index.ts` (`server/package.json:7`). Full process restart on change, not hot reload.
- **Production**: `bun run server/src/index.ts` (see `Dockerfile:40`).

**The server serves the client's static build** — confirmed at `server/src/index.ts:73` (`app.use(express.static(clientDist))`). So the Docker image is a single service on port 3000 handling both the API and the SPA; the Vite dev server and its proxy exist only for local development.

### Prisma

- Schema: `server/prisma/schema.prisma` — 6 models, 4 enums
- Generated client output: `server/src/generated/prisma` (`schema.prisma:9`), **gitignored** at `server/.gitignore:36`, ~11,930 LOC
- Migrations: 10, in `server/prisma/migrations/`
- Generation and local migration are manual; the Dockerfile automates `migrate deploy` at container start

### Onboarding trap: `prisma generate` is not wired

`server/src/generated/prisma/` is gitignored build output, and **nothing runs `prisma generate` automatically**. Verified: no `postinstall` or `prepare` hook in any `package.json`.

Consequences on a fresh clone:

- The server will not start — module resolution fails on the generated client
- Type-checking fails for the same reason
- Any future CI would fail at type-check unless generate runs first

`Dockerfile:20` handles this correctly. Local developers are on their own. Recorded as friction, not scheduled — [[00-scope]].

## CI — what exists and what does not

**There is no build or test CI.** `.github/workflows/` contains exactly one file, `claude.yml`:

- Triggers on `issue_comment`, `pull_request_review_comment`, `issues`, `pull_request_review` (`claude.yml:3-11`)
- Gated on the body containing `@claude` (`claude.yml:16-19`)
- Runs `anthropics/claude-code-action@v1` (`claude.yml:35`)

It is a mention responder. Nothing runs on push or pull request: no type-check, no lint, no tests, no `prisma validate`, no migration diff.

`solvo.json` nonetheless sets `quality.tests.onPr: "run"`. That mode is declared with nothing to enforce it. Per [[00-scope]]: **an absent pipeline is not a green pipeline** — no artefact may claim CI passed; the honest claim names the local command and its result.

Standing up CI is deliberately out of scope this horizon.

## Local verification commands

These stand in for CI. All verified present.

| Purpose | Command | Notes |
|---------|---------|-------|
| Component tests | `cd client && bun run test` | Vitest single pass (`client/package.json:11`). 8 test files. No coverage reporter configured. **The relevant axis for GH-4.** |
| Component tests (watch) | `cd client && bun run test:watch` | `client/package.json:12` |
| E2E | `bun run test:e2e` | Playwright. Also `:ui` and `:headed` variants (`package.json:6-8`). |
| Client lint | `cd client && bun run lint` | ESLint 9 (`client/package.json:9`). No server equivalent exists. |
| Client type-check | `cd client && bunx tsc -b` | |
| Server type-check | `cd server && bunx tsc --noEmit` | Requires generated Prisma client |
| Schema validation | `cd server && bunx prisma validate` | Not wired into any script |
| Backend tests | — | None exist (`solvo.json:50`) |

There is no aggregate lint or type-check script at root.

**E2E runs unattended — on a POSIX shell.** `playwright.config.ts:22-33` declares a `webServer` block that starts both the server (port 3001) and client (port 5174). `e2e/global-setup.ts` then does three things, in order: `prisma migrate reset --force` against `helpdesk_test` (`:18`), the seed (`:26`), and `prisma db execute` of `e2e/clear-job-queue.sql` to truncate pg-boss's job backlog (`:38`, added by GH-8 — see [[11-testing]] for why the reset alone is not enough). No manual setup needed beyond a reachable PostgreSQL and a populated `server/.env.test`.

**It does not run unattended on Windows.** The client entry's command is
`VITE_API_URL=http://localhost:3001 bun run --cwd client vite --port 5174`
(`playwright.config.ts:29`) — POSIX inline-env syntax, which `cmd.exe` cannot execute, so
`webServer` fails with `'VITE_API_URL' is not recognized...` and no test runs. The workaround is to
start both servers yourself from a POSIX shell first; `reuseExistingServer: !process.env.CI` then
adopts them. Pre-existing and unrelated to any one story, but it means "unattended" holds on
Linux/macOS and CI only. A `cross-env`-style fix, or moving the variable into the client's own env
file, would close it.

## Containerization

`Dockerfile` — 41 lines, 3 stages, base `oven/bun:1` throughout. `.dockerignore` is present (97 bytes).

1. **Install** (`:2-10`) — copies the four `package.json` files first for layer caching, then `bun install --frozen-lockfile` (`:10`).
2. **Build** (`:13-21`) — copies `node_modules` and source, then `bunx prisma generate` (`:20`) and `bunx vite build` (`:21`).
3. **Production** (`:24-40`) — copies `node_modules`, the client build (`:28`), server + core + root manifest (`:30-32`), and overlays the generated Prisma client from the build stage (`:35`). Sets `NODE_ENV=production` (`:37`), exposes 3000 (`:38`).

**CMD** (`:40`): `cd server && bunx prisma migrate deploy && cd .. && bun run server/src/index.ts` — migrations apply on every container start.

Gaps: `node_modules` is copied whole rather than pruned to production deps; no `HEALTHCHECK`; single-platform; no image tagging or registry push anywhere.

## Infrastructure as code

**None.** Verified absent: `docker-compose.y*ml`, Kubernetes manifests, Helm charts, Terraform (`*.tf`), Bicep, Pulumi.

Against `implementation-plan.md:63-65` (Phase 8):

| Planned | State |
|---------|-------|
| Write Dockerfile for server and client | **Done** — one Dockerfile builds both |
| Set up Docker Compose for local development | **Not done** |
| Write deployment configuration | **Not done** |

PostgreSQL is not containerised, so local development requires a separately installed and running instance.

## Environments

| Environment | Config | Notes |
|-------------|--------|-------|
| Development | `server/.env.example`, `client/.env.example` (both present) | Developer populates `.env` by hand. PostgreSQL assumed local. |
| Test (E2E) | `server/.env.test` (present) | Separate database `helpdesk_test`, ports 3001/5174, and a deliberately fake `BETTER_AUTH_SECRET` of `"test-secret-do-not-use-in-production"`. |
| Production | `Dockerfile:37` sets `NODE_ENV=production` | No config file. Env vars expected from the container runtime. |

No staging or UAT. Configuration differs only by environment variable — same code, no per-environment config loader.

## Environment variables

Gathered from actual `process.env.*` reads, not only from the `.env.example` files.

### Server

| Variable | Required | Failure mode | Evidence |
|----------|----------|--------------|----------|
| `DATABASE_URL` | Yes | **Loud** — Prisma throws on first query | `server/src/db.ts:4` |
| `BETTER_AUTH_SECRET` | Yes | **Loud at startup** — throws | `server/src/index.ts:18-19` |
| `WEBHOOK_SECRET` | Yes in practice | **Warns at startup, then fails per-request** — logs a warning and continues; webhook endpoints return 500 | `server/src/index.ts:81-82`, enforced in `middleware/require-webhook-secret.ts` |
| `OPENAI_API_KEY` | Yes | **Loud at first use** — AI SDK throws in the classify / auto-resolve / suggest workers | Read implicitly by `@ai-sdk/openai` |
| `SENDGRID_API_KEY` | Yes | **Loud at first email send** — non-null assertion | `server/src/lib/send-email.ts:25` |
| `SENDGRID_FROM_EMAIL` | Yes | **Loud at first email send** — non-null assertion | `server/src/lib/send-email.ts:29` |
| `TRUSTED_ORIGINS` | Conditional | CORS rejects cross-origin requests when unset | `server/src/index.ts:28` |
| `BETTER_AUTH_URL` | Conditional | **Silent** — defaults to request origin; breaks behind a proxy without `X-Forwarded-*` | `server/.env.example:11`, not validated in code |
| `PORT` | No | Silent — defaults to 3000 | `server/src/index.ts:23` |
| `NODE_ENV` | No | Silent — gates rate-limit enforcement to production only | `server/src/index.ts:33` |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | No | Silent — Sentry disabled / defaults to `"development"` | `server/src/lib/sentry.ts:5-6` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Seed only | **Loud at seed time** — throws | `server/prisma/seed.ts:15-18` |

### Client

| Variable | Required | Failure mode | Evidence |
|----------|----------|--------------|----------|
| `VITE_API_URL` | No | Silent — defaults to `http://localhost:3000` | `client/vite.config.ts:36`. Dev-proxy only; unused in the Docker image, where Express serves the SPA. |
| `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT` | No | Silent — Sentry disabled | `client/src/lib/sentry.ts:5-6` |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Build only | Silent — plugin inert | `client/vite.config.ts:16` |

**Worth noting: two failure modes are deferred rather than prevented.** `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` are read behind non-null assertions inside the queue worker (`send-email.ts:25,29`), not validated at boot. A server missing either starts cleanly and fails only when the first email job runs — which, given auto-resolve emails senders unattended, means the failure surfaces on a real ticket rather than at deploy. `BETTER_AUTH_SECRET` by contrast throws at startup (`index.ts:18-19`), which is the better pattern. Recorded, not scheduled.

## Secrets

No centralised secrets management — everything is an environment variable. No Key Vault, Secrets Manager, or encrypted-secret tooling (verified absent from `server/src/`).

`.gitignore:3-6` excludes `.env` and `.env.*` except `.env.example`. The Dockerfile correctly copies no `.env` file and uses no BuildKit secret mounts; secrets are expected at runtime.

## Database deployment

Schema of record is `server/prisma/schema.prisma`. Ten migrations, in order:

| Migration | Change |
|-----------|--------|
| `20260210185444_add_better_auth_tables` | `User`, `Session`, `Account`, `Verification` |
| `20260210200027_add_user_role` | `User.role` |
| `20260210200100_change_role_to_enum` | `role` → enum (`admin`, `agent`) |
| `20260218190509_add_user_deleted_at` | `User.deletedAt` soft delete |
| `20260219170454_add_ticket_model` | `Ticket` + `TicketStatus`, `TicketCategory` |
| `20260224164447_add_reply_model` | `Reply` + `SenderType` |
| `20260225181704_add_body_html_to_reply` | `Reply.bodyHtml` |
| `20260227155141_add_new_and_processing_ticket_status` | `new`, `processing` added to `TicketStatus` |
| `20260227155314_change_ticket_default_status_to_new` | `Ticket.status` default `open` → `new` |
| `20260302000000_add_get_ticket_stats_function` | `get_ticket_stats()` SQL function (raw SQL) |

**Production**: `Dockerfile:40` runs `prisma migrate deploy` before starting the server, on every start. **No rollback strategy** — a failed migration means the container fails to start, and recovery is manual.

**pg-boss owns its own schema.** It auto-creates and migrates the `pgboss` schema in the same database (`server/src/lib/queue.ts`), outside Prisma's control. No pg-boss migrations exist in the repo.

**Seeds** are idempotent — `seed.ts` checks for the existing admin and AI-agent users before inserting (`seed.ts:24,59`).

## Risks

| Risk | Evidence | Impact |
|------|----------|--------|
| No CI enforcement | Only `claude.yml` exists | Every quality gate is local and unenforced. Out of scope per [[00-scope]]. |
| SendGrid vars fail late, not at boot | `send-email.ts:25,29` | Server starts clean, then throws on a real ticket's auto-resolve reply |
| `prisma generate` unwired | No `postinstall` hook | Fresh clone cannot type-check or run the server |
| No migration rollback | `Dockerfile:40` | Failed migration blocks container start; manual recovery |
| No health check | No `HEALTHCHECK` directive | Orchestrators cannot assess container health |
| Image goes nowhere | No registry or push configured | No deployable, retained artifact |
| Single database for app + queue | pg-boss in the app's PostgreSQL | One outage stops tickets and background jobs alike. Acceptable at current maturity. |

**External single points of failure**: PostgreSQL (app data + queue), SendGrid (no fallback provider — blocks all outbound mail), OpenAI (no fallback or circuit breaker — blocks classification, auto-resolution and suggested replies).

## Correction log

| Date | Correction |
|------|-----------|
| 2026-09-07 | Agent reported "No `.dockerignore` file found". **It exists** (97 bytes, repo root). Corrected. |
| 2026-09-07 | Agent listed static file serving as assumed-but-unverified. **Confirmed** at `server/src/index.ts:73` (`app.use(express.static(clientDist))`). Stated as fact. |
| 2026-09-07 | Agent classified `WEBHOOK_SECRET` as "Loud — startup validation throws". **It does not throw** — `server/src/index.ts:81-82` logs `console.warn` and continues; webhook endpoints then return 500. Reclassified as warn-at-startup, fail-per-request. |

## Related

- [[recon]] — stack fingerprint, sub-system sizes, risk callouts
- [[00-scope]] — quality posture, local verification, CI recorded as debt
- [[00-vision]] — maturity and boundaries
- [[08-standards/conflicts|standards conflicts]] — why the absent CI leaves every standard advisory
- [[dependencies]] — `--frozen-lockfile` implications
