---
tags: [recon]
---

# Reconnaissance — Helpdesk

> Baseline structural scan. Produced by `explore-01-recon-scout` on 2026-09-07.
> **Corrected 2026-09-07 by `/setup-02-recon`** — the scout's LOC counts included ~11.9k LOC of
> gitignored generated Prisma client, and its risk section missed the absence of a build/test CI.
> See [Correction log](#correction-log).

**Mode:** brownfield

## Stack fingerprint

**Frontend:**
- React 19.2.0
- TypeScript 5.9.3
- Vite 7.3.1
- shadcn/ui (Radix UI, lucide-react)
- Tailwind CSS 4.1.18
- React Router 7.13.0
- TanStack React Query 5.90.21
- React Hook Form 7.71.1 + Zod 4.3.6
- Axios 1.13.5

**Backend:**
- Express 5.2.1
- TypeScript 5.9.3
- Bun runtime (not Node)

**Database & ORM:**
- PostgreSQL
- Prisma 7.3.0
- 10 migrations applied

**AI & Integration:**
- OpenAI GPT via Vercel AI SDK (@ai-sdk/openai 3.0.33, ai 6.0.100)
- SendGrid inbound email parser 8.0.0 + mail SDK 8.1.6

**Auth:**
- Better Auth 1.4.18 (email/password, database sessions)

**Background Jobs:**
- pg-boss 12.13.0 (PostgreSQL-backed queue, runs in `pgboss` schema)

**Testing:**
- Vitest 4.0.18 (component tests)
- React Testing Library 16.3.2
- Playwright 1.58.2 (E2E tests)

**Tooling:**
- Package manager: Bun (bun.lock present at root)
- CI: GitHub Actions (`.github/workflows/claude.yml`)
- Observability: Sentry 10.42.0 (client + server)

## Overall size

| Metric | Count |
|--------|-------|
| **Source LOC (hand-written)** | **~10,079** |
| Generated code (gitignored, excluded) | ~11,930 |
| Source files | 92 |
| Sub-systems | 4 |
| Prisma migrations | 10 |

The generated figure is `server/src/generated/prisma/` — 11,930 LOC across 14 files, produced by
`prisma generate` and ignored via `server/.gitignore:36`. It is build output, not source: it is not
in git, it regenerates from `schema.prisma`, and it must not be read, reviewed, or counted as
system surface. Read `server/prisma/schema.prisma` instead.

**Language breakdown (source only):**

| Language | LOC | Files |
|----------|-----|-------|
| TypeScript / TSX | ~10,056 | 91 |
| SQL (migrations) | 163 | 10 |
| CSS | ~23 | 1 |

## Sub-system inventory

| Name | Path | Source LOC | Files | Projects | Modernity | Last Activity |
|------|------|-----------|-------|----------|-----------|---------------|
| core | `/core` | 139 | 9 | 1 | Modern | 2026-09-07 |
| client | `/client` | 5,363 | 52 | 1 | Modern | 2026-09-07 |
| server | `/server` | 2,526 | 23 | 1 | Modern | 2026-09-07 |
| e2e | `/e2e` | 2,051 | 8 | 1 | Modern | 2026-09-07 |

**What the LOC figures actually contain** — this changes the exploration ranking:

- **`server` 2,526 LOC is not 2,526 LOC of logic.** 1,435 of it is seed data (`prisma/seed.ts`,
  `seed-tickets.ts`, `seed-replies.ts` — fixtures, read once to learn the shape, never mapped line
  by line). Application logic is ~1,091 LOC across routes, lib and middleware. The server is the
  *smallest* real code surface after `core`, not the largest.
- **`client` 5,363 LOC includes ~1,351 LOC of shadcn/ui primitives** under
  `src/components/ui/` — vendored generated boilerplate, not project code. Hand-written client code
  is ~3,961 LOC, making the client the **largest genuine surface in the repo**.
- **`e2e` 2,051 LOC is comparable to the entire server.** For a repo whose CLAUDE.md says to prefer
  component tests and reserve E2E for real browser needs, that ratio is worth a look during the
  testing deep-dive.

**Notes:**
- All sub-systems are Bun workspace packages, not .NET solutions.
- `core` is a shared library package imported by `client` and `server` (`workspace:*` dependency).
- `e2e` is not listed in workspace array but treated as a sub-system (Playwright test suite).
- All timestamps are same-day — active development, no legacy code detected.

**Client detail:**
- 30 components
- 13 pages
- 8 test files (Vitest + React Testing Library)
- shadcn/ui components under `src/components/ui/`

**Server detail:**
- 5 route modules (`agents.ts`, `replies.ts`, `tickets.ts`, `users.ts`, `webhooks.ts`)
- Prisma schema: 6 models (`User`, `Session`, `Account`, `Ticket`, `Reply`, `Verification`)
- 4 Prisma enums (`Role`, `TicketStatus`, `TicketCategory`, `SenderType`)
- Seed scripts present (`seed.ts`, `seed-tickets.ts`, `seed-replies.ts`) — 1,435 LOC of fixtures
- 3 pg-boss queues (`classify-ticket`, `auto-resolve-ticket`, `send-email`), all registered in
  `src/lib/queue.ts`. Outbound email is live via SendGrid, not stubbed.

## Tech-era map

No legacy telltales found. All packages use modern tooling:
- Modern .NET not present (this is a JavaScript/TypeScript monorepo)
- No AngularJS, Bower, packages.config, .aspx, or pre-2015 patterns
- React 19 (latest), Vite 7 (latest), Prisma 7 (latest)
- Bun as runtime and package manager (cutting-edge tooling)

**Assessment:** brownfield but modern — real working source exists (so not greenfield, and
`/setup-05-explore` applies), with no migration debt and dependencies current as of 2026. "No legacy
debt" is a statement about age, not about coverage or correctness; neither was assessed in this pass.

## Recommended exploration plan

Ranked by size (smallest first) and centrality. Token estimates assume standard sampling depth.

Ranked by centrality, then by real hand-written size. Estimates below are revised down from the
scout's originals, which sized `server` at 14.5k LOC when its logic is ~1.1k.

| Order | Sub-system | Rationale | Est. Token Cost | Est. Wall-Clock | Notes |
|-------|------------|-----------|-----------------|-----------------|-------|
| 1 | core | Foundation — shared Zod schemas and constants used by client and server. 139 LOC, no dependencies, highest centrality. Map first to fix the domain vocabulary. | <5k | <10 min | No splitting needed |
| 2 | server | Backend — API surface, data model, job queue, auth. ~1,091 LOC of logic + 1,435 LOC of seed fixtures. Central to all behaviour and the whole AI pipeline. | 15-25k | 15-25 min | Read `prisma/schema.prisma`, never `src/generated/prisma/`. Skim seeds for shape only. The 3 queue workers in `src/lib/` are where the AI behaviour actually lives |
| 3 | client | Frontend — ~3,961 LOC hand-written across 13 pages and ~30 components. The largest genuine surface in the repo. | 25-40k | 25-40 min | Skip `src/components/ui/` (~1,351 LOC of shadcn primitives) |
| 4 | e2e | Playwright suite — 2,051 LOC, 8 files. Lower priority as system documentation, but see the risk callout on CI before deciding to skip. | 10-20k | 15-30 min | Best handled by `explore-12-test-coverage-mapper` rather than a full deep-dive |

**Total estimated cost for full deep-dive:** ~50-90k tokens, 65-105 minutes wall-clock.

**Split recommendation:** No sub-system needs sub-chunking. Largest genuine surface is ~4k LOC.

## Risk callouts

The scout reported "None." That was wrong on one count, and one of its stated positives was false.

**RISK — no build or test CI exists.** `.github/workflows/` contains exactly one workflow,
`claude.yml`, and it is a `@claude` mention responder triggered on issue and review comments. Nothing
in CI builds, type-checks, lints, or runs a test on push or pull request. This matters directly to
the Solvo cycle, because `solvo.json` sets `quality.tests.onPr: "run"` and ships `/dev-fix` to
remediate red pipelines — there is currently no pipeline that can go red. Every quality gate is
therefore local-only and depends on the agent or the human remembering to run it. Worth a decision
during `/setup-04-scope`: either stand up a CI workflow, or record deliberately that verification
stays local for this project.

**RISK — the e2e/server ratio is inverted relative to the stated testing policy.** CLAUDE.md says to
prefer component tests and reserve E2E for things that genuinely need a browser and server. The
Playwright suite (2,051 LOC) is comparable in size to the whole server (2,526 LOC) and roughly double
its logic. Not a defect on its own, but it suggests the documented policy and the actual test
distribution may disagree. Confirm during the testing deep-dive.

**Corrected from the scout's list of positives:** its claim of "no build output or generated code
polluting source counts" was false — `server/src/generated/prisma/` contributed ~11.9k LOC, 54% of
its reported total. Its other positives hold: small, modern, clean package separation, active
development, git history present, no orphaned dependencies.

**Advisory (unchanged):** this is a portfolio/demo project per `00-vision.md` — no real users, seeded
accounts only. Standard sampling depth is appropriate; exhaustive enumeration is not justified.
Note this describes current maturity, not a permanent boundary.

## Suggested first move

**Deep-dive `core` first** (`/setup-05-explore core`).

**Why:**
1. **Smallest** — 139 LOC, 9 files. Validates the toolkit in <10 minutes with minimal token spend.
2. **Highest centrality** — defines the domain vocabulary (`Role`, `TicketStatus`, `TicketCategory`, etc.) and shared schemas consumed by both client and server. Everything else references this.
3. **Zero dependencies** — pure Zod schemas and TypeScript constants. No need to understand external APIs before diving in.
4. **High signal** — despite tiny size, captures the domain model's edges (what statuses exist, what roles are valid, what a ticket/reply/user looks like).

After `core`, proceed to `server` (the API, data layer and the three queue workers where the AI
behaviour lives), then `client` (the largest hand-written surface), then `e2e` via the test-coverage
mapper.

## Correction log

| Date | By | Correction |
|------|-----|-----------|
| 2026-09-07 | `/setup-02-recon` | Excluded `server/src/generated/prisma/` (~11,930 LOC, 14 files, gitignored build output) from all counts. Repo source LOC 22,186 → 10,079; files 119 → 92; `server` 14,456 → 2,526. |
| 2026-09-07 | `/setup-02-recon` | Separated seed fixtures (1,435 LOC) and shadcn/ui primitives (~1,351 LOC) from hand-written logic, which re-ranked `client` as the largest genuine surface rather than `server`. |
| 2026-09-07 | `/setup-02-recon` | Revised full deep-dive estimate down: 90-155k tokens → ~50-90k; 85-145 min → 65-105 min. |
| 2026-09-07 | `/setup-02-recon` | Added two risk callouts where the scout reported "None": no build/test CI, and an e2e-to-server size ratio at odds with the documented testing policy. |
| 2026-09-07 | `/setup-02-recon` | Fixed internal contradiction: doc header said `Mode: brownfield` while the tech-era assessment said "greenfield codebase". Brownfield is correct. |
| 2026-09-07 | `/setup-02-recon` | Fixed miscounts: 5 models → 6, 3 enums → 4. |
