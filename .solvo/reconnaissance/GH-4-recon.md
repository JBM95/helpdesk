# Reconnaissance: GH-4 — Add Clear filters action

**Work item**: GH-4  
**Date**: 2026-09-07  
**Scope**: Add a Clear filters action to the Tickets page  
**Recon agent**: reconnaissance worker

---

## Staleness pre-check

Checked `docs/repo-wiki/_state/exploration-state.json`:
- `client` sub-system: status="partial", staleness="fresh", last explored 2026-09-07 at LOC 5,363 (matches current).
- Work is client-only per story scope ("No API, database, authentication, background-job, schema, or URL-state changes").
- **Result**: proceed. No sub-system refresh needed.

**Churn measurement**: All sub-systems show `churn.source: "unavailable"`, `measuredAt: null`. Per `exploration-state.json` changelog entry at 2026-09-07T12:20:00.000Z, the global solvo shim is broken (MODULE_NOT_FOUND on dist/solvo.js). Churn fields remain as recon scout left them. This does not block recon — the client sub-system is fresh by age alone.

---

## 0.1 — Conceptual areas

Single area: **Ticket list filtering** (client-side UI controls).

---

## 0.2 — Code map

### State ownership (client/src/pages/)

| Concern | Owner | Location | Detail |
|---------|-------|----------|--------|
| Filters | `TicketsPage.tsx` | `:14` | `useState<TicketFilters>({})` — all three fields optional, initially `undefined` |
| Sort | `TicketsTable.tsx` | `:99-101` | `useState<SortingState>([{ id: "createdAt", desc: true }])` |
| Pagination | `TicketsTable.tsx` | `:102-105` | `useState<PaginationState>({ pageIndex: 0, pageSize: 10 })` |

`TicketFilters` interface declared at `TicketsPage.tsx:7-11`:
- `status?: TicketStatus`
- `category?: TicketCategory`
- `search?: string`

`TicketsPage` passes `filters` and `setFilters` to `TicketsFilters` (`:21`), and `filters` read-only to `TicketsTable` (`:22`).

### Filter control defaults (client/src/pages/TicketsFilters.tsx)

`ALL = "__all__"` sentinel declared at `:13`. Never reaches state or network — exists only for Radix `Select` display layer.

| Control | Line | Display value | State write |
|---------|------|---------------|-------------|
| Search | 28-33 | `filters.search ?? ""` | `e.target.value \|\| undefined` — empty input becomes `undefined`, never `""` |
| Status | 36-53 | `filters.status ?? ALL` | `value === ALL ? undefined : value` |
| Category | 55-70 | `filters.category ?? ALL` | `value === ALL ? undefined : value` |

**"At default"** = all three fields are `undefined`. Initial state is `{}`, which satisfies this.

### Query composition (client/src/pages/TicketsTable.tsx)

Query key (`:119`): `["tickets", sortBy, sortOrder, filters, pagination.pageIndex]`

Request params (`:122-128`):
The `...filters` spread means `undefined` fields are **omitted from the query string entirely**, not sent as empty values.

### Pagination reset mechanism (client/src/pages/TicketsTable.tsx:107-109)

Dependency is `filters` **object identity**. `TicketsFilters` constructs a fresh object on every change, so this fires on any filter interaction. Calls `setPagination((prev) => ({ ...prev, pageIndex: 0 }))`.

### No debouncing

Search input calls `onChange` directly on every keystroke (`TicketsFilters.tsx:31`). No `useDebounce`, no `setTimeout`, no debounce library. Each keystroke triggers state update, pagination reset effect, and new TanStack Query fetch.

**Implication for Clear action**: Resetting search to `undefined` is instantaneous — no debounce interaction to consider.

### Server-side defaults (core/schemas/tickets.ts:31-39)

`ticketListQuerySchema`:
- `sortBy`: default `"createdAt"`
- `sortOrder`: default `"desc"`
- `status`: optional (no default)
- `category`: optional (no default)
- `search`: optional (no default)
- `page`: default `1`
- `pageSize`: default `10`

Server behaviour at `server/src/routes/tickets.ts:69-73`: when `query.status` is `undefined`, the `where` clause defaults to `{ status: { in: ["open", "resolved", "closed"] } }` — i.e., all agent-visible statuses. This is the "unfiltered" state.

---

## 0.3 — Blast radius

### Files to touch

| File | Change | LOC | Reason |
|------|--------|-----|--------|
| `client/src/pages/TicketsFilters.tsx` | Add Clear button conditionally | 73 | Primary implementation |
| `client/src/pages/TicketsPage.test.tsx` | Add 6-8 tests | 400 | Regression coverage |

### No signature changes

`TicketsFilters` already receives:
- `filters: TicketFilters` (read, to detect "at default")
- `onChange: (filters: TicketFilters) => void` (write, to reset to `{}`)

No new props needed. No callers to update.

### Components/hooks called by modified files

`TicketsFilters.tsx` imports:
- `Input`, `Select*` from `@/components/ui/*` (unchanged)
- `Search` from `lucide-react` (unchanged)
- `agentTicketStatuses`, `statusLabel` from `core/constants/ticket-status.ts` (unchanged)

Will add:
- `Button` from `@/components/ui/button` (already vendored)
- `X` from `lucide-react` (already available)

### Tests covering modified files

- `client/src/pages/TicketsPage.test.tsx` (400 LOC) — covers both `TicketsPage` and `TicketsFilters` indirectly.

### Feature flags

None. Per `docs/repo-wiki/13-cross-cutting.md:142`, the repo has no feature flags.

### Database/migrations

None. Client-only change.

---

## 0.4 — Prior work and patterns

### Memories search

- `docs/repo-wiki/_memories/` contains only `README.md` — no capability index, no bug post-mortems.
- No prior work for "clear" or "reset" filter affordance anywhere in the repo.

### Git history

Initial commit only (65da45b). Tickets files untouched since.

### Existing clear/reset patterns

Grepped `client/src` for clear/reset patterns:
- 10 files match, all in test files (`vi.resetAllMocks()`) or form field clears.
- **No existing clear-all-filters pattern** to reuse.

### Button variants for secondary actions

From `client/src/components/ui/button.tsx:11-21`:
- `ghost` — hover background, transparent default. Used for column-sort buttons (`TicketsTable.tsx:167`).
- `outline` — border, subtle shadow. Used for pagination buttons.

**Recommendation**: `ghost` variant for Clear filters — visual precedent: column-sort buttons.

### lucide-react icons

`X` available from `lucide-react`. Used as `XIcon` in `client/src/components/ui/dialog.tsx:2`.

**Recommendation**: `X` icon for Clear button — universal clear affordance.

---

## 0.5 — Implementation plan (derived from AC)

### AC1 & AC2 — Conditional visibility

Condition: at least one of `search`, `status`, or `category` is not `undefined`.

Expression:
```
const hasActiveFilters = filters.search !== undefined || 
                         filters.status !== undefined || 
                         filters.category !== undefined;
```

Render button when `hasActiveFilters === true`.

### AC3 — Clear all filter controls together

On click, call `onChange({})` — resets all three to `undefined` in one interaction.

The controls already read from `filters`, so they immediately reflect the cleared state:
- Search input shows `""` (`filters.search ?? ""`)
- Status select shows "All statuses" (`filters.status ?? ALL`)
- Category select shows "All categories" (`filters.category ?? ALL`)

### AC4 — Unfiltered refresh

The query key at `TicketsTable.tsx:119` includes `filters`. When `filters` changes to `{}`, the query key changes, TanStack Query fetches with new params.

The request params spread `...filters` (`:125`), so when `filters = {}`, no `search`, `status`, or `category` params are sent. Server receives an unfiltered query.

### AC5 — Preserve sorting

Sort state lives in `TicketsTable.tsx:99-101`, not in `TicketsPage`. Clearing filters does not touch sort state. Verified: the `useEffect` at `:107-109` resets `pageIndex` only, not `sorting`.

### AC6 — Reset pagination

The `useEffect` at `TicketsTable.tsx:107-109` is keyed on `filters`. When `onChange({})` is called:
1. `TicketsPage` state updates to `{}`
2. `TicketsTable` receives new `filters` prop
3. `useEffect` fires, calls `setPagination((prev) => ({ ...prev, pageIndex: 0 }))`
4. Query key updates (includes `pageIndex` at `:119`)
5. Axios sends `page: 1` (`:126` converts 0-based to 1-based)

**No additional code needed** — pagination reset already happens on any filter change.

### AC7 — Automated regression coverage

Test cases (add to `TicketsPage.test.tsx`):

1. **Button visibility — one filter active**: Set `{ search: "test" }`, assert button present.
2. **Button visibility — multiple filters active**: Set `{ status: "open", category: "technical_question" }`, assert button present.
3. **Button hidden at defaults**: Render with `{}`, assert button not present.
4. **Clearing all filters**: Set `{ search: "test", status: "open" }`, click Clear, assert axios called with no `search`/`status` params.
5. **Preserve sort column**: Set sort to `subject` asc, set `{ search: "test" }`, click Clear, assert next axios call has `sortBy: "subject"`, `sortOrder: "asc"`.
6. **Preserve sort direction**: Same as 5, verify `sortOrder` matches.
7. **Reset pagination**: Mock 50 tickets, navigate to page 2, set `{ search: "test" }`, click Clear, assert next axios call has `page: 1`.

All seven directly map to AC1-6.

---

## 0.6 — Recon confidence check (7/7)

| Question | Known? | Evidence |
|----------|--------|----------|
| 1. Every file my changes touch | Yes | 2 files: `TicketsFilters.tsx`, `TicketsPage.test.tsx`. All read and mapped. |
| 2. Every caller of every function I'll modify | Yes | No function signature changes. `TicketsFilters` prop interface unchanged. |
| 3. Every test currently passing through this code | Yes | `TicketsPage.test.tsx` (400 LOC) covers `TicketsPage` and `TicketsFilters`. Patterns documented. |
| 4. Established patterns in this area | Yes | Button variants (`ghost` for in-table secondary actions), lucide icons (`X` for clear), conditional rendering (standard React). |
| 5. Feature flags / branching logic | Yes | No feature flags. No branching logic in `TicketsFilters` — pure controlled inputs. |
| 6. Database/external state | Yes | No database changes. Server API unchanged. Query params documented. |
| 7. Vault memories checked | Yes | `docs/repo-wiki/_memories/` holds only `README.md`. No prior work, no bug post-mortems for this area. |

**Confidence**: 7/7. Proceed.

---

## Risks

1. **Search keystroke spam**: No debouncing means every keystroke fires a query. Clearing search is instantaneous — existing behaviour, not introduced by Clear button.

   **Mitigation**: Story scope excludes debouncing. Defer if concern arises.

2. **PointerEvent polyfill**: Radix `Select` dropdowns require polyfill (documented at `TicketDetailPage.test.tsx:13-28`). Existing tests assert API params, not dropdown display. Assertion strategy for AC tests: "call Clear, wait for axios call with omitted params". Display state is read of `filters`, already tested indirectly. No polyfill needed unless we drive dropdown interaction.

3. **Test file size**: `TicketsPage.test.tsx` is 400 LOC. Adding 7 tests (est. 150-200 LOC) pushes it to 550-600 LOC. Per `docs/repo-wiki/11-testing.md:147`, the existing shape is deliberate. Adding to it is consistent with project norms.

---

## Regression baseline

Current test coverage for `TicketsPage` / `TicketsFilters` / `TicketsTable`:
- Loading states, table render, default params, sorting, search, filter params, pagination, empty state, error state: all covered.

**Not covered** (pre-existing gaps):
- Status/category dropdown interaction (only API param asserted).
- Sort preservation across filter change (documented at `docs/repo-wiki/04-features/view-tickets-list.md:58`).

**This story adds coverage for**:
- Clear button visibility (conditional rendering)
- Clear button behaviour (all filters reset together)
- Pagination reset on Clear (tested via Clear specifically)
- Sort preservation on Clear (fills existing gap)

---

## Recommendation

**Proceed with implementation.**

Blast radius is minimal (2 files, no signature changes), confidence is 7/7, and all seven acceptance criteria map cleanly to testable behaviour with no API or schema changes required.

Implementation fits house style:
- `ghost` Button variant (precedent: column-sort buttons)
- `X` icon from lucide-react (precedent: dialog close)
- Conditional rendering via computed boolean (standard React)
- Test patterns match `TicketsPage.test.tsx` (mock axios, `renderWithQuery`, `waitFor`)

Sort and pagination state separation from filter state means AC5 and AC6 are automatically satisfied by existing architecture — no special handling needed.

**Estimated effort**: T2 appropriate. 1 hour implementation, 1 hour tests.
