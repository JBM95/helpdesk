---
type: recon
github: GH-1
date: 2026-09-05
confidence: 7/7
---

# GH-1 Reconnaissance

Story: [[GH-1-spec]] · Plan: [[GH-1-plan]] · Cases: [[GH-1-cases]]

## Staleness pre-check

**Mode: greenfield.** docs/repo-wiki/_state/exploration-state.json does not exist. docs/repo-wiki/ contains only scaffold READMEs. No domain docs, no capability index, no memories. The exploration map has never been built. solvo.json specs.functionalDir is empty — no functional-spec baseline. Recon proceeds directly from code + story + QA artifacts, not from docs/repo-wiki.

## 0.1 Conceptual areas

- Ticket list view state: filters, sorting, pagination
- URL state management: reading URL search params on mount, writing params on state change
- Component testing infrastructure: renderWithQuery helper

## 0.2 Code map

### Core files

**client/src/pages/TicketsPage.tsx** (26 lines): Holds filters in useState, renders TicketsFilters and TicketsTable. Imported by App.tsx, TicketsPage.test.tsx.

**client/src/pages/TicketsFilters.tsx** (74 lines): Controlled component, receives filters and onChange props. Imported by TicketsPage.tsx only.

**client/src/pages/TicketsTable.tsx** (281 lines): Holds sorting and pagination in state. **Critical useEffect** (lines 107-109): resets pageIndex on filters object identity change. Calls /api/tickets via useQuery. Renders ErrorAlert on error (line 154).

**client/src/pages/TicketsPage.test.tsx** (400 lines, 26 tests): Line 186 has **exact params assertion** — must remain byte-identical per AC9.

**client/src/test/render.tsx** (15 lines): Wraps in MemoryRouter with **no initialEntries parameter**. Used by 7 test files. Blast-radius risk if extended.

### Router setup

React Router v7 with BrowserRouter. useSearchParams is available and correct for this work.

### Navigation to /tickets

Layout.tsx:52 and TicketDetailPage.tsx:27 both discard list state. AC4 case CASE-8e3d236b21a9 notes this is **implementation choice territory**.

### Validation boundary

**core/schemas/tickets.ts**: ticketListQuerySchema validates server-side. sortableColumns = [subject, senderName, status, category, createdAt]. status restricted to agentTicketStatuses = [open, resolved, closed]. **Consequence**: invalid URL param triggers 400, list blanks. AC7 risk.

**core/constants/ticket-status.ts**: agentTicketStatuses excludes new and processing. **AC7 trap**: ?status=new is real but not in agentTicketStatuses.

**server/src/routes/tickets.ts**: validate returns 400 on failure. Request/response contract unchanged per AC9.

## 0.3 Blast radius

### Files potentially touched

client/src/pages/TicketsPage.tsx (must change), TicketsFilters.tsx (may change), TicketsTable.tsx (must change), TicketsPage.test.tsx (must change), test/render.tsx (may change).

### Callers

Direct: App.tsx, TicketsPage.test.tsx, Layout.tsx, TicketDetailPage.tsx. renderWithQuery: 7 test files. Total: 10 files.

**Escalation check**: 5 files < 15, 10 callers < 40 — well below thresholds, T2 confirmed.

### Tests

Component: TicketsPage.test.tsx (26 tests, line 186 non-negotiable), TicketDetailPage.test.tsx. E2E: tickets.spec.ts, ticket-detail.spec.ts, auth.spec.ts. No server tests (out of scope per AC9).

### Feature flags

None.

### Database

No changes. Purely client-side URL plumbing.

## 0.4 Prior work and patterns

useSearchParams is **not used anywhere** in the client. This establishes the first URL-state-persistence pattern. No capability index, no bugfix post-mortems. All three files introduced in initial commit (65da45b), no churn.

## 0.5 Risks and regression baseline

### High-risk areas

1. **AC7 — invalid URL params**: dominant risk. Unvalidated param blanks page. Per-param validation **required**.
2. **AC6 — pagination reset**: useEffect keyed on filters object. Object identity changes on every render unless memoized. QA plan flags this.
3. **renderWithQuery extension**: widens blast radius to all 7 caller test files.

### Specific traps from AC7

?status=new (excluded from agentTicketStatuses), ?sortBy=senderEmail (absent from sortableColumns), ?page=0/-1/abc/1.5 (must clamp/coerce), duplicate keys.

### Regression baseline

**Must remain green**: Line 186 exact assertion, all 26 TicketsPage tests, E2E flows.
**Must not introduce**: server changes, core/schemas/tickets.ts changes, new query params.

## 0.6 Confidence check (7/7)

All seven YES.

## Answers to specific questions

### 1. Every consumer of ticket-list view state

TicketsPage.tsx, TicketsFilters.tsx, TicketsTable.tsx (direct consumers). Layout.tsx:52, TicketDetailPage.tsx:27 (navigation, implementation choice territory).

### 2. renderWithQuery callers

7 test files. Blast-radius impact if extended. **Recommendation**: leave unchanged, inline MemoryRouter with initialEntries in new tests.

### 3. useEffect object-identity concern

TicketsTable.tsx:107-109. **Solution**: memoize filters object with useMemo or derive in parent. AC3 cases CASE-9a9129bfb43d and CASE-33183e39dc55 catch this.

### 4. Validation boundary

Server accepts: sortBy enum, sortOrder enum, status enum (agentTicketStatuses only), category enum, search string, page coerced int min 1, pageSize coerced int min 1 max 100. **Client validation required** before axios call. ErrorAlert on error, list blanks. AC7 highest risk.

### 5. Router setup

BrowserRouter, React Router v7. useSearchParams is correct API.

### 6. Prior work

useSearchParams not used anywhere. First instance of pattern.

### 7. Blast radius counts

5 files, 10 callers. Thresholds: 15 files, 40 callers. **Well below, T2 confirmed**.

## Recommendation

**Proceed with T2 build.** 7/7 confidence. Blast radius manageable. QA approved 74 cases, plan revision 2. High-risk areas identified and mitigated. No stale docs (greenfield). No feature flags, schema, or server changes.

**Implementation notes**: Leave renderWithQuery unchanged. Memoize filters object. Validate every param client-side. Decide navigation-link behavior and document per AC4 case CASE-8e3d236b21a9.
