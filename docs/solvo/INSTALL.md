---
type: guide
tags: [solvo, install, onboarding]
---

# Solvo — Install & First Setup

The complete "get a repo onto the framework" runbook. Covers all three trackers (GitHub / Azure DevOps / Jira) and both install channels (npm CLI / Claude Code plugin).

---

## Prerequisites (every repo, every machine)

| Need | Why | Check |
|---|---|---|
| **Node 26+** | The CLI and the hook scripts are Node | `node -v` |
| **git + a remote** | The cycle needs branches, commits, PRs — the gate-guard verifies against `HEAD` | `git --version` |
| **`gh` CLI + `gh auth login`** | **GitHub repos only** — the cycle reads issues and opens PRs via `gh` | `gh auth status` (`doctor` warns if `gh` is missing from PATH); verify end-to-end: `solvo connectivity` |
| **GitLab account + project access** | **GitLab SCM only** — needed to push branches and open MRs | access to the target repo/group |
| **SSH key configured for GitLab** | Enables clone/push over SSH for the MR path | `ssh -T git@gitlab.com` (or your GitLab host) |
| **`glab` CLI + auth** | **GitLab SCM only** — opens/annotates MRs via `glab` | `glab auth status` (`doctor` warns if `glab` is missing from PATH); verify end-to-end: `solvo connectivity` |
| **GitLab Personal Access Token (PAT)** | Required for headless/non-interactive `glab` auth (CI, remote agents) | token created with the `api` scope |
| **Azure CLI / ADO access** (deprecated) | **ADO repos only** — via the ADO MCP server | — |
| **ADO PAT in env** (`AZURE_DEVOPS_EXT_PAT`, scope: Code read & write) (deprecated) | **ADO SCM only** — `solvo connectivity` opens/abandons its verification PR via REST | `solvo connectivity` (fails at `prereqs` if dead) |
| **BMAD** (recommended peer) | Silences the doctor warning; upgrades every phase (ADR 0001) | `_bmad/` present |
| **Claude Code ≥ 2.1.195** | Plugin channel only — team auto-install prompts need this version | `claude --version` |

> **Azure DevOps is deprecated.** Organizational support is planned for removal. Use Jira or GitHub instead. Removal ticket: [AFSP-364](https://solvdgmbh.atlassian.net/browse/AFSP-364).

---

## Pick your surface: two install channels

| | **npm CLI (copy mode)** | **Claude plugin mode** |
|---|---|---|
| commands / agents / skills / hooks | canonical `.agents/`, plus a generated native view for the agents that have one (`claude` → `.claude/`, `copilot` → `.github/`), version-pinned, drift-checked by `doctor` | served live from the plugin, auto-updating |
| scaffold (config, docs/repo-wiki, specs dirs) | `init` | `init --claude-plugin` (same scaffold) |
| teammate onboarding | nothing to do — files are committed in-repo | auto-prompted to install the plugin on workspace trust |
| best for | teams that want pinned, reviewable surface files | teams that want zero-lag updates and a slimmer repo |

**Pick one surface per repo.** `doctor` flags mixed installs.

## Step 1 — get the CLI

The package is served from the GitLab Package Registry (private). Add the `@solvd1` scope to your
`.npmrc` (project or `~/.npmrc`) once — `GITLAB_TOKEN` is any token with `read_api`:

```
@solvd1:registry=https://gitlab.com/api/v4/projects/84306267/packages/npm/
//gitlab.com/api/v4/projects/84306267/packages/npm/:_authToken=${GITLAB_TOKEN}
```

```bash
npx @solvd1/solvo init          # copy mode
npx @solvd1/solvo init --claude-plugin   # plugin mode
```

Not set up with the registry yet? Install the tarball you were given: `npm install -g <path-to-tarball>`, then use the `solvo` command. The number in the tarball's filename is not the release version; `solvo --version` reports the real one.

**Plugin channel (the commands and skills arrive without npm):** in Claude Code run

```
/plugin marketplace add git@gitlab.com:solvd1/ai-first-sdlc/plugin-marketplace.git
/plugin install solvo@solvd
```

The CLI is still needed even in plugin mode: `doctor`, `update` and `gate` are npm-delivered, so keep the npx form above to hand.

(uses your normal git credentials; `init --claude-plugin` writes the same marketplace into `.claude/settings.json` so teammates get prompted automatically). Use the SSH URL, not HTTPS: the background auto-update pull runs with git credential helpers disabled, so a private HTTPS source fails to authenticate without saying why. Manual `/plugin update solvo` always works.

If your environment cannot use SSH (some networks or proxies block it), rewrite the SSH URL to HTTPS globally and authenticate with your account when prompted:

```
git config --global url."https://gitlab.com/".insteadOf "git@gitlab.com:"
```

---

## Step 2 — connect the repo to git

`init` scaffolds files; the *cycle* needs a git repo with a remote. Two cases:

**A — the remote repo is empty** (brand-new, no commits):
```bash
cd <your-project-folder>
git init -b main
git remote add origin <REMOTE_URL>
# …run init (Step 3), fill config (Step 4), then:
git add -A && git commit -m "chore: scaffold with Solvo"
git push -u origin main
```

**B — the remote already has commits** (even a README/license): don't `git init` locally and fight histories — clone, then copy your content in:
```bash
git clone <REMOTE_URL>
# copy your project content into the clone (Windows: robocopy <src> <clone> /E /XD .git)
cd <clone>
# …run init (Step 3)
```

**Then, before you run `init`: take the pre-install tag. This step is not optional.**

`solvo uninstall` reverses an install using the record `init` writes to
`.solvo/install-snapshot.json`, but it is not a substitute for this tag. It refuses when that
record is missing or unreadable. An install that never finished leaves a record it can only partly
act on, and that run still deletes the record, so a retry has nothing to work from. Managed files
you have edited are left in place unless you pass `--discard-local-changes`. The tag is what the
rollback runbook works from in all of those cases, and the only record of what the rest of your
repo looked like before Solvo.

**In case A, commit your project content first.** A tag needs a commit to point at, and case A has
none yet — `git tag -a` fails outright with `fatal: Failed to resolve 'HEAD' as a valid ref.`. A tag
taken *after* `init` is no better: it records the installed state rather than the state you want
back. So: commit what you have, tag that commit, then run `init`.

```bash
git tag -a "solvo/pre-install/$(date +%F)" -m "Solvo pre-install snapshot"
git push origin "solvo/pre-install/$(date +%F)"
```

The name is fixed — `solvo/pre-install/<YYYY-MM-DD>` — so it is findable later with
`git tag -l 'solvo/pre-install/*'`. Push it: a tag that exists only on the installing machine is
not a snapshot.

---

## Step 3 — run init (pick your tracker)

When `init` finishes, reload your editor window. Commands it installed do not appear in a
session that was already open, so without the reload the install looks like it failed.

**Interactive (recommended for first-timers):**
```bash
npx @solvd1/solvo init
```
With no flags, `init` walks you through labeled questions — tracker, tracker connection, agent, role packs, and knowledge vault — each with a plain-language explanation, plus a confirm step before anything is written. Add `--yes` to skip prompts and apply flags (CI or repeat installs) — `--yes` never assumes a tracker, so it requires an explicit `--tracker`. Add `--agent codex` or `--agent copilot` to target a different AI coding tool (default `claude`, the only one that also gets the hooks). `copilot` gets slash commands, prompt files and custom agents under `.github/`; `codex` reads `.agents/` directly with no slash commands. Add `--claude-plugin` for plugin mode (`--marketplace-url <git url>` to override the default marketplace) — plugin mode requires `agent=claude`.

**GitHub:**
```bash
npx @solvd1/solvo init --tracker github --github-owner <OWNER> --github-repo <REPO> --obsidian
```

**Azure DevOps:**
```bash
npx @solvd1/solvo init --tracker ado --ado-org <ORG> --ado-project <PROJECT> --obsidian
```

**Jira + GitLab** (unattended example). `--yes` needs the tracker spelled out, and `--tracker jira` needs the project key plus your own status and issue-type names:
```bash
npx @solvd1/solvo init --yes --tracker jira --scm gitlab --jira-project <KEY>   --jira-status-map "inProgress=In Progress,inReview=In Review,done=Done"   --jira-issue-types "story=Story,epic=Epic,bug=Bug,subtask=Subtask"   --obsidian
```
Use the names as they appear in **your** Jira project. There is no default: a status name that
happens to exist in your workflow would move real issues to the wrong state. Interactively `init`
asks for both and offers these as a starting point.

**On-premise Jira (Data Center)** needs `--jira-route devtool`. The default route is the Atlassian
MCP server, which is a Cloud OAuth endpoint and cannot reach a Data Center site, so without this
flag the install registers a server your machine cannot talk to:
```bash
npx @solvd1/solvo init --yes --tracker jira --scm gitlab --jira-project <KEY>   --jira-status-map "inProgress=In Progress,inReview=In Review,done=Done"   --jira-issue-types "story=Story,epic=Epic,bug=Bug,subtask=Subtask"   --jira-route devtool --obsidian
```
This writes `tracker.jira.route: "devtool"` and no `mcpServers.atlassian` entry. It needs `devtool`
installed and authenticated. Jira Cloud needs nothing here: leave the flag off, or pass
`--jira-route atlassian-mcp`. Interactively `init` asks. An unrecognised value is refused before
anything is written.

**Codex or Copilot** (either tracker — the agent axis is independent). Copilot gets slash commands from the generated `.github/` view; Codex reads `.agents/` as plain markdown:
```bash
npx @solvd1/solvo init --tracker github --github-owner <OWNER> --github-repo <REPO> --agent codex
npx @solvd1/solvo init --tracker github --github-owner <OWNER> --github-repo <REPO> --agent copilot
```

`init` always creates `solvo.json`, the canonical `.agents/{commands,skills,agents,hooks}` surface, `AGENTS.md`, and the `docs/repo-wiki/` skeleton (plus `.obsidian/` config with `--obsidian`), adds the managed `.solvo/` block to `.gitignore`, and adds a managed block to `.gitattributes` pinning the files it hashes to LF so a Windows clone does not read every one of them as drifted. `.solvo/` holds the install record from the moment `init` runs; its cycle-artifact directories are created on first use, so a fresh install has none until the first cycle writes into one. The `claude` agent (default) additionally gets a generated `.claude/` view of the surface, committed `.claude/settings.json` + `.mcp.json`, and the managed header on `CLAUDE.md`. `copilot` gets a generated `.github/` view instead — `skills/<command>/SKILL.md` for the CLI, `prompts/<command>.prompt.md` for VS Code, `agents/<name>.agent.md` for both — plus the managed header on `.github/copilot-instructions.md` and `AGENTS.md`; no settings file and no hooks. `codex` gets no view at all: it reads `.agents/` directly via `AGENTS.md`. It **skips** anything already present, so your specs/docs are preserved.

---

## Step 4 — fill `solvo.json` (5 min — the framework can't guess these)

| Key | Set to |
|---|---|
| `tracker.github.owner`/`repo` **or** `ado.org`/`project` | your real values |
| `tracker.jira.projectKey` + `tracker.jira.statusMap`/`issueTypes` (Jira repos) | your project key, and your project's real status/issue-type names — an empty `statusMap` is a doctor FAIL |
| `tracker.phaseLabels` | optional, off by default. `enabled: true` applies a cumulative, namespaced label (Jira label / GitHub label / ADO tag, per the loaded tracker conventions skill) as the cycle advances through each phase — visibility between GATE 1 and the PR that the status column alone cannot show. `prefix` namespaces every label (default `"solvo:"`); `map` renames individual phase labels (`recon`, `tier-confirm`, `spec`, `build`, `self-review`, `fresh-review`, `pr`, `merge-gate`, `merged` — unmapped phases default to the phase key itself, except `merged`, which is labeled only when explicitly mapped). Never read back by any gate; `doctor` validates the block's shape whenever it is present. |
| `tiers.t3Domains` | the regulated/high-risk modules (money, auth, PII, compliance) |
| `specs.functionalDir` / `specs.badocsDir` | your as-is / intent spec folders, if you use them |
| `specLayer.provider` | which peer toolkit authors your specs: `bmad` (default) or `speckit`. One per repo. `speckit` makes the `specs/<NNN>-<slug>/` tree the spec library `/dev-ticket` reads from, and needs spec-kit installed (`specify init --here --integration claude`); `doctor` warns if it is declared but absent. |
| `quality.tests.backend`/`frontend`/`e2e` | your test commands (e.g. `dotnet test`, `npx playwright test`), or `"n/a: <reason>"` to state that this repo has none. All three empty is a `doctor` FAIL and blocks the PR gate: with no command to run, the tests phase would report green having run nothing. `init` fills this in for a stack it recognises (see below) and writes an `n/a:` reason when it cannot. |
| `quality.coverageLine`/`coverageBranch` | whole-repo floors — the minimum line/branch coverage the repo as a whole must hold. `init` measures these from a `package.json` `scripts.coverage` entry where one exists (best-effort, never blocks the install; interactive runs ask before spending the minutes it can take, `--yes` runs it without asking, `--no-measure` skips it), and writes conservative template defaults otherwise. Both ratchet up only. |
| `quality.coverageDiffLine` | the diff floor — judges only the lines a change adds, not the repo's history. This is the lever that works on a legacy codebase: a brownfield repo can hold a low `coverageLine` while still requiring every new line be covered. Set to the greater of the measured `coverageLine` and the template default when `init` measures coverage, so a low measurement never drags the diff floor down with it; template default otherwise. Ratchets up only. |
| `quality.coverageArtifact` | **required at T2/T3** — path to your coverage report (e.g. `coverage/cobertura.xml`), or `"n/a: <reason>"` to waive. Empty/absent fails the gate closed. `init` writes `"n/a: not measured at install — <reason>"` automatically whenever it could not measure coverage (no coverage script, the script failed or timed out, or `--no-measure` was passed) — the same waiver convention, applied at install time rather than left for you to fill in. |
| `quality.lint` | `[{ "glob": "**/*.ts", "command": "npx eslint {file}" }]` etc. One rule per glob; both keys are required. The PostToolUse hook runs the command on each file you edit, with `{file}` replaced by its path — the merge gate does not read this. |
| `quality.advisory.coverage` | `true` softens the coverage-threshold check (local gate-guard and the CI merge gate) from run-and-block to run-and-warn. Default `false` (enforcing). |
| `quality.advisory.artifact` | `true` softens the coverage-artifact check (armed/present/parseable) the same way. Default `false` (enforcing). |
| `quality.advisory.e2e` | `true` softens the e2e-evidence check the same way. Default `false` (enforcing). |
| `quality.advisory.lint` | `true` softens the PostToolUse `quality.lint` check: a failing lint command reports rather than blocking the tool call. Default `false` (enforcing). |
| `quality.qa.mode` | `warn` (default), `enforce` or `off`. QA assurance starts advisory; `enforce` blocks through the server adapter, and only on GitLab today. |
| `quality.qa.requiredFromTier` | lowest tier at which QA proof is required at all, `T1`/`T2`/`T3`. Tiers below it are advisory, and an advisory tier still records what happened. |
| `quality.qa.allowedEvidencePaths` | roots every evidence path must stay beneath, e.g. `[".solvo/evidence/qa/"]`. Recorded paths are checked as safe repository-relative paths; allowed-root and symlink enforcement happens at the evidence I/O and gate boundary. The merge gate reads this from the target branch, so widening it in the same MR it would validate does not count. |
| `quality.qa.retentionDays` | how long evidence is retained. Expired evidence cannot support readiness. Declared, not yet enforced. |

### What `init` fills in for `quality.tests`

`init` proposes a test command for a stack it can name from a manifest file, and asks before writing anything. Interactive runs get the prompt; `--yes` runs skip it and record a reason, unless you pass `--bootstrap-tests`. It never installs a test runner: a runner that is declared in your manifest but not installed is a miss, not a proposal.

| Stack | Recognised by | Command written | Scaffold test seeded |
|---|---|---|---|
| Node | a `package.json` `test` script that is not the `npm init` placeholder | that script, as `npm test` | none — you already have a harness |
| Node | `vitest` installed | `npx vitest run` | `tests/solvo-scaffold.test.js`, or `.ts` with a `tsconfig.json` |
| Node | `jest` installed | `npx jest` | same |
| Node | `mocha` installed | `npx mocha` | `test/solvo-scaffold.spec.js` — mocha's default glob does not recurse |
| .NET | a `*.csproj` referencing `Microsoft.NET.Test.Sdk` and one of xunit, NUnit or MSTest | `dotnet test` | `SolvoScaffoldTests.cs` beside that csproj |
| Python | `pyproject.toml` or `pytest.ini` declaring pytest | `python3 -m pytest`, or `python` where that is the name on PATH | `tests/test_solvo_scaffold.py` |

The seeded test asserts nothing about your code. It exists so the command written above has something to run, and so you find out at install time rather than mid-story that it runs. `init` runs it once, scoped to that one file, and requires it to report a passing test; if it does not, the config write is rolled back to an `n/a:` reason and the file is removed. Replace it with a real test, or delete it once you have one.

---

## Step 5 — verify + protect

```bash
npx @solvd1/solvo doctor          # green except the BMAD warning until BMAD is installed
```

**Protect `main`** on the remote to require PRs — the server-side backstop that pairs with the gate-guard hook (the hook stops the agent; branch protection stops everyone else). Require at least one approval, and block author self-approval (GitHub: require a code-owner review). Step 6 reads all of that back on its `protection` row, so you find out there whether the setting took.

Branch convention the gate-guard enforces: work branches are **`gh/<id>-<slug>`** (GitHub), **`svd/<id>-<slug>`** (ADO), or **`<KEY>-<n>-<slug>`** / **`<type>/<KEY>-<n>/<slug>`** (Jira). `/dev-ticket` creates them for you; the hook fail-closes PRs from non-convention branches.

---

## Step 6 — prove the credentials work

```bash
npx @solvd1/solvo connectivity    # clone, branch, push, open+close a throwaway draft PR/MR — live, end-to-end
```

`doctor` never touches the network — it checks files, hooks, and CLI presence on disk, so a
green doctor does **not** mean your tokens, SSH keys, or CLI auth actually work. `connectivity`
is the step that proves them against the real provider. Run it before the first ticket: dead
credentials discovered here cost a minute; discovered mid-`/dev-ticket` they cost the run.

The last row of the table is `protection`, and it must read **PASS** before you launch. Anything
else is a `WARN` carrying the fix: `not protected` means Step 5 never took, `missing an approval
requirement` and the self-approval or code-owner variants name the one setting left, and `could
not verify` is three cases that each name their own fix — a refused read wants a bigger role
(GitLab Maintainer, GitHub admin), `no response` means the CLI never reached the host, and an
answer without the field is a solvo bug rather than anything you can grant. In all three the
branch may well be protected, so check it by hand. A `WARN` here leaves the verdict at
`PASS` and the exit code at 0 on purpose: unreadable protection is not a broken credential, and
it must not fail the run that proves your credentials. ADO reports `not checked`; verify its
branch policies yourself.

---

## Step 7 — first run

In Claude Code:
```
/help                 # what command do I need?
/setup                # first-time project knowledge: vision → recon → scope (→ explore)
/dev-ticket "<first thing>" # build something
```

**Greenfield note:** on a brand-new repo, recon reports `Mode: greenfield` — exploration is skipped, the stack fingerprint is recorded, and you go straight from scope to your first story. `docs/repo-wiki/` grows as delivery runs.

---

## Removing solvo

`init` records what it changed, so removal reverses that record rather than guessing:

```bash
npx @solvd1/solvo uninstall --dry-run   # print the plan, write nothing
npx @solvd1/solvo uninstall --yes       # apply it
```

Files you edited after installing are kept and listed, not deleted. Cycle history under `.solvo/`
is kept unless you pass `--remove-state`, because the merge and finalize gates read it.

An install from before the record existed is refused rather than guessed at; the manual steps are
in `docs/runbooks/rollback-wave-one.md`.

## Keeping current & staying standardized

```bash
npx @solvd1/solvo update           # copy mode: pull the latest managed toolkit (never touches your config/docs/local)
npx @solvd1/solvo update --check   # CI drift gate — nonzero exit on drift
npx @solvd1/solvo doctor           # version, hooks/plugin surface, MCP, doc freshness, config
```

Plugin mode updates itself through Claude Code (`/plugin update solvo` to force). Team-specific commands/skills go in `.agents/commands/local/` and `.agents/skills/local/` (`.claude/*/local/` in plugin mode, which has no canonical tree to project from) — never overwritten.

`claude` repos self-heal: a `SessionStart` hook regenerates the gitignored `.claude/` view from canonical `.agents/` at the start of every session — fresh clones therefore self-heal the first time the repo opens in Claude Code, with no manual sync step. `copilot` repos have a view but no hook to regenerate it, because Copilot has no settings file to register one in: run `npx @solvd1/solvo update` after a fresh clone to write `.github/`, and `doctor` reports it when the view has drifted or gone missing. `codex` repos have no view at all; that tool reads `.agents/` directly.

**Keeping your own file inside a projected directory.** Written for a `copilot` install, where all four costs below apply as stated. The managed `.gitignore` block ignores each projected directory wholesale (`.github/prompts/*`, `.github/agents/*`, `.github/skills/*`). `.github/prompts/` and `.github/agents/` are also where hand-written prompt files and custom agents normally live, so if you already have one there, know four things. A `claude` install projects by copy into `.claude/` instead, and reads differently on two of the four. Costs 1 and 4 are the same. Cost 2 applies in part: the copy path does not check the marker, so a file of yours at a name Solvo projects is overwritten rather than left alone, and nothing warns you. Its last two shapes do apply, because a directory of yours at `.claude/commands/<command>.md` blocks a copy exactly as it blocks a generated pointer, and `doctor` warns about it the same way. Cost 3 applies for a different reason and more broadly: the marker is never read on `claude`, so *any* file under `.claude/commands/`, `.claude/skills/` or `.claude/agents/` with no matching file under `.agents/` is reported as a stale view file and fails `doctor`, whether or not you started from a generated one. That last behaviour is not new here; it is how the check has always worked for a copy-projected provider. Pick a name Solvo does not ship on either provider, and on `claude` keep your own commands out of the projected directories entirely.

1. **Git stops seeing new files there.** A file already tracked in git stays tracked and keeps merging; gitignore does not untrack anything. A *new* one needs a `!` line of your own **below** the managed block, for example `!.github/prompts/team-triage.prompt.md`. Below, not above: gitignore is last match wins, so a negation placed above the block is overridden by the very block it is meant to escape. Solvo appends the block at the end of the file the first time and replaces it where it sits after that, so on a fresh install "below the block" means the end of the file.
2. **Solvo leaves your file alone, and that costs you the command.** It identifies its own output by a marker in the file, not by the path, so it never overwrites or tells you to delete something it did not write. The other side of that: if your file sits at exactly the path a projection would use, nothing is written there, and that command is missing from that surface. `doctor` warns and names both the file and the command, so you can rename yours to get the command back. Name your own files something Solvo does not ship and this never comes up. Two other shapes cost you the same command, for a plainer reason: a `.github/skills/` projection writes `<command>/SKILL.md`, so a file of yours named exactly `<command>` there is sitting where Solvo needs a directory, and a directory of yours at a name like `.github/prompts/<command>.prompt.md` is sitting where Solvo needs a file. Neither is overwritten either. `update` skips it and keeps going rather than failing the run, and `doctor` warns with the path to move or rename.
3. **Never start your own file by copying a generated one.** Which way it bites depends on where the copy lands. Keep it at a path Solvo projects to and it inherits the marker, so `update` reads the file as its own and regenerates over your edits. Rename it to something Solvo does not ship and the marker travels with it, so `doctor` now reports a `view-sync` FAIL, `stale view file with no canonical source (delete it, or restore .agents/<family>/<name>.md)`, and exits 1, which fails any CI step that runs it. If you are running the Solvo plugin inside Claude Code you will also find the command blocked until you clear it, because the plugin registers its own hooks from your settings rather than from this repo, so they fire here whether or not this repo has a settings file of its own. Start from an empty file. If you already copied one, delete the `SOLVO:BEGIN` comment line from your copy.
4. **The eol pin covers the whole directory, not just Solvo's files.** The managed `.gitattributes` block pins `/.github/prompts/** eol=lf`, and the same for `agents` and `skills`. That applies to every file in those directories, yours included, so a tracked CRLF file of your own gets renormalized to LF in the index the next time git touches it. If you need CRLF on your own file there, add a pattern for it below the managed block, the same last-match-wins rule as the gitignore above.

---

## Cross-repo workspaces (optional)

Solvo supports agent sessions that read across multiple repositories. One declaring repo carries the workspace roster in `solvo.json`; participating member repos point to it via `workspaceRef`. `solvo workspace sync` assembles the workspace by merging resolved member paths into the local settings file.

### Step 1 — Declare the workspace (in the hub repo)

In the repo that pragmatically spans the others (a hub service, or a wiki repo when one exists), add a `workspace` block to `solvo.json`:

```json
{
  "workspace": {
    "root": "..",
    "members": [
      {
        "name": "vms-common",
        "path": "vms-common",
        "remote": "git@gitlab.com:solvd1/…/vms-common.git",
        "purpose": "Shared DTOs and fleet event contracts.",
        "entryPoints": ["src/main/java/**/dto/**", "src/main/java/**/events/**"],
        "role": "lib",
        "product": "vms"
      }
    ]
  }
}
```

- **root**: workspace root, relative to this repo (typically `..` for siblings)
- **name**: repository name
- **path**: path relative to workspace root
- **remote**: git remote URL (enables bootstrap cloning from a fresh member clone)
- **purpose**: one-line summary (capped at 43 characters, so a roster stays cheap for an agent to carry)
- **entryPoints**: path globs hinting where to look first (max 3 globs, each max 26 characters). Standard glob syntax, so `src/**/*.{ts,tsx}` and `src/*.ts` both work, and `[` and `]` are character classes. A filename containing literal brackets needs them escaped as a class, `file[[]a[]].ts`, or `doctor` reports the glob as dead.
- **role**: `frontend` | `backend` | `infra` | `docs` | `lib`
- **product**: product label (`vms`, `admin`, etc.) or `shared` for cross-product members
- **advisory**: (optional, defaults to false) Enable product boundary checks and span tracking. When enabled, `/product-impact` and `/dev-ticket` check if a ticket spans multiple distinct non-shared products and propose splitting into linked tickets (advisory only, never blocks). Span data accumulates in `.solvo/analysis/workspace-span-log.jsonl` for cycle-by-cycle review. A full cycle of advisory data guides the decision to graduate the check to blocking, so the flag ships off by default and is enabled per workspace once the team is ready to collect that data. To enable: add `"advisory": true` to the workspace block.

The declaring repo does not list itself. A repo either declares `workspace` or carries `workspaceRef`, never both.

### Step 2 — Point members to the declarer

In each participating member repo, add a `workspaceRef` to `solvo.json`:

```json
{
  "workspaceRef": {
    "path": "../eng-wiki",
    "remote": "git@gitlab.com:org/eng-wiki.git"
  }
}
```

Or use string shorthand for path-only (when cloning is managed elsewhere):

```json
{
  "workspaceRef": "../eng-wiki"
}
```

### Step 3 — Assemble the workspace

From any member repo:

```bash
npx @solvd1/solvo workspace sync
```

This command:
1. Follows `workspaceRef` to the declaring repo (the declaring repo must already be present at the ref path; cloning it from `remote` is not yet supported)
2. Reads the workspace roster
3. Clones any absent members (prompts for consent on first clone of each remote — use `--yes` to skip in CI)
4. Merges resolved member paths into `.claude/settings.local.json` under `permissions.additionalDirectories`

The local settings file is gitignored (committed settings stay repo-portable). Re-run `sync` after roster changes to update paths.

**Why the consent prompt?** A roster change is security-relevant: sync clones whatever remotes the declarer names and grants the agent read access to the result. The prompt makes this explicit before the first clone of any new remote. In CI, use `--yes` to skip.

### Step 4 — Propagate roster changes

When the workspace roster changes (members added/removed/renamed), propagate to all members from the declaring repo:

```bash
npx @solvd1/solvo workspace sync --all
```

This runs sync into each present member in turn. Must run from the declaring repo. Validates and renders every member before writing any, so a mid-run refusal leaves nothing on a partial roster.

### The workspace map

`update` renders a `## Workspace Members` block into the managed region of your instruction
file, one line per member:

```
vms-common lib/vms: Shared DTOs and fleet event contracts. | src/main/java/**/dto/**
ejump (apps/ejump-app) frontend/ejump: React Native driver app. | src/screens/**
```

It says where to look, never what is there, so the agent knows a sibling exists and which
directory to reach for without any of that content being loaded. The path appears only when it
differs from the member name.

The map is capped at 1.5 KB and 40 lines. Past either cap, `update` FAILs rather than render a
shortened block, because a truncated map reads exactly like a complete one, and it refuses before
writing anything rather than leaving a half-updated install. The error names the largest rows, and
each cap carries its own remedy: shorten `purpose` text for the byte cap, drop a member or split
the workspace for the line cap.

Rows are built from `solvo.json` on every run, so a later `update` reproduces the map rather than
dropping it, and two runs over an unchanged roster produce byte-identical output.

Non-claude providers get no map: `codex` and `copilot` cannot be granted sibling directories, so a
table pointing at them would be a confident hint at paths the tool cannot open.

### Verification

`solvo doctor` checks workspace state:

- **Never synced**: `workspaceRef` present but no workspace paths in `additionalDirectories` (WARN)
- **Roster drifted**: re-resolved members no longer match `additionalDirectories` (WARN) — run `sync` to re-assemble
- **Dead entry-point glob**: a glob matching zero files sends local-first search to the wrong place, producing confident wrong answers (WARN)
