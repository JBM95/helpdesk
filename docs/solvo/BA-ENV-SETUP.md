---
type: guide
tags: [solvo, onboarding, ba]
---

# Solvo — Environment Setup for the Business Analyst

This page gets you from a new machine to a working `/product-spec` / `/product-story` session on
an **already-configured** Solvo repo. Setting up a brand-new repo is a different job — see
`docs/solvo/INSTALL.md` for that.

---

## 1. What you're setting up, and why

A **repository** ("repo") is the project's folder, tracked by a tool called git so every change
has a history. A **clone** is your own local copy of that repo: you need one because the coding
agent reads and writes files on your machine, not on a server.

Two things you sign into once your clone exists: your source-control host (GitLab, GitHub, or
Azure DevOps — whichever this project uses) and your tracker (Jira, or the same host if it also
tracks tickets). Both need proof it's really you. A password alone isn't enough for a tool acting
on your behalf, so each host issues a narrower credential instead — see step 3.

## 2. Install and open the coding agent

Install Claude Code (the coding agent this framework is built for) from
`https://claude.com/claude-code` and sign in with your Anthropic account.

Open Claude Code **inside your clone of the project folder** — not a parent folder, not an empty
folder. You opened the right one if a `solvo.json` file is visible in the file list Claude Code
shows you, or if you can list the folder's contents in its terminal (`ls` on macOS/Linux, `dir` on
Windows) and see it there. If the repo uses
the Claude Code plugin (ask a teammate, or check for a `.claude/settings.json` that mentions
`solvo`), Claude Code prompts you to install it the first time you open the folder — accept that
prompt.

## 3. Get a credential for your source-control host and sign in

Only do the row for the host this project actually uses (ask a teammate, or check `solvo.json` →
`scm.provider` if you can open it).

Each row's commands need that host's CLI installed first: `glab` for GitLab, the Azure CLI (`az`)
for Azure DevOps, `gh` for GitHub. Ask a teammate for your team's install method (Homebrew,
winget, apt) if you don't already have it.

| Host | What to do | Notes |
|---|---|---|
| **GitLab** | Create a personal access token at your GitLab instance → **Settings → Access Tokens**, scope **`api`**. Run `glab auth login` in a terminal and paste the token when asked. | The **`api`** scope is GitLab's own name for full read/write repo access — don't pick a narrower one, the tool needs to open merge requests. A reviewer-facing scope table is at https://gitlab.com/solvd1/ai-first-sdlc/robots/solvo/-/blob/main/docs/pilot-wiki/security-review.md. |
| **Azure DevOps** | Create a personal access token in ADO → **User settings → Personal access tokens**, scope **`Code read & write`**. Set it as the environment variable `AZURE_DEVOPS_EXT_PAT` on your machine (ask a teammate for how your team sets machine-level env vars, e.g. your shell profile or OS environment settings). | No separate tracker sign-in — ADO tracks tickets in the same place. |
| **GitHub** | Run `gh auth login` in a terminal and follow the browser prompt. | No token to create — `gh` handles it for you. |
| **Jira** | Sign in through the Atlassian sign-in prompt Claude Code shows you the first time a command needs Jira. | No token to create — this is a browser sign-in (OAuth), not a token you mint. |

**Never paste a token into a chat message, a commit, or a file in the repo.** A token goes only
into the tool that asked for it (`glab auth login`, your OS environment settings). If you're ever
unsure whether a token you're about to use has the right scope but not more, that's a separate
question this sheet doesn't answer — ask a teammate.

## 4. Confirm it worked

In a terminal, inside your clone:

```bash
npx @solvd1/solvo doctor
```

A healthy result is green except possibly one warning line about a spec-writing toolkit (BMAD or
speckit — whichever this project uses) not being installed yet. That single warning is expected
and not a sign your setup is broken; everything else should read green (checkmarks) rather than
`FAIL`.

If you see a `FAIL` line, it names what's missing — most often it's step 2 (wrong folder) or step
3 (credential not signed in yet). Fix that one thing and run `doctor` again.

Once `doctor` looks right, you're ready to run `/product-spec` or `/product-story` in Claude Code.
