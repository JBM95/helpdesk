# Weekly Solvo Rollup — <team/repo slug>

> **Week**: <YYYY-MM-DD> to <YYYY-MM-DD>
> **Filled by role**: team lead
> **Repo**: <repo slug>

This rollup reports team-aggregate metrics only. No field here is broken out, filterable, or attributable to an individual, and nothing here ranks people or tickets against each other — there is no leaderboard and no per-person latency figure anywhere in this document. That is a deliberate constraint, not an oversight: per-person delivery metrics reaching a pilot team risk reading as covert performance surveillance, which the adoption review ruled out for this rollout. This paragraph is the written record of that ruling — if you are tempted to add a name, a per-person time figure, or a ranking column here, that ruling is the reason not to.

The blank template at `docs/repo-wiki/_templates/weekly-rollup-template.md` is the only authoritative copy of these field definitions. A wiki page or shared-drive copy is not covered by `npm test` and will drift silently — edit that file, not a copy.

## The set

Fields 1-4 below all scope to the same ticket set: every `.solvo/state/<KEY>.json` whose file received at least one commit inside the reporting week. Compute it once (Fill procedure step 2) and reuse it for every field, so two leads scope the same tickets.

- Window boundary is commit date, not author date, in UTC (00:00:00Z to 23:59:59Z).
- A ticket touched more than once in-window counts once per field, not once per commit.
- A T2/T3 ticket still mid-cycle (no `review` block yet) is excluded from fields 3-4's denominator — not counted as zero.

## When a field has no data

A field with an empty source set reads `not available: <specific reason>` — never a bare `0`. A `0` is a real count (zero gates cleared this week is data); an empty set is the absence of an opportunity to count anything, and the two must never look the same on the page.

## 1. Tickets by tier

`.solvo/state/<KEY>.json` → `tier`. One row per tier (T1/T2/T3 — the only valid values); each KEY in the set counted once, under the `tier` value at its last in-window commit. A file in the set whose `tier` is missing, null, or not one of T1/T2/T3 counts under its own `tier not recorded` row — never guessed into a tier, and never silently dropped.

<fill in per-tier counts, or `not available: <reason>` if the set is empty>

## 2. Gates cleared

`.solvo/state/<KEY>.json` → `gates.<gate>.approved`. Sum of `approved: true` entries across the set. Deliberately tier-blind: tiers carry different gate counts (T1 merge-only, T3 plan + implementation + merge), so this number moves with the tier mix and must be read alongside field 1, never alone as throughput. `by` and `at` exist in the data and are deliberately not published — counts only.

<fill in the sum, or `not available: <reason>` if the set is empty>

## 3. Fresh-review outcomes

`.solvo/state/<KEY>.json`, T2/T3 only → `review.verdict`. Tally `APPROVE` vs `REQUEST_CHANGES` across every T2/T3 file in the set that carries a `review` block. This is the final round's outcome only, never a per-round history. T1 files carry no `review` block by design; excluded from the denominator, never counted as a zero-blocker review.

<fill in the tally, or `not available: no T2/T3 file in the set carries a review block` if the filtered set is empty>

## 4. Blockers outstanding at final review

Same T2/T3-with-`review` subset → `review.blockersOpen`. Sum of `blockersOpen` across that subset. Named for exactly what it is: the count outstanding when review was last written, not the count found across the cycle — earlier rounds' higher counts do not survive re-dispatch.

<fill in the sum, or `not available: no T2/T3 file in the set carries a review block` if the filtered set is empty>

## 5. Evidence-pack completeness

`.solvo/evidence/<KEY>.md` files committed in-window → frontmatter `status`. Tally `complete` vs `INCOMPLETE` from the frontmatter field only — never a prose scan. `status` is what `solvo finalize-gate` reads and is authoritative; a `Reviews` section that discusses an incomplete part of a `status: complete` pack is not a finding. Matching is exact and case-sensitive; any `status` value other than exactly `complete` or `INCOMPLETE` is listed on its own line verbatim, not folded into either bucket.

<fill in the tally, or `not available: <reason>` if no evidence pack was committed this week>

## 6. Escalations

No structured source exists yet: `not available: escalations are not recorded as a structured artifact field`. AFSP-435 adds structured escalation recording; until it lands, do not infer this field from `tierConfirmedBy` prose or `blastRadius`.

## Deliberately absent metrics

This template does not attempt the following, and will not until the noted precondition holds:

- **Velocity delta** — not reportable without a pre-adoption baseline in the same units; nothing here compares against nothing. Becomes reportable once the team has a stated pre-adoption baseline measurement to diff against.
- **Defect escape rate** — not reportable this early: the measurement window is a handful of weeks, and a rate computed over that few tickets swings on one incident rather than describing a trend. Becomes reportable once the team has accumulated enough merged-and-observed history to state a denominator it trusts.

## Fill procedure

Manual only — none of these steps writes or runs a script.

1. Agree the week's boundary once per team (a sprint week or a calendar week), copy the blank template to `docs/repo-wiki/rollups/<week-start YYYY-MM-DD>-weekly-rollup.md` — one file per week, so the shipped template at `docs/repo-wiki/_templates/weekly-rollup-template.md` stays blank (the copy keeps every section of the template, including this fill procedure) — use the repository's name, as the remote names it, for `<team/repo slug>` and `<repo slug>`, and write the week's two dates into the copy's `Week` header — the boundary is always the first date at 00:00:00Z to the last date at 23:59:59Z.
2. `git log --since=<start> --until=<end> --name-only --diff-filter=AM -- .solvo/state/` — collect the distinct `.solvo/state/<KEY>.json` paths touched. This is the ticket set for fields 1-4.
3. For each path in the set, open the file (at HEAD, or `git show <last in-window commit>:<path>` if the ticket has moved since) and read `tier`.
4. Tally field 1 by `tier`, one count per KEY.
5. Sum `gates.<gate>.approved === true` across the set for field 2. Do not record `by` or `at`.
6. Filter the set to `tier` T2 or T3 with a `review` key present. Tally field 3 by `review.verdict`. If the filtered set is empty, write field 3 as exactly `not available: no T2/T3 file in the set carries a review block`.
7. On the same filtered set, sum `review.blockersOpen` for field 4. Empty set → write field 4 as exactly `not available: no T2/T3 file in the set carries a review block`.
8. `git log --since=<start> --until=<end> --name-only --diff-filter=AM -- .solvo/evidence/` — collect the evidence-pack paths touched. For each, read the frontmatter `status`. Tally field 5. Empty set → not-available.
9. Write field 6 as the fixed not-available line above. Do not investigate further.
10. Copy the Deliberately Absent Metrics section verbatim, unedited.
11. Re-read the guardrail paragraph and the authoritative-copy line; confirm neither was trimmed.
12. Commit the filled per-week file, and record in the commit message (or the tracker) which KEYs made up the set — the reproducibility check a second lead needs.
