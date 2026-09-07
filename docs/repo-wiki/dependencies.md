---
tags: [dependencies, audit]
---

# Dependencies — Helpdesk

> Audited by `explore-03-dependency-auditor` via `/setup-05-explore global` on 2026-09-07.

## How to read this doc

**Version currency claims here came from network lookups performed on 2026-09-07 and will age.** Re-verify before acting on any upgrade recommendation. Every package below is labelled either **checked** (an advisory or release source was consulted) or **not checked** (version recorded from the manifest only). The second category is not a clean bill of health.

Lookups were scoped deliberately rather than run across all 61 packages, because [[00-vision]] records this as a portfolio/demo project — single-tenant, no real users, no real PII, no compliance obligation. Effort went to packages handling untrusted external input and packages on recently-released majors where ecosystem breakage is the real risk. Exhaustive CVE sweeps across 50 current dev-tooling packages would not have been proportionate.

## Summary

| | |
|---|---|
| Direct dependencies | 61 (root 3, core 1 peer, client 53, server 21) |
| Lockfile | `bun.lock` committed at workspace root |
| Package manager | Bun (`workspace:*` protocol for local packages) |
| Checked against a source | 11 packages / groups |
| Version recorded only | ~50 packages |
| Flagged behind | 4 |

## Flagged packages

Four packages are materially behind current stable. **None of these is in GH-4's path** — GH-4 is a client-only filter change touching React, TanStack Query and TanStack Table. Upgrades are out of scope for the current horizon per [[00-scope]]; they are recorded here for a future horizon.

### 1. `better-auth` — 1.4.18 → 1.7.3 (client + server)

**Checked.** Used at `client/package.json:22` and `server/package.json:28`. Trails the entire 1.5, 1.6 and 1.7 series.

Security-relevant changes in the intervening releases, per the project's own release notes:

| Version | Change |
|---------|--------|
| 1.7.1 | SAML signature verification validates signatures on the raw assertion rather than trusting an already-parsed response |
| 1.7.2 | Tighter validation of relative callback and redirect URLs |
| 1.7.3 | Schema validation at init, including in production; rejects auth requests on detected mismatch |
| 1.6.29 / 1.6.30 | Email-domain org assignment now requires both a verified provider domain and a verified user email |
| 1.7.0 | S256 PKCE enforcement in the Electron flow; DPoP sender-constrained tokens (RFC 9449) |

**Breaking changes in 1.7.0**: `joins` moved to `advanced.database.joins`, MCP plugin relocated to `@better-auth/mcp`, deprecated `oidcProvider` removed, generic OAuth plugin rewritten.

**Target 1.7.3 specifically**, not 1.7.0–1.7.2 — 1.7.3 restored the 1.6 account core schema, avoiding a backfill that the intermediate versions required. Client and server must move together.

**Proportionality note**: several of the fixes above (SAML, DPoP, Electron PKCE, org-join domains) are in features this repo does not use — it runs email/password with database sessions. The redirect/callback validation hardening (1.7.2) and init-time schema validation (1.7.3) are the ones that plausibly touch this codebase.

### 2. `ai` — 6.0.100 → 6.0.277, and `@ai-sdk/openai` — 3.0.33 → 3.0.109 (server)

**Checked.** `server/package.json:26` and `:19`. 177 and 76 patch releases behind respectively, within their current majors. A 7.x line for `ai` (7.0.93) and a matching 4.x for the provider also exist.

**These two must move together.** Provider packages pin to a specific `ai` major — `@ai-sdk/openai@3.x` pairs with `ai@6.x`, `4.x` with `7.x`. Mixing majors breaks the pairing.

Central to the product's value proposition (classification, auto-resolution, suggested replies), so the accumulated fixes are worth capturing — but within-major, which keeps friction low. Moving to 7.x is a larger change and should wait.

### 3. `zod` — 4.3.6 → 4.5.4 (core peer dep, client, server)

**Checked.** `core/package.json:10` (peer `^4`), `client/package.json:36`, `server/package.json:37`. Nine releases behind.

- **4.4.0** contains soundness fixes — stricter string validators, tuple defaults, JSON Schema corrections. Explicitly breaking for inputs that were previously accepted while invalid.
- **4.5.0** adds `z.compile()`, `z.creditCard()`, `z.properties()`, `z.deepPartial()`, `z.validate()`, a ~9× memory-footprint reduction, and 8 new locales.

Highest blast radius of the four — used in all three workspaces, so one upgrade moves everything. The stricter validation is a correctness gain but may surface latent bugs where lax input was tolerated. With no server test suite ([[00-scope]]), the client component tests are the only automated safety net for this change.

## Moderate — behind, no confirmed security impact

| Package | Current | Latest known | Gap | Where | Status |
|---------|---------|--------------|-----|-------|--------|
| `react` / `react-dom` | 19.2.0 | 19.2.8 | 8 patches | client | Checked. Performance and RSC fixes. Skip 19.2.6 (Server Actions `FormData` regression, fixed in 19.2.7). |
| `vite` | 7.3.1 | 8.2.2 | 1 major | client | Checked. 8.x is current; 7.3.1 is on the prior major. Source page had loading errors — advisories not exhaustively confirmed. |
| `tailwindcss` / `@tailwindcss/vite` | 4.1.18 | 4.3 | 2 minors | client | Checked. Both pinned to the same version, which is correct. Incremental within 4.x. |
| `vitest` | 4.0.18 | 4.1.11 (5.0.0 exists) | 1 minor | client | Checked. 4.1.11 is bug fixes. 5.0.0 requires Node 22 + Vite 6.4 — breaking. |
| `@playwright/test` | `^1.58.2` | 1.63.0 | 7 releases | root | Checked. Bundled browsers also behind (Chromium 145 → 153). |

## Cross-cutting packages

High blast radius — a change moves more than one workspace.

| Package | Workspaces | Note |
|---------|-----------|------|
| `zod` | core (peer `^4`), client, server | One upgrade affects all three |
| `better-auth` | client, server | Must move in lockstep |
| `core` | client, server (`workspace:*`) | Local; a breaking change to `core` hits both consumers with no version buffer |
| `dotenv` | root `^17.3.1`, server `^17.2.4` | Benign patch drift within 17.x |
| `@types/node` | root `^25.2.3`, client `^24.10.1` | Benign — type definitions, different major is normal |

## Unusual constraints

| Package | Constraint | File | Note |
|---------|-----------|------|------|
| `recharts` | `2.15.4` — exact, no range | `client/package.json:33` | Blocks patch updates. Worth confirming whether this pins around a known-bad release or is accidental. |
| `@types/bun` | `latest` — a tag, not a range | `server/package.json:10` | Resolves to newest on every install. Unusual for `@types/*`; can introduce type breakage with no manifest change. `bun.lock` mitigates this until someone updates the lock. |
| `typescript` | `~5.9.3` — tilde | `client/package.json:55` | Deliberate conservatism; patches only. Satisfies the server's `^5` peer dep. |

## Peer dependencies

No tension found. React 19.2.0 aligns with `@types/react` 19.2.7; Vite 7.3.1 with `@vitejs/plugin-react` 5.1.1; Tailwind 4.1.18 matches `@tailwindcss/vite` 4.1.18 exactly; client `typescript ~5.9.3` satisfies the server's `^5`; `zod ^4.3.6` satisfies core's `^4`.

## Lockfile

`bun.lock` is committed at workspace root, so every install resolves identically regardless of when it runs. After any dependency change, commit the updated `bun.lock` alongside the `package.json` edit — `Dockerfile:10` runs `bun install --frozen-lockfile`, which fails outright if the two disagree.

## Not verified in this pass

- **Unused / undeclared dependencies.** Not audited — needs a full import cross-reference. Candidates worth a later look: `@types/multer` (is Multer still imported, or left over from a removed upload path?), `tw-animate-css` (registered in the Tailwind config?), `shadcn` (CLI, expected as a dev dep).
- **Advisories for ~50 packages** whose versions were recorded from the manifest only, including `axios`, `dompurify`, `helmet`, `pg-boss`, `multer`, `cors`, `express-rate-limit`, and the dev tooling.
- **Latest-version confirmation** for `express` 5.2.1 and the Prisma 7.3.0 trio — the sources consulted did not carry version-support data.

## Suggested order, when a horizon exists for it

Not this horizon. Recorded for later: `zod` first (broadest reach, and the test suite is watching for validation changes), then `better-auth` to 1.7.3, then `ai` + `@ai-sdk/openai` within their majors, then React patches, `vitest`, `@playwright/test`, Tailwind. Defer Vite 8.x and `ai` 7.x until the rest is stable.

Taking `zod` before `better-auth` is deliberate: Zod's stricter validation may surface input-handling bugs in auth schemas, and it is better to meet those during a validation-focused upgrade than in the middle of an auth config migration.

## Related

- [[00-vision]] — demo maturity, which sets the proportionality of this audit
- [[00-scope]] — modernization and upgrades out of scope this horizon
- [[recon]] — stack fingerprint
- [[12-build-deploy]] — `--frozen-lockfile` in the Docker build

## Change log

| Date | Author | Change |
|------|--------|--------|
| 2026-09-07 | explore-03-dependency-auditor | Initial audit. 61 direct dependencies across 4 workspaces. Targeted checks on 11 packages/groups; ~50 recorded from manifest only. Flagged `better-auth`, `ai`, `zod`, `@ai-sdk/openai`. |
