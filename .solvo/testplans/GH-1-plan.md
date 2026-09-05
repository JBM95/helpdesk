---
type: testplan
github: GH-1
tier: T2
tags: [tickets]
date: 2026-09-05
---

# GH-1 Test Plan — Preserve ticket list filters, sorting and pagination in the URL

Story: [[GH-1-spec]] · Domain: [[tickets]] · Feature: [[tickets-list]]

> **Grounding disclosure — this plan is not checked against docs/repo-wiki.**
> `docs/repo-wiki/` contains only scaffold READMEs: there is no `11-testing.md`, no domain or
> feature doc for tickets, and no `_memories/bugfix-*` note for this area. `solvo.json →
> specs.functionalDir` is empty, so there is no as-is functional spec either. No
> `.solvo/state/GH-1.json` exists, so there is no confirmed tier and no recorded `blastRadius`.
> Everything below was derived by reading the source files named in "Inputs", not from the wiki.

## Inputs this plan was derived from

**Tier: T2.** Taken from the story body's own "Why this is a T2 change" section (client-only
stateful UI behaviour; no schema, auth, email, AI, jobs, deploy or API-contract change). It is
**not** confirmed by a `tier:T2` label or a state file — the dev cycle has not started. If recon
lands a different tier, this plan is re-drafted as a new revision.

**Blast radius: provisional.** No state file, so this is derived from the story's stated likely
scope plus the imports actually present in the code:

- `client/src/pages/TicketsPage.tsx` — holds `filters` in `useState`
- `client/src/pages/TicketsFilters.tsx` — controlled by `filters` / `onChange`
- `client/src/pages/TicketsTable.tsx` — holds `sorting` and `pagination` in `useState`, resets
  `pageIndex` in a `useEffect` keyed on the `filters` object
- `client/src/pages/TicketsPage.test.tsx` — 26 existing tests, several asserting exact axios params
- `client/src/test/render.tsx` — `renderWithQuery` wraps in `MemoryRouter` with **no**
  `initialEntries` parameter
- Read-only constraints: `core/schemas/tickets.ts` (`ticketListQuerySchema`),
  `core/constants/ticket-status.ts` (`agentTicketStatuses`), `core/constants/ticket-category.ts`

**Source acceptance criteria (verbatim from issue #1):**

- [ ] Status, category and search filters are reflected in the URL.
- [ ] Sort field and sort direction are reflected in the URL.
- [ ] Current page is reflected in the URL.
- [ ] Opening a ticket and returning to the Tickets page restores the previous list state.
- [ ] Browser back/forward navigation restores the corresponding list state.
- [ ] Changing a filter or sort resets pagination to page 1.
- [ ] Unknown/invalid query-param values fall back safely to supported defaults rather than breaking the page.
- [ ] Empty/default values are omitted where practical so URLs remain clean.
- [ ] Existing `/api/tickets` request/response behavior remains unchanged.
- [ ] Add/update component tests covering URL initialization, state changes, pagination reset, and invalid params.

Numbered AC1–AC10 below in that order.

## The constraint that shapes this plan

`ticketListQuerySchema` validates the list query **server-side** with `z.enum` on `sortBy`,
`sortOrder`, `status` and `category`, and `status` is restricted to `agentTicketStatuses`
(`open`/`resolved`/`closed`). `validate` returns 400 on a miss, and `TicketsTable` renders
`ErrorAlert message="Failed to fetch tickets"` on any query error.

So an unvalidated URL param that reaches the axios call does not degrade — it blanks the page. That
makes AC7 the highest-risk AC in this story, and it is why the negative class below is enumerated
per-param rather than as one "invalid input" case.

## AC → test-type map

Dominant pattern in this repo is Vitest + React Testing Library component tests, with Playwright
reserved for real-browser navigation and full-stack flows (per `CLAUDE.md § Testing`). This map
follows that split.

| AC | Component (Vitest + RTL) | E2E (Playwright) | Class predicates met |
|---|---|---|---|
| **AC1** filters in URL | Mount at `/tickets?status=open&category=refund_request&search=login` → each control shows that value **and** axios receives it. Then change each of the three controls → URL search string gains the param. | — | happy, boundary (empty search), negative (AC7) |
| **AC2** sort in URL | Mount at `?sortBy=subject&sortOrder=asc` → `subject` header shows the asc arrow and axios gets `sortBy=subject&sortOrder=asc`. Click a header → URL gains both params; click again → `sortOrder` flips in the URL. | — | happy, boundary (each of the 5 sortable columns; both orders) |
| **AC3** page in URL | Mount at `?page=2` → axios `page: 2` and "Page 2 of N". Click Next/Last/Previous/First → URL `page` tracks. | Reload on `?page=2` keeps page 2 (needs a real reload) | happy, boundary (page 1, last page, page > pageCount) |
| **AC4** return from a ticket | Assert the list mounts from URL alone with no in-memory carry-over (same test as AC1–AC3 initialization). | Filter + sort + page 2 → open a ticket → return to the list → state restored | happy |
| **AC5** back/forward | `createMemoryRouter` + `router.navigate(-1)` across three list states, if the implementation makes history entries observable. | Real back/forward across three states, plus forward after back | happy, concurrency |
| **AC6** filter/sort resets page | At `?page=3`, change status → axios `page: 1` and the URL no longer says 3. Same for category, search and a sort-header click. | — | happy, **regression** (see below) |
| **AC7** invalid params fall back | Per-param negative matrix, each asserting defaults used, **no 400-triggering value sent**, and the page still renders the table (not `ErrorAlert`) | — | negative, boundary, failure |
| **AC8** clean URLs | Default state → empty search string. Set a filter then clear it → param removed, not left as `status=`. Default sort/page never appear. | — | happy, boundary |
| **AC9** API contract unchanged | The existing `should call axios.get with default sort and pagination params` test must still pass with its exact params object. Plus diff inspection: `server/**` and `core/schemas/tickets.ts` unchanged. | Existing `e2e/tests/tickets.spec.ts` list assertions unchanged | regression |
| **AC10** tests added | **Not independently verifiable** — it is a process AC satisfied by the case set generated from AC1–AC9. Flagged so `/qa-verify` does not look for a behaviour to prove. | — | n/a |

### AC7 negative matrix (each row is its own case)

`status=frozen` · `status=new` (valid in `ticketStatuses`, **rejected** by `agentTicketStatuses`) ·
`category=billing` · `sortBy=senderEmail` (a rendered column that is **not** in `sortableColumns`) ·
`sortOrder=sideways` · `page=0` · `page=-1` · `page=abc` · `page=999999` (beyond `pageCount`) ·
`?status=open&status=closed` (duplicate key) · an unknown param such as `?assignee=me` (must be
preserved or dropped — either is fine, breaking the page is not).

`sortBy=senderEmail` and `status=new` are the two that a naive allow-list will miss, because both
look plausible from the UI: the sender column renders an email, and `new` is a real ticket status.

### AC6 — the regression this story is most likely to introduce

`TicketsTable` currently resets `pageIndex` in a `useEffect` keyed on the `filters` **object**. Once
`filters` is derived from search params, a new object identity on every render resets the page to 1
on every render, and AC3/AC4/AC5 all fail while AC6 passes. Cases: "page 2 survives a re-render with
unchanged filters" and "page 2 survives a refetch" belong to AC3, and they are what catch this.

### Class coverage under the T2 rule

All six classes have their predicate met, so none is declined: **authz** because `/tickets` sits
behind `ProtectedRoute` and `/api/tickets` behind `requireAuth` (case: deep-link
`/tickets?status=open&page=2` while unauthenticated → login redirect, and whether the list state
survives the round trip); **concurrency** because the entry points can be driven twice (double-click
Next, type in search fast enough to stack history entries, back/forward mid-flight);
**failure** because every case's path calls `/api/tickets` (case: 400 and network error still render
`ErrorAlert`, and the URL is not corrupted by the failure).

## Regression scope (provisional — no recorded blast radius)

There is no `docs/repo-wiki/11-testing.md` naming suites, so this is the suite list read off disk:

**Must run and stay green**

- `client/src/pages/TicketsPage.test.tsx` — 26 tests; the ones asserting exact axios params are the
  sensitive ones and must not be loosened to `objectContaining` to accommodate new params
- `client/src/pages/TicketDetailPage.test.tsx` — the return-to-list path
- `client/src/components/TicketDetail.test.tsx`, `TicketSummary.test.tsx`, `ReplyForm.test.tsx`,
  `ReplyThread.test.tsx` — unchanged, run as the cheap blast-radius floor
- `client/src/pages/UsersPage.test.tsx`, `UserForm.test.tsx` — only relevant if `renderWithQuery` is
  changed (it is shared), which is why they are in scope
- `e2e/tests/tickets.spec.ts`, `e2e/tests/ticket-detail.spec.ts`, `e2e/tests/auth.spec.ts`

**Explicitly out of scope**: `server/**` (no server test suite exists in this repo),
`e2e/tests/webhook-inbound-email.spec.ts`, `e2e/tests/users.spec.ts` — no path from this change
reaches them.

**The shared-helper risk**: `renderWithQuery` takes no `initialEntries`, so testing URL
initialization means either extending that helper or using `MemoryRouter` directly in the new tests.
Extending it puts every component test in the blast radius. Whichever the implementer picks, the
full `cd client && bun run test` run is the check, not a targeted file run.

## Data prerequisites

- **Component tests**: none beyond the existing `mockTickets` fixture and mocked axios.
- **E2E pagination (AC3, AC4)**: ≥11 tickets in agent-visible statuses (`open`/`resolved`/`closed`)
  for a second page to exist at `pageSize: 10`. Note the existing webhook helper
  (`createTicketViaWebhook`) creates tickets with status `new`, which `/api/tickets` **excludes** by
  default — the tickets only appear once `classify-ticket` / `auto-resolve-ticket` have run. Confirm
  the seeding route before writing these cases; if AI jobs are not reliable in the E2E environment,
  seed via `prisma/seed.ts` or a direct status update instead.
- **E2E authz case**: an unauthenticated context plus a valid agent login.

## Environment needs

- Component: `cd client && bun run test` — now registered as `solvo.json → quality.tests.frontend`
- E2E: `bun run test:e2e` from the root — now registered as `quality.tests.e2e`; needs client +
  server + PostgreSQL, plus `WEBHOOK_SECRET` and `BETTER_AUTH_URL`
- `quality.tests.backend` stays an `n/a:` marker, restated as `"n/a: no server test suite exists in
  this repo"` — the honest reason, rather than the install-time "stack not recognised". This story
  touches no server code, so nothing here needs it.
- **Coverage is waived for this story**, decided by JB Mccallaghan at the plan gate.
  `quality.coverageArtifact` is `"n/a: not measured"` and no client coverage script exists, so the
  `coverageDiffLine: 80` target cannot be evidenced without first adding one — out of scope for a
  URL-state story. `solvo doctor` reports this as a visible `coverage-waiver` WARN and will keep
  doing so until a coverage artifact is configured; that visibility is the intended record. QA
  readiness for GH-1 therefore rests on the case set and the two charters below, not on a coverage
  number.

## Exploratory charters

Both are gating obligations from approval onward, at T2 exactly as at T3 — each becomes one
`manual`/`exploratory` obligation on the `/qa-execute` run and is closed by a human through
`qa-result perform`, not by the absence of a finding.

- **CHARTER**: explore the tickets list URL state with hand-edited and shared/bookmarked URLs to
  discover states the page cannot recover from *(from AC7)*
- **CHARTER**: explore browser history navigation on the tickets list with rapid back/forward and
  in-flight requests to discover stale list renders that disagree with the URL *(from AC5)*

## BMAD handoff

`specLayer.provider` is `bmad`, but no BMAD install is present in this repo (`.agents/skills/`
contains only `better-auth-best-practices` and `frontend-design`). Case generation therefore runs
through `/qa-cases` under `test-method` rather than BMAD QA. If BMAD is installed before
`/qa-cases`, hand it this plan as grounding and hold it to the same artifact contract.

## Next step

`/qa-cases 1` after this plan is approved.
