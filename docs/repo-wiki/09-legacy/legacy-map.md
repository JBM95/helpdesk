---
tags: [legacy, client]
---

# Legacy Map — Client

> Audited by `explore-13-legacy-detective` via `/setup-05-explore client` on 2026-09-07.
> Scope: `client/` only. Excluded: `client/src/components/ui/` (vendored shadcn primitives).

## Summary

**Four findings. None is a risk-tier item.**

This is a new, modern codebase — React 19, Vite 7, Tailwind 4, TypeScript 5.9, every file touched within the last day, no legacy framework remnants. Adherence to the declared conventions is near-100% at sampled sites ([[08-standards/observed]]). The findings below are isolated inconsistencies, not systemic debt, and the honest summary is that there is very little to report.

The five *structural* gaps in this repo (no CI, no server ESLint, TypeScript strictness split, no coverage thresholds, test distribution) are recorded in [[08-standards/conflicts]] and deliberately **not** duplicated here as legacy findings — they are configuration gaps, not decaying code.

## Frontend

### Duplicated domain knowledge — `TicketsFilters.tsx:66-68`

The category filter hardcodes its three options as literal `SelectItem` values:

```tsx
<SelectItem value="general_question">General question</SelectItem>
<SelectItem value="technical_question">Technical question</SelectItem>
<SelectItem value="refund_request">Refund request</SelectItem>
```

The status filter **in the same file** (`:47`) maps over `agentTicketStatuses` imported from `core/constants/ticket-status.ts`, and `UpdateTicket.tsx:86-88` maps over `ticketCategories` with `categoryLabel[c]`. Verified: `ticketCategories` is imported in `UpdateTicket.tsx:5`, and `categoryLabel` in `TicketsTable.tsx:14`.

So the shared constant exists, is used elsewhere for exactly this purpose, and is bypassed here. **Adding a category to `core/constants/ticket-category.ts` would silently fail to appear in the filter.** Registered as [[tech-debt|TD-01]].

### Style inconsistency — `StatusBadge.tsx:3-9`

```tsx
const statusStyles: Record<TicketStatus, string> = {
  new: "bg-sky-500/15 text-sky-400",
  processing: "bg-amber-500/15 text-amber-400",
  open: "bg-pink-400/15 text-pink-400",
  resolved: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
};
```

Three of five statuses use hardcoded Tailwind palette colours; the other two use semantic tokens. CLAUDE.md declares semantic tokens over hardcoded colours, and the rest of the client outside `components/ui/` honours that at 100%.

**Judgement: defensible design choice, inconsistently applied.** Distinguishing five ticket statuses genuinely needs more hues than the semantic palette offers, so reaching for `sky`/`amber`/`pink` is reasonable. What makes it a finding is the *mix* — two statuses fall back to `bg-muted`, so the visual language is half-semantic and half-literal within one object. Registered as [[tech-debt|TD-02]].

## Build tooling

### Type escape hatch — `vite.config.ts:20`

`sentryVitePlugin({...}) as any`. Verified present. Almost certainly a typing mismatch between `@sentry/vite-plugin` and Vite 7's plugin type. Runtime behaviour is correct — source maps upload when the token is set. Registered as [[tech-debt|TD-03]]; the honest recommendation is to leave it.

## Documentation

### Stale template — `client/README.md`

Still the unmodified Vite + React + TypeScript scaffold ("This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules"). Its ESLint guidance references plugins the project does not use, and it mentions none of what the client actually is — Bun, Tailwind 4, shadcn/ui, Vitest, Better Auth. Registered as [[tech-debt|TD-04]].

## Searched for and not found

Each of these was checked and came back clean:

| Pattern | Result |
|---------|--------|
| `TODO` / `FIXME` / `HACK` comments | **0** (verified) |
| Commented-out code blocks | 0 |
| Dead code / unused exports | 0 — every page is routed, every component imported |
| `console.log` in source | 0 |
| Empty catch blocks | 0 |
| Missing error handling | 0 in queries and mutations, with the single exception of `UpdateTicket.tsx` having no error surface (recorded in [[13-cross-cutting]], behavioural rather than legacy) |
| AngularJS / jQuery / Bower / pre-2015 patterns | 0 |
| Deprecated packages | 0 — see [[dependencies]] for version currency, which is a separate question from deprecation |

## Deliberately not classified as debt

Recorded so a later pass does not re-raise them:

- `main.tsx:12` — `document.getElementById("root")!`. Standard React entry point; the element is guaranteed by `index.html`.
- `TicketDetailPage.test.tsx:24` — the jsdom PointerEvent polyfill. Necessary to test Radix primitives, and the right pattern to copy.
- `TicketsFilters.tsx:39,58` — `value as TicketFilters["status"]`. Required by the `"__all__"` sentinel, which exists because Radix `Select` cannot hold an empty value. A narrowing helper would be tidier but no safer.
- `BackLink.tsx`, `UpdateTicket.tsx`, `TicketDetailSkeleton.tsx` — single-use components, legitimately local to one page. Not duplication and not dead.

## Related

- [[tech-debt]] — the ranked register
- [[08-standards/conflicts]] — the five structural gaps, not repeated here
- [[00-scope]] — refactors are OUT for this horizon
