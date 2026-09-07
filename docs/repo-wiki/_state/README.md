# Exploration State

This folder holds the operational state of the exploration toolkit for this codebase. Files here are written by agents and read by commands; humans rarely need to touch them directly.

## Files

- `recon.md` — current baseline output of `/setup-02-recon`. Size map, sub-system inventory, exploration plan.
- `recon-delta-<YYYY-MM-DD>.md` — per-update delta output from `/setup-05-explore`. Historical.
- `exploration-state.json` — machine-readable manifest of which sub-systems / agents have been run.
- `agent-runs/` — per-run timestamped logs (optional, written when verbose mode requested).
- `_archived/` — homes for docs of removed sub-systems (preserved, not deleted, so history is never lost).

## `exploration-state.json` schema (v3)

### Greenfield repo

Written by `explore-01-recon-scout` when no sub-systems are identified. `subSystems` is
always `{}` and `reconRun` is omitted — the mode field alone is the signal.

```json
{
  "schemaVersion": 3,
  "mode": "greenfield",
  "subSystems": {}
}
```

### Brownfield repo (sub-systems identified)

```json
{
  "schemaVersion": 3,
  "reconRun": {
    "completedAt": "<ISO-8601>",
    "totalLoc": 0,
    "totalProjects": 0,
    "subSystems": ["billing", "identity", "..."]
  },
  "subSystems": {
    "billing": {
      "path": "src/Billing",
      "loc": 0,
      "locAtLastExploration": 0,
      "files": 0,
      "filesAtLastExploration": 0,
      "status": "pending | partial | complete",
      "staleness": "fresh | stale-by-age | churned-minor | churned-significant | new | removed",
      "churn": {
        "tier": "hot | warm | cold",
        "source": "git | scope-band | unavailable",
        "measuredAt": "<ISO-8601>",
        "windowDays": 90,
        "commits": null,
        "linesChanged": null,
        "filesTouched": null
      },
      "agentsRun": {
        "explore-05-domain-mapper": "<ISO-8601 or null>",
        "explore-06-api-surface-mapper": "<ISO-8601 or null>",
        "explore-07-frontend-explorer": "<ISO-8601 or null>",
        "explore-08-data-model-mapper": "<ISO-8601 or null>",
        "explore-13-legacy-detective": "<ISO-8601 or null>",
        "explore-10-integration-mapper": "<ISO-8601 or null>",
        "explore-12-test-coverage-mapper": "<ISO-8601 or null>",
        "explore-11-cross-cutting-mapper": "<ISO-8601 or null>",
        "explore-09-feature-cataloger": "<ISO-8601 or null>"
      },
      "notes": "free-text notes from the agents"
    }
  },
  "globalAgents": {
    "explore-02-standards-extractor": "<ISO-8601 or null>",
    "explore-03-dependency-auditor": "<ISO-8601 or null>",
    "explore-04-build-deploy-mapper": "<ISO-8601 or null>"
  },
  "changelog": [
    { "at": "<ISO-8601>", "command": "/setup-05-explore billing", "summary": "first deep-dive of billing" }
  ],
  "docTrust": {
    "docs/repo-wiki/05-api-surface.md": {
      "sampled": 15,
      "confirmed": 14,
      "criticalDrift": 1,
      "verifiedAt": "<ISO-8601>",
      "contentHash": "sha256:<hex of the doc's bytes at verification time>",
      "band": "mostly-trustworthy"
    }
  }
}
```

### Key fields

- **`mode`** — optional top-level field; `"greenfield"` when the recon-scout determined the repo is a blank scaffold and skipped sub-system identification. When present, `subSystems` is `{}` and no per-section entries are written. Distinct from `reconRun: null` (interrupted setup).
- **`status`** — has the sub-system been mapped at all? `pending` / `partial` / `complete`
- **`staleness`** — is the existing map still trustworthy? `fresh` / `stale-by-age` / `churned-minor` / `churned-significant` / `new` (just discovered) / `removed` (no longer present). Agents write this for human readers; the CLI **recomputes the verdict from the evidence fields** and the recomputed value wins. Thresholds live in code and `solvo.json → intelligence.staleness` (per-area by churn tier), not in this document.
- **`loc` / `locAtLastExploration`, `files` / `filesAtLastExploration`** — size snapshots for the churn-delta half of the verdict (current scan vs when agents last ran)
- **`churn`** — per-area git activity evidence, written by `solvo churn` (AFSP-202). `tier` records which age clock applied at measurement time (advisory — the CLI recomputes it from the counters and current config); `source` says how the tier was arrived at (`unavailable` means fall back to the flat legacy threshold); counters are `null` until measured. Absent block = never measured = legacy threshold, so pre-v3 files keep classifying exactly as before.
  - **`windowDays`** — how many days of history the measurement could actually see, not how old the area is. It equals `intelligence.staleness.churnWindowDays` whenever the clone's history reaches back that far, and is smaller only when the whole repository is younger than the window. A five-day-old area in a five-year-old repo therefore records the full window: the window *was* visible, and the area was genuinely quiet for the part of it that predates the area.
  - **`source: "unavailable"`** — the area could not be measured. Three causes: the entry has no `path`, the `path` is not in the working tree (renamed or deleted since the last exploration), or history is too shallow to cover the window and deepening did not fix it. A missing path is recorded as unavailable rather than as `commits: 0`, deliberately: zero commits is a *measurement*, and it would earn the area a longer trust window than never having been measured at all.
  - **Counters.** `commits` excludes merge commits. `linesChanged` is lines added **plus** deleted, so a rewrite counts double its size and a deletion counts toward churn. `filesTouched` counts distinct paths, with a rename counting once, under its new name; binary files count here but contribute no lines.
- **`changelog`** — append-only history of state-changing operations
- **`docTrust`** — per-doc trust evidence, written by `solvo doc-trust` (AFSP-98) from the doc-verifier's counts (the newest `doc-verification-*.json` beside this file). Top-level and keyed by doc path, not per sub-system: three of the rated docs are repo-wide. `band` is a display cache — consumers recompute it from `confirmed / sampled` against `solvo.json → intelligence.docTrust`, so a config edit re-bands without re-verification. `contentHash` ties the rating to the doc's bytes at verification time: a rewritten (or deleted) doc reverts to unrated rather than inheriting a verdict about text that no longer exists. Absent map = never verified = no advisory, by design.

Removed in v3: the top-level `lastChurnCheck` — `churn.measuredAt` is the per-area replacement. A stray `lastChurnCheck` in an older file is inert; nothing reads it and writers preserve it.

Per-sub-system agents (run scoped to each sub-system): explore-05-domain-mapper, explore-09-feature-cataloger, explore-06-api-surface-mapper, explore-07-frontend-explorer, explore-08-data-model-mapper, explore-13-legacy-detective, explore-10-integration-mapper, explore-12-test-coverage-mapper, explore-11-cross-cutting-mapper.

Repo-wide agents (run once for whole repo): explore-02-standards-extractor, explore-03-dependency-auditor, explore-04-build-deploy-mapper.

## Protocols

### Resumability (used by `/setup-05-explore`)

Every agent invocation:
1. Reads `exploration-state.json` at start
2. Skips work already completed (agent + sub-system + within freshness window)
3. Writes its target doc(s)
4. Updates `exploration-state.json` with completion timestamp; on a completed refresh the
   orchestrator also advances `locAtLastExploration` / `filesAtLastExploration` to the current
   scan, which is what returns the recomputed verdict to `fresh`
5. Returns a summary including which entries it updated

### Drift detection (used by `/setup-05-explore`)

1. Recon-scout runs in diff mode, comparing fresh scan against saved state
2. Each sub-system gets a `staleness` tag
3. Orchestrator builds a refresh plan based on staleness
4. After refresh, manifest is updated and a changelog entry is appended
5. `recon.md` may be rotated to `recon-<date>.md` and replaced with the fresh recon as the new baseline

### Staleness-aware briefings (used by `/dev-ticket` recon and `/dev-bug`)

1. Identify the affected sub-system(s) from the ticket/bug description
2. Read manifest entry for each
3. If `staleness` is `churned-significant` or `stale-by-age`, prepend a warning to the briefing
4. Recommend `/setup-05-explore <sub-system>` before trusting the brief

## When to manually edit

- After a major refactor that invalidates prior exploration, reset specific sub-system entries to `pending` and clear their agent timestamps.
- After hand-editing a doc, add `<!-- EDITED: yyyy-mm-dd by Name -->` at the top of the doc itself; don't touch the manifest.
- **Do not hand-edit the `staleness` token expecting the tooling to react — it will not.** The doctor and SessionStart hook recompute the verdict from evidence and ignore the stored token entirely (only prose consumers that read the field directly still see a hand-set value). To force a sub-system to be re-explored, edit the *evidence*: clear its `agentsRun` timestamps (set them to `null`), and the entry classifies as never-explored on the next run.
