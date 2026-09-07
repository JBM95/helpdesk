---
tags: [standards, conflicts, gaps]
---

# Standards Conflicts

> Declared-vs-observed mismatches, sampled by `explore-02-standards-extractor` via `/setup-05-explore global` on 2026-09-07.
>
> **Note on the recommendations below:** they are findings, not scheduled work. [[00-scope]] puts CI, broad refactors and modernization explicitly out of scope for the current horizon. Nothing here authorises a change.

## Summary

| Conflict | Severity | Effort to fix | Enforceable today? |
|----------|----------|---------------|--------------------|
| 5. No build/test CI | High | High | No — blocked by scope |
| 3. Test distribution inverts declared policy | Medium | High | Requires test refactor |
| 1. TypeScript strictness differs client vs server | Medium | Low | Yes — compiler flag |
| 2. No server ESLint | Low | Low | Yes — config + script |
| 4. No coverage thresholds | Low | Low | Yes — config |

The pattern worth noting: per-site adherence to the declared conventions is near-100% ([[observed]]). Every conflict below is about **missing enforcement or missing tooling**, not about developers ignoring the rules. That is a good position to be in, but it depends entirely on discipline.

---

## 1. TypeScript strictness inconsistency (client vs server)

**Declared**: both packages set `"strict": true`.

**Observed**:
- Client `client/tsconfig.app.json:21-22` — `noUnusedLocals: true`, `noUnusedParameters: true`
- Server `server/tsconfig.json:25-26` — both `false`

**Impact**: server code can accumulate unused variables and parameters with no compiler complaint, while client code cannot. Two tiers of strictness in one repo.

**Note**: the server's setting may well be deliberate — Express middleware signatures (`(req, res, next)`) frequently leave parameters unused, and `noUnusedParameters` is noisy against them. If so, the fix is the `_`-prefix convention plus a comment, not flipping the flag blind.

---

## 2. ESLint gap — no server linting

**Observed**: `client/eslint.config.js:1-23` is the only ESLint config in the repo. Verified: no `eslint.config.*` or `.eslintrc*` in `server/`, `core/`, or at root.

**Impact**: `bun run lint` exists for the client (`client/package.json:9`); there is no server equivalent. Server code is unlinted.

**Recommendation**: extend the client config to cover `server/src/**/*.ts`, or add `server/eslint.config.js`. If the omission is deliberate, record the reason in `CLAUDE.md` so it isn't "fixed" inconsistently later.

---

## 3. Test distribution inverts the declared policy

**Declared** (`CLAUDE.md:88-102`): "Prefer component tests for the majority of coverage. Reserve E2E tests for things that truly need a real browser + server… Never duplicate what component tests already cover."

**Observed**:
- E2E suite: 2,051 LOC across 5 Playwright specs ([[recon]])
- Server logic: ~1,091 LOC, excluding 1,435 LOC of seed fixtures ([[recon]])
- Ratio: **~1.88×**

**Impact**: the E2E suite is nearly twice the size of the server logic it exercises. That is the opposite shape from what the policy describes, and it carries the usual costs — slower feedback, more brittleness, higher maintenance.

**Caveat on the evidence**: this is a LOC comparison, which is a proxy. Playwright specs are verbose by nature (selectors, awaits, fixtures), so some of the ratio is syntax rather than scope. The finding is a prompt to audit the 5 specs, not proof of duplication. `webhook-inbound-email.spec.ts` in particular looks legitimately E2E — a webhook creating data that surfaces in the UI is exactly the full-stack case the policy carves out.

**Relevance to GH-4**: the story's AC7 asks for component/integration coverage, and its own scope note keeps it out of E2E. That is the declared policy working as intended.

---

## 4. No coverage thresholds configured

**Declared**: `CLAUDE.md:88-102` states a strong preference for tests, with no number attached.

**Observed**: verified absent — no `coverage` key in `client/vite.config.ts` or `playwright.config.ts`, no `.nycrc`, no standalone `vitest.config.ts`, no coverage flags in any `package.json`.

**Impact**: "prefer tests" is unenforceable without a threshold, and there is no gate against coverage regression.

**Consequence for calibration**: because no repo-configured threshold exists, there is nothing to reuse — the shipped fallback (`coverageLine: 80` / `coverageBranch: 75`) applies, and the no-tooling case calls for a `quality.coverageWaiver` recording why the gate is disarmed. This is a confirmed operator decision, not something this doc settles.

---

## 5. No build or test CI — the reason every conflict above is unenforced

**Declared**: `solvo.json` sets `quality.tests.onPr: "run"`, and `/dev-fix` exists to remediate red pipelines.

**Observed**: `.github/workflows/` contains exactly one file, `claude.yml`, a `@claude` mention responder triggered on issue and review comments. Nothing builds, type-checks, lints, or tests on push or PR.

**Impact**: every standard in [[declared]] is advisory. A PR can merge with failing tests, TypeScript errors, ESLint violations, or no tests at all. The conflict is not that the standards are wrong — it is that **no gate enforces them**.

**Per [[00-scope]]**: recorded as infrastructure debt, deliberately unscheduled this horizon. Two rules follow from that and apply to any work in the meantime:

1. An absent pipeline is not a green pipeline. No artefact may state or imply that CI passed.
2. The gate is the agent and the human remembering to run the command.

**If CI is stood up later**, the minimum set it should run: client lint, client + server type-check (`tsc`), `cd client && bun run test`, and `bun run test:e2e`. It must also run `prisma generate` first — see the onboarding trap in [[12-build-deploy]], without which type-check cannot succeed on a fresh checkout.

## Related

- [[declared]] — what configs and CLAUDE.md require
- [[observed]] — what the code actually does
- [[00-scope]] — records absent CI as deliberate debt
- [[12-build-deploy]] — the local commands that stand in for CI
