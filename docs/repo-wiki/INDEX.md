# docs/repo-wiki/ — Index & Mesh Map

> **Read this first.** This is the navigation entry-point for everything solvo produces. When you need to find something in `docs/repo-wiki/`, start here — don't grep the whole folder blind.

Everything in `docs/repo-wiki/` is generated and maintained by the solvo agents and commands in `.agents/`. Human edits are preserved when marked with `<!-- EDITED: yyyy-mm-dd by Name -->`.

---

## "I'm asking X — which doc?"

Pick the doc that answers your question. If your question spans multiple docs, follow the cross-references at the bottom of each.

| If you need to know… | Read this |
|----------------------|-----------|
| What this project IS / IS NOT, who the users are | `00-vision.md` |
| What's IN / OUT of scope right now, hard constraints, sub-system priorities | `00-scope.md` |
| One-paragraph system summary + entry point | `01-overview.md` |
| High-level architecture diagram and layers | `02-architecture.md` |
| Which bounded contexts exist | `03-domains/_index.md` |
| Everything about ONE domain (code, API, data, deps) | `03-domains/<slug>.md` |
| User-facing features inventory | `04-features/_index.md` |
| End-to-end trace of ONE feature (UI → API → DB) | `04-features/<slug>.md` |
| Master endpoint table | `05-api-surface.md` |
| Per-controller endpoint detail (DTOs, examples) | `05-api-surface/<Controller>.md` |
| Angular module / route / state map | `06-frontend-map.md` |
| Entities, tables, relationships, raw SQL hot spots | `07-data-model.md` |
| What configs require (declared) | `08-standards/declared.md` |
| What ~70% of code actually does (de-facto rulebook) | `08-standards/observed.md` |
| Where declared and observed disagree | `08-standards/conflicts.md` |
| Legacy artefacts grouped by area | `09-legacy/legacy-map.md` |
| Ranked tech-debt register | `09-legacy/tech-debt.md` |
| Security findings | `09-legacy/security-findings.md` (when present) |
| External integrations (auth, messaging, storage, payment, etc.) | `10-integrations.md` |
| Test stack, patterns, coverage gaps | `11-testing.md` |
| CI, environments, secrets, deployment | `12-build-deploy.md` |
| Auth, logging, caching, errors, validation, observability | `13-cross-cutting.md` |
| NuGet + npm inventory with EOL/risk | `dependencies.md` |
| Past architectural decisions (the WHY) | `_adr/_index.md` and `_adr/<NNNN>-<slug>.md` |
| Exploration progress (which sub-systems are mapped) | `_state/exploration-state.json` + `_state/recon.md` |
| State schema and resumability protocol | `_state/README.md` |
| Templates for new domain / feature / tech-debt entries | `_templates/` |

---

## Reading order for a new session

If you're new to this codebase, read in this order — each builds on the previous:

1. `00-vision.md` — identity (5 min)
2. `00-scope.md` — current priorities (5 min)
3. `01-overview.md` — system summary (5 min)
4. `02-architecture.md` — high-level shape (10 min)
5. `03-domains/_index.md` — sub-system landscape (5 min)
6. Then pick ONE domain: `03-domains/<slug>.md` plus its onboarding companion if present
7. `08-standards/observed.md` — before you touch any code
8. `09-legacy/tech-debt.md` (filtered to your domain) — before you touch any code

Total: ~45-60 min to be productive in one domain.

---

## Producer / consumer matrix

Which command writes which doc, and which command (or agent) reads it.

| Doc | Produced by | Read by |
|-----|-------------|---------|
| `00-vision.md` | `/setup-01-vision` | All explorer agents (pre-flight); `/setup-04-scope`; `/dev-ticket` (recon); `/dev-review` |
| `00-scope.md` | `/setup-04-scope` | All explorer agents (sampling depth); `/dev-ticket` (recon); `/review-03-security-check`; `/dev-review` |
| `01-overview.md` | `/setup-05-explore` (synthesis) + manual edits | New sessions; `/status` |
| `02-architecture.md` | `/setup-05-explore` (synthesis) | New sessions; BMAD Architect |
| `03-domains/_index.md` | `explore-05-domain-mapper` | `/dev-ticket` (recon); `/dev-10-onboard-domain`; all feature/API agents |
| `03-domains/<slug>.md` | `explore-05-domain-mapper` | `/dev-ticket` (recon); `/dev-10-onboard-domain`; `/dev-11-modernize-component`; `/review-02-legacy-audit`; `/dev-14-capture-knowledge` |
| `04-features/<slug>.md` | `explore-09-feature-cataloger` | `/dev-ticket`; `/dev-09-map-feature` |
| `05-api-surface.md` and `/<Controller>.md` | `explore-06-api-surface-mapper` | `/dev-07-trace-endpoint`; `/dev-ticket` (spec); BMAD Dev |
| `06-frontend-map.md` | `explore-07-frontend-explorer` | `/dev-11-modernize-component`; `/dev-ticket` (spec) |
| `07-data-model.md` | `explore-08-data-model-mapper` | `/dev-ticket` (spec); `/dev-07-trace-endpoint`; BMAD Dev |
| `08-standards/observed.md` | `explore-02-standards-extractor` | `/review-01-standards-check`; `/dev-review`; `/dev-ticket` (spec); `/dev-11-modernize-component`; `/dev-12-modernize-pattern`; BMAD Dev |
| `09-legacy/legacy-map.md` and `tech-debt.md` | `explore-13-legacy-detective` | `/review-02-legacy-audit`; `/dev-review`; BMAD PM |
| `09-legacy/security-findings.md` | `/review-03-security-check` | `/dev-review`; BMAD QA + PM |
| `10-integrations.md` | `explore-10-integration-mapper` | `/dev-ticket` (spec); `/dev-bug` |
| `11-testing.md` | `explore-12-test-coverage-mapper` | `/dev-ticket` (spec); `/dev-review`; BMAD QA |
| `12-build-deploy.md` | `explore-04-build-deploy-mapper` | `/dev-bug`; deployment work |
| `13-cross-cutting.md` | `explore-11-cross-cutting-mapper` | `/dev-ticket` (spec); `/review-03-security-check`; `/dev-review` |
| `dependencies.md` | `explore-03-dependency-auditor` | Security reviews; upgrade planning |
| `_adr/<NNNN>-<slug>.md` | `/dev-13-write-adr` | New sessions; BMAD Architect; future ADR authors |
| `_state/recon.md` | `explore-01-recon-scout` (Phase 0 mode) | `/setup-05-explore`; `/status` |
| `_state/recon-delta-*.md` | `explore-01-recon-scout` (diff mode) | `/setup-05-explore update` orchestrator |
| `_state/exploration-state.json` | All explorer agents (each updates own row) | `/status`; `/setup-05-explore` (resumability) |
| `_state/verification-report-*.md` | `/setup-05-explore` orchestrator (from `explore-14-doc-verifier`'s report body) | Humans triaging drift; drives next refresh |
| `_state/doc-verification-*.json` | `/setup-05-explore` orchestrator (from `explore-14-doc-verifier`'s counts) | `solvo doc-trust`, which records ratings into `exploration-state.json` → `docTrust` |

---

## Doc relationships (the mesh)

Some docs explicitly reference others. When you read one, you may need its neighbors:

```
00-vision.md       ┐
                   ├──→ shapes every explorer's pre-flight
00-scope.md        ┘    (priority bands → sampling depth)

02-architecture.md ──┬──→ 03-domains/   (per-domain detail)
                     ├──→ 10-integrations.md  (external systems)
                     └──→ 12-build-deploy.md  (runtime shape)

03-domains/<slug>.md ──┬──→ 04-features/  (features in this domain)
                       ├──→ 05-api-surface/<Controller>.md
                       ├──→ 07-data-model.md (entities owned)
                       └──→ 09-legacy/tech-debt.md (debt in this domain)

04-features/<slug>.md ──┬──→ 03-domains/<owning-slug>.md
                        ├──→ 05-api-surface (endpoints touched)
                        ├──→ 06-frontend-map.md (UI files)
                        └──→ 11-testing.md (test coverage)

08-standards/observed.md ←─── every authoring command reads this

09-legacy/tech-debt.md ←─── /review-02-legacy-audit and /dev-review write here

_adr/ ←─── decisions captured by /dev-13-write-adr;
            reference these from related docs when applicable
```

---

## Freshness markers

Three special markers appear in docs. Toolkit commands respect them; do not strip:

| Marker | Meaning | Used by |
|--------|---------|---------|
| `<!-- EDITED: yyyy-mm-dd by Name -->` | Human-edited content. Refresh commands MUST ask before overwriting. | `/setup-05-explore` (any mode); `/setup-05-explore update` |
| `<!-- LAST REFRESHED: <ISO> by <command> -->` | Auto-refresh timestamp | Set by orchestrators after a successful refresh |
| `<!-- TRIBAL: captured <date> from <source> -->` | Knowledge captured from a human interview | `/dev-14-capture-knowledge`; preserved by all refresh modes |

If a doc has none of these markers, it's a clean auto-generated artefact and can be regenerated freely.

---

## When to NOT read these docs

These docs are not a substitute for code in two cases:

1. **For the latest reality** — if a doc says one thing and the code says another, the code wins. Run `/setup-05-explore update` to refresh. Until then, the code is the source of truth.
2. **For business-logic decisions you have to make** — the docs describe what IS. For what SHOULD BE, hand off to the spec layer: `/product-spec` writes the functional spec, `/product-story` writes the story. Each command states its own BMAD handoff, and what it does when BMAD is not installed.

---

## Quick command-to-doc cheatsheet

| If you want to… | Run |
|------------------|-----|
| See progress on the doc-set | `/status` |
| Refresh stale docs | `/setup-05-explore update` |
| Validate the docs are accurate | `/setup-05-explore verify` (drift-update runs it too, as Phase F) |
| Briefing for a new ticket (project-level) | `/dev-ticket '<desc>'` |
| Plan for a new feature (story-spec draft) | `/dev-ticket '<desc>' (spec shown at GATE 1)` |
| Investigate a bug | `/dev-bug <symptom>` |
| Check a PR before merge | `/dev-review [staged or pr]` |

Run `/help` for the full catalog — it routes you to the command you need. The managed header block at the top of `AGENTS.md`, which every agent provider gets, lists the daily ones.
