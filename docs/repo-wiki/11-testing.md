---
tags: [testing, coverage, vitest, playwright]
---

# Testing Landscape

> Mapped by `explore-12-test-coverage-mapper` via `/setup-05-explore client` on 2026-09-07.
> Scope: `client/` component tests in full; `e2e/` inventoried at the surface only (filenames and describe titles); `server/` not examined.
> **No tests were run.** Nothing here is a measured coverage figure.

## Frameworks

### Component tests

**Vitest 4.0.18 + React Testing Library 16.3.2.** Run with `cd client && bun run test` (single pass) or `bun run test:watch`.

Config is embedded in `client/vite.config.ts:41-50` — there is no separate `vitest.config.ts`:

```ts
test: {
  globals: true,
  environment: "jsdom",
  setupFiles: "./src/test/setup.ts",
  server: { deps: { inline: ["@tanstack/react-table"] } },
}
```

Setup file `client/src/test/setup.ts:1` imports `@testing-library/jest-dom/vitest`.

Helper `client/src/test/render.tsx:5-14` exports `renderWithQuery(ui)`, wrapping the tree in a `QueryClient` with **retries disabled** (for determinism) plus `MemoryRouter`.

Mocking convention: `vi.mock("axios")` at module top, `vi.mocked(axios, { deep: true })`, `vi.resetAllMocks()` in `beforeEach`. Used in 7 of 8 files.

### E2E

**Playwright 1.58.2.** `bun run test:e2e` from root. `playwright.config.ts`: `testDir: ./e2e/tests`, `baseURL: http://localhost:5174`, `fullyParallel: true`, `retries: 2` in CI only. Its `webServer` block starts both server (3001) and client (5174), and `e2e/global-setup.ts` resets and seeds `helpdesk_test`, so the suite runs unattended.

## Coverage threshold

**None configured, anywhere.** Independently verified across `client/vite.config.ts`, `playwright.config.ts`, every `package.json`; no `.nycrc`, no standalone vitest config, no coverage flags in any script.

Consequently **no measured line or branch percentage exists for this repo.** The ratio table below counts *files*, not lines, and must not be read as a coverage percentage. This finding is the input to the operator-confirmed calibration step; see [[08-standards/conflicts]] §4.

## Component test inventory

Eight files, all co-located as `*.test.tsx`.

### `pages/TicketsPage.test.tsx` — 400 LOC, the largest test file in the repo

Covers: loading skeletons; full table render (subject, sender, status badge, category label, formatted dates); empty state; error state (alert shown, table hidden); default request params (`sortBy: createdAt`, `sortOrder: desc`, `page: 1`, `pageSize: 10`); column-header sorting including toggle on second click; search input rendering and the resulting `search` param; filter dropdowns rendering; pagination info and First/Previous/Next/Last controls with disabled states; navigation to page 2.

Mocks `axios.get` with `{ tickets, total, page, pageSize }`. Three tests (lines 307-336) render `TicketsTable` directly to assert filter params in isolation.

**Not covered here:** selecting a value in the status or category dropdown (only the resulting API param is asserted, not the interaction), and sort preservation across a filter change.

### `pages/TicketDetailPage.test.tsx` — 479 LOC

Loading skeletons; detail render; HTML body rendering when `bodyHtml` present; 404 vs generic error; ticket and agent fetches on mount; assignment dropdown including "Unassigned" → `assignedToId: null`; status dropdown and its `PATCH`; category dropdown including "None" → `category: null`; back-link href.

Carries a **jsdom PointerEvent polyfill at lines 13-28** — required for any test driving a Radix `Select`. Reuse this when testing dropdowns.

### `pages/UserForm.test.tsx` — 287 LOC

Create mode: field rendering; validation (short name, short password, missing email); `aria-invalid`; `POST /api/users`; `onSuccess`; form reset; 409 server error via `data.error`; generic non-Axios error; "Creating…" disabled state.
Edit mode: pre-population; "Save Changes" label; password placeholder; empty password permitted; `PUT` with and without password; `onSuccess`; "Saving…" state; validation still enforced; update error display.

### `pages/UsersPage.test.tsx` — 273 LOC

Loading skeletons; table render and date formatting; fetch error; empty table; `GET /api/users`; "New User" dialog open; dialog close on Escape and overlay click; per-row edit dialog with pre-populated form; **delete button present on agent rows and absent on admin rows**; delete confirmation dialog; cancel does not call delete; confirm calls `DELETE /api/users/:id`; list refreshes after deletion.

### `components/ReplyForm.test.tsx` — 256 LOC

Reply flow: renders textarea and both buttons; both disabled when empty or whitespace-only; enabled with text; `POST …/replies`; textarea cleared on success; "Sending…" state; Axios and non-Axios error paths; no alert before first submit.
Polish flow: `POST …/replies/polish`; textarea replaced with polished text; "Polishing…" state; each button disabled while the other mutation runs; error on polish failure; **draft preserved when polish fails**; polished text can then be sent.

### `components/ReplyThread.test.tsx` — 160 LOC

Loading skeletons; "No replies yet"; fetch on mount; fetch error; agent replies with name and "Agent" label; customer replies with sender name and "Customer" label; fallback to "Agent" when an agent reply has no user; multiple replies.

### `components/TicketSummary.test.tsx` — 104 LOC

Button render; no card before first click; `POST …/summarize`; summary displayed; "Summarizing…" state; error path; regeneration on repeat click.

### `components/TicketDetail.test.tsx` — 66 LOC

Subject heading; sender name and email; "Created:" / "Updated:" labels; plain-text body when `bodyHtml` is null; HTML body when present, with plain text then absent. Purely presentational — no API, no interaction.

## What has no direct test

| File | LOC | Covered indirectly? |
|------|-----|--------------------|
| `pages/HomePage.tsx` | 204 | **No — nothing covers it.** No component test, and no E2E asserts dashboard content. The largest untested surface in the client. |
| `pages/TicketsTable.tsx` | 280 | Partly, through `TicketsPage.test.tsx`. Sort-preservation-across-filter-change is not asserted anywhere. |
| `pages/UsersTable.tsx` | 119 | Fully, through `UsersPage.test.tsx`. Not used outside that page. |
| `pages/TicketsFilters.tsx` | 73 | Partly — its resulting API params are asserted via the parent; dropdown interaction is not. |
| `pages/LoginPage.tsx` | 135 | By `e2e/tests/auth.spec.ts`. A component test would largely duplicate it. |
| `components/UpdateTicket.tsx` | 123 | Fully, through `TicketDetailPage.test.tsx:190-441`. |
| `components/Layout.tsx` | 93 | Navigation and sign-out by E2E; the admin-only nav condition is not asserted. |
| `components/ProtectedRoute.tsx` | 20 | Happy path by `e2e/tests/auth.spec.ts`. |
| `components/AdminRoute.tsx` | 21 | Happy path by `e2e/tests/auth.spec.ts`. |
| `components/StatusBadge.tsx` | 20 | Indirectly, via `TicketsPage.test.tsx:98-108`. Presentational. |
| `components/ErrorAlert.tsx`, `ErrorMessage.tsx`, `BackLink.tsx`, `TicketDetailSkeleton.tsx` | small | Indirectly, through every test that renders them. Presentational. |

`client/src/components/ui/*` is excluded — vendored shadcn primitives, not project code.

## E2E inventory (surface only)

| Spec | Shape |
|------|-------|
| `auth.spec.ts` | ~63 tests / 8 describes — login page, session persistence across reload, logout, protected-route redirects, admin-route protection (2 tests commented out), unknown-URL handling, nav bar |
| `webhook-inbound-email.spec.ts` | ~23 tests / 4 describes — webhook auth (header and query-param secret), payload validation, ticket creation with `new` status, email threading including `Re:`/`Fwd:` prefixes |
| `users.spec.ts` | ~7 tests / 4 describes — view, create, edit, delete with cancel and confirm |
| `tickets.spec.ts` | ~5 tests / 2 describes — nav link, navigation, unauthenticated redirect, and webhook→list integration surviving reload |
| `ticket-detail.spec.ts` | ~4 tests — unauthenticated redirect, update persistence after reload, reply persistence, full agent workflow |

`webhook-inbound-email.spec.ts` is **legitimately E2E** — a webhook writing data that then appears in the UI is exactly the full-stack case CLAUDE.md's policy carves out for a real browser and server.

## File-ratio table

**Not a coverage percentage.** Test *files* per source *file*.

| Area | Source files | Test files | Ratio |
|------|-------------|-----------|-------|
| `client/src/pages/` | 9 | 4 | 0.44 |
| `client/src/components/` (excl. `ui/`) | 13 | 4 | 0.31 |
| `client/src/components/ui/` | 13 | 0 | — vendored, excluded |
| `core/` | 9 | 0 | 0.00 |
| `server/src/` (excl. generated) | 23 | 0 | 0.00 — no server suite exists |
| `e2e/tests/` | — | 5 | — 2,051 LOC |

Client component testing is **selective rather than systematic**: the four highest-traffic surfaces are covered thoroughly and in depth, while guards, presentational components and the dashboard are covered indirectly or not at all. That is a defensible shape for a project this size; it is worth knowing rather than assuming uniformity.

## Distribution against the declared policy

[[08-standards/conflicts]] §3 records the E2E suite (2,051 LOC) at ~1.88× the server's logic (~1,091 LOC), which inverts CLAUDE.md's "prefer component tests" preference. The caveat there applies here too: Playwright specs are verbose by construction, so the ratio overstates the scope gap and is a prompt to look, not proof of duplication.

## Patterns a new client test should follow

1. Co-locate as `ComponentName.test.tsx` beside the source.
2. Use `renderWithQuery` from `@/test/render` for anything touching TanStack Query or the router.
3. `vi.mock("axios")` at the top, `vi.mocked(axios, { deep: true })`, `vi.resetAllMocks()` in `beforeEach`.
4. Inline mock data at the top of the file — there are no shared factories, and introducing one is only worth it once data is reused across three or more files.
5. Local render/fill helpers for complex setup, as in `UserForm.test.tsx:17-32` and `TicketDetailPage.test.tsx:49-62`.
6. Assert the loading state before the success and error states.
7. Cover both Axios errors (`response.data.error`) and non-Axios errors where the handling differs.
8. `waitFor` for async assertions.
9. Nest `describe` blocks when a file covers distinct modes — `UserForm.test.tsx` and `ReplyForm.test.tsx` do; the other six are flat, which is noticeable in the 400-LOC `TicketsPage.test.tsx`.
10. Reuse the PointerEvent polyfill from `TicketDetailPage.test.tsx:13-28` for any Radix dropdown.

## CI integration

**None.** `.github/workflows/` holds one workflow, `claude.yml`, a `@claude` mention responder. No push or pull-request trigger builds, type-checks, lints or runs a test.

Per [[00-scope]]: an absent pipeline is not a green pipeline, and every gate is local-only and unenforced — the gate is whoever remembers to run the command.

## Related

- [[08-standards/declared]] — the declared testing policy
- [[08-standards/conflicts]] — §3 distribution, §4 no thresholds, §5 no CI
- [[00-scope]] — verification is intentionally local this horizon
- [[12-build-deploy]] — exact commands
- [[06-frontend-map]] · [[03-domains/tickets]]
