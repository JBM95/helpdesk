---
type: guide
tags: [solvo, onboarding, ba]
---

# Solvo — Glossary for the Business Analyst

Plain-language definitions for the terms a BA meets in `/product-spec`, `/product-story`,
`/product-epic`, `/product-groom`, `/plan-backlog`, and their output. Each entry names where
you'll run into it. Sourced from the shipped skill files (cited per entry) — if a definition
here and its source disagree, the source file is right and this page is stale.

---

**Ambiguity scan** — a check the coding agent runs on every acceptance criterion, looking for a
reading that could go two honest ways. A hit stops the work and sends the AC back to you for
clarification instead of letting the agent guess.
*Where you'll see it: a comment on your story or spec asking you to resolve one AC, before build
starts.*
<!-- source: plugin/skills/gated-cycle/SKILL.md, "Spec" phase rule -->

**Blast radius** — how many files and callers a change touches, measured once the coding agent
starts building. It's one of the facts that decides a story's risk tier.
*Where you'll see it: not usually shown to you directly — it can trigger the tier bump below.*
<!-- source: plugin/skills/gated-cycle/SKILL.md, state file `blastRadius` field; plugin/skills/risk-tiering/SKILL.md, "Escalation" -->

**Blast-radius escalation** — the rule that a story proposed as T1 gets bumped to T2 automatically
if the actual change ends up touching more files or callers than T1 allows. It only moves risk
up, never down, and it isn't a judgment call — the tool enforces it.
*Where you'll see it: a tier on a story changing after build starts, with no one having asked you
first — that's this rule, not a mistake.*
<!-- source: plugin/skills/risk-tiering/SKILL.md, "Escalation" -->

**Definition of Ready (DoR)** — the checklist a story has to pass before it's fit to hand to a
developer: acceptance criteria that are testable and cover edge cases, a confirmed risk tier,
the people affected named, links to the relevant part of the system, zero open questions left
unanswered, and any dependency on other stories named and recorded.
*Where you'll see it: `/product-groom` and `/plan-backlog` score every story against this list
before it's allowed into a sprint.*
<!-- source: plugin/skills/story-method/SKILL.md, "Definition of Ready" -->

**Evidence pack** — a record assembled for every story before its merge request opens, covering
the tier, who approved each gate, the spec, the commits, the tests that ran, and the reviews.
It's the audit trail a reviewer or auditor reads later — you won't usually write one yourself.
*Where you'll see it: linked from the merge request once a story you wrote is implemented.*
<!-- source: plugin/skills/evidence-pack/SKILL.md -->

**Gate** — a checkpoint in the build process where someone has to say yes, in words, before work
continues. Some gates are automatic sign-off; the riskiest tier requires a named human.
*Where you'll see it: "GATE 1" language in a story's build comments, and the plan/merge gates a
tier's row of the table below runs.*
<!-- source: plugin/skills/gated-cycle/SKILL.md, phase list; plugin/skills/risk-tiering/SKILL.md, "Effects" table -->

**Gherkin** — the `Given <situation> / When <action> / Then <result>` sentence shape used to write
acceptance criteria. Each AC states one thing you can watch happen, in words a non-developer can
read, with no code or database detail in it.
*Where you'll see it: every acceptance criterion `/product-spec` and `/product-story` write for
you follows this shape.*
<!-- source: plugin/skills/story-method/SKILL.md, "Gherkin AC rules" -->

**Negative space** — the part of a story that says what will *not* change. Naming it up front is
what stops a developer from quietly expanding scope while building.
*Where you'll see it: a line in your story or spec describing what stays as-is.*
<!-- source: plugin/skills/story-method/SKILL.md, "Gherkin AC rules" -->

**Refinement** — the recurring review where the top of the backlog is checked against the
Definition of Ready, and anything not ready is either fixed on the spot, sent back for more
detail, or dropped, before it can be pulled into a sprint.
*Where you'll see it: `/plan-backlog`, run as a session before `/plan-iteration`; each reviewed
item gets a Ready / Needs Work / Blocked comment.*
<!-- source: plugin/commands/plan-backlog.md -->

**State file** — the one JSON record per story that the coding agent updates after every phase
of a build: tier, who approved which gate, test results. You won't normally open it yourself.
*Where you'll see it: named in a message if a merge request gets blocked — the block is usually
this file missing a field the checks require.*
<!-- source: plugin/skills/gated-cycle/SKILL.md, "State file" -->

**Tier (T1 / T2 / T3)** — the risk level assigned to every story, which decides how much oversight
and review it gets. **T1 (Peripheral)** is copy, config, or low-risk fixes — reviewed
automatically, merge gate only. **T2 (Standard)** is typical feature or bug work — a plan gate
plus a merge gate, with a human checking in rather than approving every step. **T3 (Core /
Regulated)** is money movement, auth, personal data, or regulated logic — a plan gate, an
implementation gate, and a merge gate, with a human approving each one and doing a full review
before merge, every time. Full breakdown:
[Risk tiers & escalation](https://solvd1.gitlab.io/common/agentic-development/ai-first-sdlc-toolkit-docs/solvo/governance/risk-tiers/).
*Where you'll see it: proposed by the coding agent on your story or spec, with you (or another
named human) confirming or overriding it.*
<!-- source: plugin/skills/risk-tiering/SKILL.md, "Tier definitions" -->

**Vault** — the whole repository, treated the way a note-taking tool like Obsidian treats a
vault: every generated document is a page with a short header (frontmatter) and links to related
pages, so the collection reads as one connected map rather than loose files.
*Where you'll see it: your spec and story files link to the domain and feature they touch; that
linking is this convention.*
<!-- source: plugin/skills/obsidian-conventions/SKILL.md -->
