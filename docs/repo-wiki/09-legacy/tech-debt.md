---
tags: [tech-debt, register, client]
---

# Tech Debt Register — Client

> Audited by `explore-13-legacy-detective` via `/setup-05-explore client` on 2026-09-07. Scope: `client/` only.
>
> **This is a register, not a work plan.** [[00-scope]] puts refactors explicitly out of scope for the current horizon. Nothing here is scheduled, and nothing here should be folded into unrelated work.

Four entries. No risk-tier findings. Total remediation, if every one were addressed: well under an hour.

| ID | Finding | Tier | Effort | Urgency |
|----|---------|------|--------|---------|
| TD-01 | Hardcoded ticket categories in the filter dropdown | Friction | ~5 min | Low — bites only when a category is added |
| TD-02 | `StatusBadge` mixes palette colours with semantic tokens | Friction | ~30 min, or 2 min to document the exception | Low — visual consistency, not correctness |
| TD-03 | `as any` on the Sentry Vite plugin | Load-bearing | 0 min (leave) | None |
| TD-04 | `client/README.md` is untouched Vite boilerplate | Load-bearing | ~15 min, or delete | None |

---

## TD-01 — Hardcoded ticket categories in the filter dropdown

**Area** Frontend — tickets filters
**File** `client/src/pages/TicketsFilters.tsx:66-68`
**Tier** Friction

**Evidence.** The category `Select` lists its three options as literal `SelectItem` elements. The status `Select` in the same component (`:47`) maps over `agentTicketStatuses` from `core/constants/ticket-status.ts`. Elsewhere, `UpdateTicket.tsx:5,86-88` imports and maps over `ticketCategories` with `categoryLabel[c]`, and `TicketsTable.tsx:14` imports `categoryLabel`. All verified directly.

**Why it matters.** The shared constant exists and is used for this exact purpose in a sibling component. Adding a fourth category to `core/constants/ticket-category.ts` would appear in the ticket-detail dropdown and in the table's label rendering, but **not** in the list filter — silently, with no type error, because the literals still compile. The failure mode is a filter that quietly cannot reach a subset of tickets.

**Shape of the fix.** Mirror what the status control already does in the same file — map over `ticketCategories`, label via `categoryLabel`.

**Blast radius.** One dropdown in one file. No API, state or type change.

**Note on scope.** This sits in a file the current horizon's story touches. It is *not* part of that story, and folding it in would widen a deliberately bounded change. Left recorded, unscheduled.

---

## TD-02 — `StatusBadge` mixes palette colours with semantic tokens

**Area** Frontend — components
**File** `client/src/components/StatusBadge.tsx:3-9`
**Tier** Friction

**Evidence.** `statusStyles` maps `new`, `processing` and `open` to hardcoded Tailwind palette classes (`bg-sky-500/15 text-sky-400`, `bg-amber-500/15 text-amber-400`, `bg-pink-400/15 text-pink-400`) while `resolved` and `closed` use `bg-muted text-muted-foreground`. CLAUDE.md declares semantic tokens over hardcoded colours; [[08-standards/observed]] records 100% adherence everywhere else outside `components/ui/`.

**Why it matters — and the honest counter-argument.** Five statuses need five distinguishable colours, and the semantic palette does not supply five. Reaching for named hues is a defensible call. The finding is the *inconsistency within one object*: two statuses use tokens and three do not, so the badge's colour language is half-derived from the theme and half-literal, and a theme change will move two of the five.

**Two acceptable resolutions.** Either promote the three literals into theme tokens so all five derive from the theme, or accept the literals as deliberate and record the exception in CLAUDE.md so it stops reading as a violation. Documenting it is the cheaper and probably better answer.

**Blast radius.** One constant. `StatusBadge` is consumed at `TicketsTable.tsx:74` and `TicketDetail.tsx:18`.

---

## TD-03 — `as any` on the Sentry Vite plugin

**Area** Build tooling
**File** `client/vite.config.ts:20`
**Tier** Load-bearing — document and leave

**Evidence.** `sentryVitePlugin({ disable, org, project, authToken }) as any`. Verified present at line 20.

**Why it exists.** A type mismatch between `@sentry/vite-plugin` and Vite 7's plugin signature. The cast suppresses a compile-time complaint; runtime behaviour is correct, and source-map upload works when `SENTRY_AUTH_TOKEN` is set ([[12-build-deploy]]).

**Recommendation: leave it.** This is an upstream typing problem, not a defect in this repo. The alternative — hand-writing a structural type to satisfy the plugin interface — would be more code, more fragile, and would need removing once upstream fixes it. Worth revisiting only if the Sentry plugin is upgraded and the cast can simply be deleted.

**Blast radius.** One line of build config. No runtime or correctness impact.

---

## TD-04 — `client/README.md` is untouched Vite boilerplate

**Area** Documentation
**File** `client/README.md`
**Tier** Load-bearing — harmless

**Evidence.** Opens with "# React + TypeScript + Vite / This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules." Its ESLint section references plugins the project does not use, and it mentions none of Bun, Tailwind 4, shadcn/ui, Vitest or Better Auth.

**Why it matters, mildly.** It is actively misleading to a newcomer, and it is the first file many people open. The genuine onboarding gap in this repo is documented elsewhere and is sharper: `prisma generate` is unwired, so a fresh clone cannot type-check or start the server ([[12-build-deploy]]). A README that said only that would be worth more than this one.

**Two resolutions.** Replace with a short client-specific note, or delete it — the root `CLAUDE.md` already documents the stack and the dev commands, so deletion loses nothing.

**Blast radius.** Documentation only.

---

## Related

- [[legacy-map]] — the evidence behind each entry
- [[08-standards/conflicts]] — the five structural gaps (no CI, no server ESLint, strictness split, no coverage thresholds, test distribution). Recorded there, not here.
- [[13-cross-cutting]] — `UpdateTicket.tsx` surfacing no error on a failed `PATCH`; behavioural, so recorded there rather than as debt
- [[dependencies]] — version currency, a separate concern from deprecation
- [[00-scope]] — refactors are OUT this horizon
