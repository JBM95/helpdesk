---
tags: [scope]
---

# Helpdesk — Scope (Current Horizon)

> Captured by `/setup-04-scope` on 2026-09-07. Horizon: sprint. Re-run with `/setup-04-scope refine` to update.

## Horizon

**Sprint** — no fixed calendar end date. The horizon closes when [GH-4](https://github.com/JBM95/helpdesk/issues/4)
is merged and the Solvo T2 Dev + QA lifecycle has been demonstrated end to end against it.

The purpose of this horizon is the *cycle*, not the feature. GH-4 was chosen because it is small,
deterministic and well bounded — a vehicle for exercising `/dev-ticket` → `/qa-plan` → `/qa-cases` →
`/qa-execute` → `/qa-verify` at T2, not because the Clear filters action is itself valuable enough to
plan a sprint around.

## IN scope

### Features

| Title | Sub-system | Priority | Notes |
|-------|------------|----------|-------|
| GH-4 — Add a Clear filters action to the Tickets page | client | P0 | Open issue, 7 ACs (AC1-AC7), tier hint **T2 / Medium** pending Solvo's own gate confirmation. Resets `search`, `status` and `category` together; preserves sort; resets to page 1. Issue names its own expected surface: `TicketsFilters.tsx`, `TicketsPage.tsx`, `TicketsPage.test.tsx`, and `TicketsTable.tsx` only if needed to prove sort/pagination are preserved. All four files verified present. |
| Solvo T2 Dev + QA lifecycle demonstration for GH-4 | — (process) | P0 | Work strictly necessary to complete and demonstrate the cycle: recon, plan, build, self-review, fresh review, QA plan/cases/execution/verification, evidence pack, PR. Bounded by GH-4 — this line does not authorise cycle work on any other item. |

**Nothing else is in scope.** Any work not required to land GH-4 or to demonstrate its cycle is out,
including work that would otherwise be sensible.

### Bugs / tech debt

| Title | Sub-system | Priority | Notes |
|-------|------------|----------|-------|
| — | — | — | None committed this horizon. Known debt is recorded below under [Quality posture](#quality-posture-and-recorded-debt) but explicitly not scheduled. |

### Refactors / modernization

| Title | Sub-system | Priority | Notes |
|-------|------------|----------|-------|
| — | — | — | None. Broad refactors and modernization are out for this horizon — see OUT table. |

## OUT of scope (deliberately)

| Title | Why deferred | Revisit when |
|-------|--------------|--------------|
| Non-email support channels (chat / phone / SMS / web form) | Strategic — left undecided by `00-vision.md`, and this horizon is not the place to decide it. Not a vision-level non-goal; genuinely open. | A horizon whose goal is channel strategy rather than cycle demonstration |
| Knowledge-base authoring UI | Strategic — same as above: deferred by the vision, still open, not decided here. | As above |
| Account provisioning | Strategic — a standing non-goal in `00-vision.md`, not merely deferred. Sign-up stays disabled; the admin is seeded and creates agents. | Only if the vision's boundary is revisited |
| Student-record management | Strategic — a standing non-goal in `00-vision.md`. The schema holds tickets and replies, not enrolments, courses or student profiles. | Only if the vision's boundary is revisited |
| Unrelated admin-friction improvements | Capacity + focus — Admin friction points were deliberately left blank in `00-vision.md` pending a `refine` pass. Nothing should be built against an uncaptured need. | After `/setup-01-vision refine` captures admin friction |
| Broad refactors / modernization | Risk — recon found no legacy debt and dependencies current as of 2026, so there is no forcing pressure. Refactoring during a cycle demonstration would confound the demonstration. | When a specific story requires it |
| Standing up a GitHub CI pipeline | Deliberate — recorded as debt, not as this sprint's work. Adding CI to support GH-4 would expand a deliberately small story into infrastructure work and blur what the cycle demonstration proves. | A horizon scoped to delivery infrastructure |

## Hard constraints

- **Compliance**: none applicable. `00-vision.md` records no real users and no real PII at current
  maturity, so there is no regulatory obligation to satisfy. This follows from maturity, not from a
  product boundary — real traffic would change it.
- **Performance**: no SLA agreed for this horizon. `solvo.json` carries `quality.p95Ms: 500` as a
  configured threshold; treat it as the tooling default in force, not a negotiated commitment.
- **Data**: single-tenancy is **settled**, not deferred — one organisation, one instance, no tenant
  dimension. No residency or sovereignty constraints, no real data to place.
- **Browser / device**: not captured. No support floor or accessibility level has been agreed. Worth
  deciding before any story where it would change the implementation; it does not change GH-4.
- **Integration**: **auto-resolved outbound email replies are sent to the sender automatically with
  no human approval** (`server/src/lib/auto-resolve-ticket.ts` → `send-email` queue → SendGrid).
  `ESCALATE` is the only path to a human. Any change touching the resolve or reply path can email a
  real address as a side effect. GH-4 does not touch this path and must not.
- **Cost**: no ceiling agreed. Cost exposure is the OpenAI API and SendGrid; unmetered for this
  horizon.

### Settled context (not constraints, but not up for re-litigation)

- **Single-tenancy is settled.** Promoted to a vision boundary on 2026-09-07.
- **Education is the demo scenario, not a permanent domain restriction.** Nothing forbids pointing
  the same machinery at another support domain later.
- **"Not production" describes current maturity, not a product boundary.** It is not a reason to
  lower craft standards, and it is not a ceiling on what the project may become.

## Quality posture and recorded debt

**Verification is intentionally local this horizon**, using the commands configured in `solvo.json`:

| Axis | Command | Status |
|------|---------|--------|
| Frontend | `cd client && bun run test` | Live — the relevant axis for GH-4 (Vitest + React Testing Library) |
| E2E | `bun run test:e2e` | Available (Playwright). Steady band — use only where a real browser is genuinely warranted, per CLAUDE.md's testing policy |
| Backend | — | No server test suite exists in this repo (`solvo.json` records this explicitly) |

GH-4's AC7 requires component/integration coverage of AC1-AC6, so the frontend axis carries the
verification weight for this story. `solvo.json` sets `quality.qa.requiredFromTier: "T2"` with
`mode: "warn"` — at GH-4's hinted T2 the QA obligation applies, and evidence belongs under
`.solvo/evidence/qa/`.

**INFRASTRUCTURE DEBT — no build or test CI exists.** `.github/workflows/` contains one workflow,
`claude.yml`, and it is a `@claude` mention responder triggered on issue and review comments. Nothing
in CI builds, type-checks, lints, or runs a test on push or pull request. Meanwhile `solvo.json` sets
`quality.tests.onPr: "run"`, and `/dev-fix` exists to remediate red pipelines.

This is recorded as a **current delivery limitation**, and carries two consequences that must not be
glossed:

1. **An absent pipeline is not a green pipeline.** No cycle artefact, evidence pack, or PR summary
   this horizon may state or imply that CI passed. The honest claim is that verification ran locally,
   naming the command and its result.
2. **Every gate is local-only and unenforced.** Nothing external prevents a merge with failing tests.
   The gate is the agent and the human remembering to run the command.

Fixing this is deliberately **out of scope** for this horizon.

## Sub-system priority ranking

Recon LOC figures are source only — they exclude the ~11,930 LOC of gitignored generated Prisma
client. The explorer agents use these bands to allocate sampling depth.

| Sub-system | Band | Why |
|------------|------|-----|
| client | **Critical** | GH-4 is a client-only change, and this is the sole sub-system receiving change work. Also the largest genuine surface in the repo (~3,961 LOC hand-written, excluding shadcn/ui primitives). The elevated band reflects it being the only area under change, not the volume of change — GH-4 itself is small. |
| core | Steady | 139 LOC of shared Zod schemas and constants. Highest centrality in the repo, so still worth mapping early despite the band; no change work planned. |
| server | Steady | ~1,091 LOC of logic plus 1,435 LOC of seed fixtures. GH-4 requires no API, database, auth, background-job or schema change. Unchanged this horizon. |
| e2e | Steady | 2,051 LOC Playwright suite. Used only where warranted — per CLAUDE.md, GH-4's ACs are component-test territory, not E2E. |

No sub-system is Frozen or Sunset.

## Change log

| Date | Author | Change |
|------|--------|--------|
| 2026-09-07 | setup-04-scope | Initial capture. Sprint horizon scoped to GH-4 and its T2 Dev + QA cycle demonstration. Resolved the two calls the vision deferred (non-email channels, KB-authoring UI) as OUT for this horizon while leaving both open at the vision level. Recorded absent CI as infrastructure debt, explicitly not scheduled. |
