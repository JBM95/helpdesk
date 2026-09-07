---
tags: [cross-cutting, client, patterns]
---

# Cross-Cutting Concerns — Client

> Mapped by `explore-11-cross-cutting-mapper` via `/setup-05-explore client` on 2026-09-07.
> **Scope: `client/` only.** Server-owned concerns — session issuance, authorization enforcement, rate limiting, server-side validation — are named where they matter but **were not examined**. Nothing below describes server behaviour.

## Authentication

Better Auth client, configured at `client/src/lib/auth-client.ts:5-7`, exporting `signIn`, `signOut` and `useSession` with `inferAdditionalFields<typeof auth>()` so `session.user.role` is typed.

| Consumer | Purpose | Line |
|----------|---------|------|
| `ProtectedRoute.tsx` | redirect to `/login` when no session | 5 |
| `AdminRoute.tsx` | redirect to `/` when not admin | 6 |
| `Layout.tsx` | user name display, sign-out | 15 |
| `LoginPage.tsx` | redirect away if already signed in | 29 |

Tokens are held in HTTP-only cookies managed by Better Auth, so no token is reachable from JavaScript and none is stored in `localStorage` or `sessionStorage`.

**Session expiry is handled lazily.** There is no 401 interceptor. When a session expires, in-flight requests simply fail and surface as ordinary errors; the redirect to `/login` happens only on the next navigation, when `useSession()` returns null and a guard re-evaluates. A user can therefore keep clicking on a dead session and see error alerts rather than a sign-in prompt.

## Authorization

**Actually enforced client-side:** `AdminRoute` (`AdminRoute.tsx:16`) redirects non-admins away from `/users` at the route level, so URL-typing does not reach the page.

**Hidden, not enforced:**

| Location | What is hidden |
|----------|----------------|
| `Layout.tsx:56-61` | the "Users" nav link, for non-admins |
| `UsersTable.tsx:103-111` | the delete button, on admin rows |

Neither prevents the corresponding API call. **A hidden control is not an access control.** The real boundary is the server, which was not examined in this pass — so this document cannot tell you whether these rules are enforced where it counts. Treat that as an open question, not as reassurance.

## Error handling

Two components, used consistently ([[08-standards/observed]] records 100% adherence at sampled sites):

- **`ErrorAlert`** (`ErrorAlert.tsx:22-36`) — either a static `message`, or an `error` plus `fallback`. Extraction logic at `:15-20`:

  ```ts
  export function getErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
      return error.response?.data?.error ?? fallback;
    }
    return fallback;
  }
  ```

  It reads `response.data.error`, matching the server's error shape.

- **`ErrorMessage`** (`ErrorMessage.tsx:1-3`) — a single destructive-styled line for field validation errors.

**Sentry error boundary** at `main.tsx:14-22` catches **React render errors only**. Axios failures, mutation errors and query errors are *not* automatically reported — they are displayed to the user by `ErrorAlert` and then dropped. Unhandled rejections outside React are not caught by the boundary.

**One place with no error surface:** `UpdateTicket.tsx` performs a `PATCH` and renders no `ErrorAlert`, so a failed status, category or assignment change is silent from the user's point of view. This is the only inconsistency found against the otherwise-uniform convention.

## Loading states

| Flag | Used for | Example |
|------|----------|---------|
| `isLoading` | `useQuery` data fetches | `TicketDetailPage.tsx:17` |
| `isPending` | `useSession` and mutations | `ProtectedRoute.tsx:5`, `ReplyForm.tsx:82` |

Patterns: skeleton rows in tables (`TicketsTable.tsx:189-207`, `UsersTable.tsx:60-79`), `Skeleton` in dashboard cards (`HomePage.tsx:134,157`), the composed `TicketDetailSkeleton`, and disabled buttons with swapped labels for mutations (`ReplyForm.tsx:87-89`, `UserForm.tsx:111-115`, `TicketSummary.tsx:28-32`). `Loader2` from lucide is used sparingly (`LoginPage.tsx:44,124`); most loading feedback is text.

Both route guards render a full-screen centred "Loading…" (`ProtectedRoute.tsx:8-12`, `AdminRoute.tsx:8-12`) rather than a skeleton of the destination, so every cold navigation to a protected route briefly shows a blank screen.

## Validation

React Hook Form + `zodResolver`, at 3 of 3 forms.

| Schema | Client use | Source |
|--------|-----------|--------|
| `createUserSchema`, `updateUserSchema` | `UserForm.tsx:33` | `core/schemas/users.ts` |
| `createReplySchema` | `ReplyForm.tsx:29` | `core/schemas/replies.ts` |
| local `loginSchema` | `LoginPage.tsx:21-24` | inline — correct, since the sign-in endpoint belongs to Better Auth rather than a local route |

Three shared schemas (`ticketListQuerySchema`, `updateTicketSchema`, `polishReplySchema`) exist in `core/` and are not used by the client; they are server-side only.

**Client validation is a UX affordance, not a security control.** Sharing schemas through `core/` means the same rules are *available* on both sides, but whether the server actually applies them was not verified in this pass.

## HTTP layer

**There is no shared Axios instance and no interceptor.** Verified: no `axios.create`, no `axios.interceptors`, no `baseURL` anywhere in `client/src`. Every call is a bare `axios.get` / `axios.post` / `axios.put` / `axios.patch` / `axios.delete` against a relative `/api/*` path.

In development, Vite proxies `/api` to `VITE_API_URL` or `http://localhost:3000` (`vite.config.ts:34-39`). In the Docker image the server serves the SPA from the same origin, so `/api` is same-origin ([[12-build-deploy]]).

Consequences worth being explicit about, since they all follow from the same absence:

- **No central auth-failure handling** — hence the lazy expiry behaviour described above.
- **No central error handling** — every call site must render its own error, which is why one missing `ErrorAlert` (`UpdateTicket.tsx`) produces a silent failure.
- **No request transformation** — no CSRF token injection, no correlation ID, no timing headers.
- **No custom retry or backoff** — TanStack Query's default 3 query retries apply; mutations do not retry.

None of this is wrong at this size. It is worth recording because adding any one of those behaviours later means introducing the shared instance that does not currently exist.

## Caching

`QueryClient` is constructed with no options (`main.tsx:10`), so TanStack Query defaults hold: `staleTime: 0`, `gcTime` 5 minutes, refetch on window focus, 3 retries.

Invalidation on mutation success:

| Mutation | Invalidates | Location |
|----------|-------------|----------|
| Delete user | `["users"]` | `UsersPage.tsx:49` |
| Create/update user | `["users"]` | `UserForm.tsx:51` |
| Update ticket | `["ticket", id]` | `UpdateTicket.tsx:41` |
| Create reply | `["replies", ticketId]` | `ReplyForm.tsx:43` |

**The ticket list key is never invalidated.** A status change on the detail page updates `["ticket", id]` but leaves any cached `["tickets", …]` page stale until remount or window refocus. With `staleTime: 0` this usually self-corrects quickly, which is presumably why it has not been felt as a bug.

No HTTP caching, no service worker, no offline support, no polling, no WebSocket or SSE.

## Observability

`client/src/lib/sentry.ts:3-14`:

- `enabled: !!import.meta.env.VITE_SENTRY_DSN` — entirely inert without a DSN
- `tracesSampleRate: 1.0` — every transaction traced
- `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 1.0` — no routine session recording, full replay on error
- Integrations: `browserTracingIntegration`, `replayIntegration`

Captured: React render errors (via the boundary), unhandled rejections, performance traces. **Not** captured: Axios errors in queries and mutations, and validation errors (correctly — those are user input, not faults).

Source maps are built as `hidden` (`vite.config.ts:23`) and uploaded only when `SENTRY_AUTH_TOKEN` is present (`:16`), so they never ship to the browser.

## Theming

`ThemeProvider` at `client/src/lib/theme.tsx:15-40`. Values `"light" | "dark"`, default `"dark"`, persisted to `localStorage` under `helpdesk-theme`. The effect at `:21-29` toggles the `dark` class on `document.documentElement` and writes the preference — the one legitimate non-fetching `useEffect` + `useState` pair in the client. Consumed by the toggle at `Layout.tsx:17,65-73`.

Preference is per-device; there is no server-side user preference.

## Absent concerns

Recorded so their absence is a known fact rather than an assumption:

- **No internationalization.** All UI text is hardcoded English; dates use `toLocaleDateString()` / `toLocaleString()` with the implicit browser locale (`HomePage.tsx:169`, `TicketsTable.tsx:92`, `ReplyThread.tsx:87`).
- **No feature flags.**
- **No client-side metrics** beyond Sentry traces.
- **No client-side rate limiting**, and no throttle on the two GPT-backed buttons (summarize, polish).
- **No accessibility standard recorded** — [[00-scope]] notes no support floor or a11y level has been agreed.

## Related

- [[08-standards/declared]] · [[08-standards/observed]] · [[08-standards/conflicts]]
- [[06-frontend-map]] — component and query-key inventory
- [[12-build-deploy]] — env vars, Sentry wiring, dev proxy
- [[03-domains/auth]] — guards in domain terms
