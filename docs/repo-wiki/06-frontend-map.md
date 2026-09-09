---
tags: [frontend, architecture, react, client]
---

# Frontend Map — Client

> Mapped by `explore-07-frontend-explorer` via `/setup-05-explore client` on 2026-09-07. Scope: `client/` only.
> React 19.2.0 + Vite 7.3.1 + TypeScript 5.9.3. ~5,363 source LOC / 52 files, of which ~1,351 LOC is vendored shadcn/ui — so ~3,961 LOC is project-authored. This is the largest hand-written surface in the repo.

## Route tree

All routes in `client/src/App.tsx:14-24`. Router is React Router 7 (`react-router`, not `react-router-dom`).

```
/login                    LoginPage          public
/                         ProtectedRoute → Layout
  /                       HomePage           protected
  /tickets                TicketsPage        protected
  /tickets/:id            TicketDetailPage   protected
  /users                  AdminRoute → UsersPage   protected + admin
*                         → Navigate to /
```

- `ProtectedRoute` (`App.tsx:15`) — redirects to `/login` when there is no session
- `AdminRoute` (`App.tsx:20`) — nested inside; redirects to `/` when `session.user.role !== Role.admin`
- `Layout` wraps all protected routes, supplying nav, theme toggle, sign-out and the outlet

**No lazy loading** — every route component is imported statically. Reasonable at this size.

## Component inventory

### Pages (`client/src/pages/`)

| File | LOC | Purpose | Query keys |
|------|-----|---------|------------|
| `HomePage.tsx` | 204 | Dashboard: 5 stat cards + 30-day bar chart | `["ticket-stats"]`, `["ticket-daily-volume"]` |
| `LoginPage.tsx` | 135 | Email/password sign-in | — (Better Auth `useSession`) |
| `TicketsPage.tsx` | 25 | Tickets container; owns filter state | — |
| `TicketsFilters.tsx` | 73 | Search input + status/category selects | — |
| `TicketsTable.tsx` | 280 | Sortable, paginated table; owns sort + pagination | `["tickets", sortBy, sortOrder, filters, pageIndex]` |
| `TicketDetailPage.tsx` | 65 | Detail layout, two columns | `["ticket", id]` |
| `UsersPage.tsx` | 105 | Admin user management; dialog + delete state | `["users"]` (invalidates) |
| `UsersTable.tsx` | 119 | Users table with row actions | `["users"]` |
| `UserForm.tsx` | 119 | Create/edit user in a modal | `["users"]` (invalidates) |

### Hand-written components (`client/src/components/`)

| File | Purpose | Notes |
|------|---------|-------|
| `Layout.tsx` | App shell, nav, theme toggle, sign-out | Admin nav item conditional at `:56` |
| `ProtectedRoute.tsx` | Auth guard | Full-screen "Loading…" while `isPending` |
| `AdminRoute.tsx` | Admin guard | Checks `Role.admin` at `:16` |
| `TicketDetail.tsx` | Ticket header + body card | DOMPurify-sanitises `bodyHtml` |
| `TicketDetailSkeleton.tsx` | Detail loading placeholder | |
| `TicketSummary.tsx` | AI summarise button + result card | Mutation, no cache write |
| `UpdateTicket.tsx` | Status/category/assignee sidebar | Queries `["agents"]`, invalidates `["ticket", id]` |
| `ReplyThread.tsx` | Reply list | Query `["replies", ticketId]`; DOMPurify |
| `ReplyForm.tsx` | Reply composer + Polish action | Two mutations sharing one textarea |
| `StatusBadge.tsx` | Status pill | Hardcodes palette colours — see [[tech-debt]] TD-02 |
| `BackLink.tsx` | Styled back link | |
| `ErrorAlert.tsx` | Error display; exports `getErrorMessage` | Axios extraction |
| `ErrorMessage.tsx` | Field validation error | 3 lines |

### Vendored shadcn/ui primitives (`client/src/components/ui/`)

Available, not project-authored, internals not mapped: `alert`, `alert-dialog`, `badge`, `button`, `card`, `chart`, `dialog`, `input`, `label`, `select`, `skeleton`, `table`, `textarea`.

### Library modules (`client/src/lib/`)

| File | Purpose |
|------|---------|
| `auth-client.ts` | Better Auth client; exports `signIn`, `signOut`, `useSession` |
| `theme.tsx` | Light/dark context, localStorage key `helpdesk-theme`, default `dark` |
| `utils.ts` | `cn()` — clsx + tailwind-merge |
| `sentry.ts` | Sentry browser init, gated on `VITE_SENTRY_DSN` |

### Test utilities (`client/src/test/`)

- `setup.ts` — imports `@testing-library/jest-dom/vitest`
- `render.tsx:5-14` — `renderWithQuery(ui)`, wrapping in `QueryClientProvider` (retries disabled) + `MemoryRouter`

## Server state — TanStack Query

`QueryClient` is created at `main.tsx:10` with **no options**, so TanStack defaults apply: `staleTime: 0`, `gcTime` 5 min, refetch on window focus, 3 retries on queries.

| Query key | Endpoint | Invalidated by |
|-----------|----------|----------------|
| `["ticket-stats"]` | `GET /api/tickets/stats` | nothing |
| `["ticket-daily-volume"]` | `GET /api/tickets/stats/daily-volume` | nothing |
| `["tickets", sortBy, sortOrder, filters, pageIndex]` | `GET /api/tickets` | nothing |
| `["ticket", id]` | `GET /api/tickets/:id` | `UpdateTicket.tsx:41` |
| `["replies", ticketId]` | `GET /api/tickets/:id/replies` | `ReplyForm.tsx:43` |
| `["users"]` | `GET /api/users` | `UsersPage.tsx:49`, `UserForm.tsx:68` |
| `["agents"]` | `GET /api/agents` | nothing |

Mutations always invalidate; there is no `setQueryData` anywhere, so no optimistic updates.

Note that the ticket **list** is never invalidated by a mutation. Changing a ticket's status from the detail page refreshes `["ticket", id]` but not `["tickets", …]`; the list refreshes on remount or window focus instead.

## Client state

**Providers**, nested in `main.tsx:12-31`: `Sentry.ErrorBoundary` → `ThemeProvider` → `QueryClientProvider` → `BrowserRouter`.

**No global client state library** — no Redux, Zustand or Jotai. TanStack Query holds server state, React Hook Form holds form state, `useState` holds UI state.

**No URL or search-param state.** Filters, sort and pagination all live in component state, so they are lost on navigation away and cannot be bookmarked or shared.

Structurally significant local state:

| Location | State |
|----------|-------|
| `TicketsPage.tsx:14` | `filters` — see [[tickets]] for the full ownership breakdown |
| `TicketsTable.tsx:99-101` | `sorting`, default `createdAt` desc |
| `TicketsTable.tsx:102-105` | `pagination`, `pageIndex: 0`, `pageSize: 10` |
| `TicketsTable.tsx:107-109` | `useEffect` resetting `pageIndex` on `filters` identity change |
| `UsersPage.tsx:40-41` | dialog mode + pending delete target |
| `LoginPage.tsx:31` | `serverError` |

## Forms

| Form | Schema | Location |
|------|--------|----------|
| Sign in | local inline Zod (`LoginPage.tsx:21-24`) | not shared — the endpoint belongs to Better Auth, not a local route |
| Create/edit user | `createUserSchema` / `updateUserSchema` from `core/schemas/users` | `UserForm.tsx:47` picks by mode |
| Reply | `createReplySchema` from `core/schemas/replies` | `ReplyForm.tsx:29` |

`TicketsFilters` is **not** a React Hook Form — it is plain controlled inputs calling `onChange` straight into the parent's `setFilters`.

## Styling

Tailwind CSS 4 via `@tailwindcss/vite`. **No `tailwind.config.ts`** — configuration is inline in `client/src/index.css` using the Tailwind 4 `@theme inline` directive (`:7-48`), with token values at `:root` (`:50-83`) and `.dark` (`:85-117`) as oklch values.

Imports at `index.css:1-3`: `tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`. Dark mode via `@custom-variant dark (&:is(.dark *))` (`:5`), toggled by the `dark` class on `<html>`.

Custom utilities: `@utility link` (`:119`), `@utility animate-in-page` (`:141`).

Semantic tokens are used exclusively outside `components/ui/`, with one exception — `StatusBadge.tsx:3-9`. See [[08-standards/observed]] and [[tech-debt]].

## Error and loading handling

`ErrorAlert` takes either a static `message` or an `error` + `fallback`, extracting `error.response.data.error` via `getErrorMessage` (`ErrorAlert.tsx:15-20`). `ErrorMessage` renders field errors.

Loading: skeleton rows in tables (`TicketsTable.tsx:189-208`, `UsersTable.tsx:60-79`), `Skeleton` in cards (`HomePage.tsx:133-140`), `TicketDetailSkeleton` for the detail page, and a full-screen "Loading…" in both route guards. Mutations use `disabled={mutation.isPending}` with a swapped label ("Sending…", "Saving…", "Polishing…").

Sentry captures React render errors through the boundary in `main.tsx:14-22`; Axios failures are surfaced in the UI but not sent to Sentry.

## Tickets area — detail

Recorded in full in [[tickets]] under *State ownership*, including the `"__all__"` sentinel, each control's default, the query-key composition, the omission of `undefined` params from the request, and the pagination-reset `useEffect` and its dependency on object identity. Not duplicated here.

## Observations

1. **`StatusBadge.tsx:3-9`** hardcodes Tailwind palette colours where the rest of the client uses semantic tokens. [[tech-debt]] TD-02.
2. **`TicketsFilters.tsx:66-68`** hardcodes the three ticket categories while the status control maps over a shared constant and `UpdateTicket.tsx:86` maps over `ticketCategories`. [[tech-debt]] TD-01.
3. **No filter state in the URL** — a filtered ticket view cannot be linked to or restored.
4. **The ticket list is never invalidated by a mutation**, so a status change made on the detail page is not reflected in a still-cached list until refocus or remount.

## Open questions

- Whether Axios omits `undefined` params from the serialised query string in practice (the object spread omits the keys, so they should never reach the serialiser) — confirming end-to-end needs the server or a network trace.
- Whether the API honours or caps `pageSize`; the client always sends 10.
- Whether the summarize and polish endpoints are rate-limited or cost-bounded — both are GPT calls triggered directly by a button with no client-side throttle.

All three need the server, which was deliberately not explored — see [[00-scope]].

## Related

- [[03-domains/_index]] · [[tickets]] · [[13-cross-cutting]] · [[11-testing]]
- [[08-standards/observed]] — adherence counts for the conventions above
- [[12-build-deploy]] — Vite config, env vars, dev proxy
