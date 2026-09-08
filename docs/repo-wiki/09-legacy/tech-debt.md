---
tags: [tech-debt, register, full-stack]
---

# Tech Debt Register

> **Client** audited by `explore-13-legacy-detective` via `/setup-05-explore client` on 2026-09-07.
> **Server, core, e2e** audited by `explore-13-legacy-detective` via `/setup-05-explore server core e2e` on 2026-09-08.
>
> **This is a register, not a work plan.** [[00-scope]] puts refactors explicitly out of scope for the current horizon. Nothing here is scheduled, and nothing here should be folded into unrelated work just because it is nearby.

21 entries. **None threatens correctness at current maturity** ([[00-vision]] — no real users, no real personal data). If every one were addressed the total is well under two days of focused work; that is a statement about the size of the gaps, not an argument for doing them.

| ID | Finding | Area | Severity | Effort | Recommendation |
|----|---------|------|----------|--------|----------------|
| TD-01 | Hardcoded ticket categories in the filter dropdown | Client | Friction | 5 min | Fix when next touching filters |
| TD-02 | `StatusBadge` mixes palette colours with semantic tokens | Client | Friction | 2 min to document | Accept and document the exception |
| TD-03 | `as any` on the Sentry Vite plugin | Client build | Load-bearing | 0 min | Accept — upstream typing issue |
| TD-04 | `client/README.md` is untouched Vite boilerplate | Client docs | Load-bearing | 15 min, or delete | Delete — root CLAUDE.md suffices |
| TD-05 | No timeout on any OpenAI call | Server integrations | Medium | 30 min | Worth fixing |
| TD-06 | Outbound email not idempotent, failure silent | Server integrations | Medium | 2 h | Worth fixing |
| TD-07 | Sentry can receive customer personal data | Server integrations | Medium | 30 min | Worth fixing |
| TD-08 | Job enqueue failures logged, never retried | Server integrations | Medium | 1 h | Worth fixing |
| TD-09 | `DELETE /api/users/:id` — 3 writes, no transaction | Server API | Medium | 15 min | Worth fixing |
| TD-10 | `PUT /api/users/:id` — 2 writes, no transaction | Server API | Medium | 10 min | Worth fixing |
| TD-11 | `Account` rows never cleaned for a soft-deleted user | Server data | Low | 10 min | Fix when next touching user deletion |
| TD-12 | No actor attribution on any table | Server data | Low | — | Accept — not a stated requirement |
| TD-13 | No CI runs any test | Infrastructure | Medium | 4–6 h | Worth fixing, but deliberately out this horizon |
| TD-14 | UUID route params not validated | Server API | Low | 5 min | Fix when next touching `/api/users` |
| TD-15 | Session expiry UX inconsistent | Client + Server | Low | 1 h | Fix when next touching auth |
| TD-16 | `UpdateTicket.tsx` has no error surface | Client | Medium | 5 min | Fix when next touching ticket detail |
| TD-17 | Ticket list cache never invalidated | Client | Low | — | Accept — `staleTime: 0` self-corrects |
| TD-18 | GPT endpoints unbounded | Server API | Low | — | Accept now; revisit before real traffic |
| TD-19 | Generated Prisma client gitignored and unwired | Infrastructure | Medium | 15 min | Worth fixing |
| TD-20 | Two E2E tests deliberately disabled | Testing | Low | 0 min (blocked) | Enable when a non-admin user is seeded |
| TD-21 | No authorization tested at API level | Testing | Medium | 2 h | Worth fixing |

**TD-20 and TD-21 share one blocker** — the seed creates a single admin and no second principal ([[07-data-model]]). Any work that adds a non-admin user unlocks both at near-zero marginal cost, which makes them the two cheapest entries here to clear opportunistically.

---

## TD-01 — Hardcoded ticket categories in the filter dropdown

**Area** Client · **File** `client/src/pages/TicketsFilters.tsx:66-68` · **Severity** Friction · **Effort** ~5 min

**Evidence.** The category `Select` lists three literal `SelectItem` values. The status `Select` in the same component (`:47`) maps over `agentTicketStatuses` from `core/constants/ticket-status.ts`. `UpdateTicket.tsx:5,86-88` maps over `ticketCategories` with `categoryLabel[c]`; `TicketsTable.tsx:14` imports `categoryLabel`.

**Why it matters.** The shared constant exists and is used for exactly this purpose in a sibling component. Adding a fourth category would appear in the detail dropdown and the table label, but **not** in the list filter — silently, with no type error, because the literals still compile. The result is a filter that cannot reach a subset of tickets.

**Recommendation: fix when next touching filters.** Mirror what the status control in the same file already does.

**Blast radius.** One dropdown, one file. No API, state or type change.

---

## TD-02 — `StatusBadge` mixes palette colours with semantic tokens

**Area** Client · **File** `client/src/components/StatusBadge.tsx:3-9` · **Severity** Friction · **Effort** ~30 min to promote, ~2 min to document

**Evidence.** `new`, `processing` and `open` use `bg-sky-500/15`, `bg-amber-500/15`, `bg-pink-400/15`; `resolved` and `closed` use `bg-muted text-muted-foreground`. CLAUDE.md declares semantic tokens; [[08-standards/observed]] records 100% adherence elsewhere outside `components/ui/`.

**The counter-argument, honestly.** Five statuses need five distinguishable colours and the semantic palette does not offer five. Reaching for named hues is a reasonable call, not a mistake.

**What makes it a finding** is the mix inside one object: two of five statuses derive from the theme and three do not, so a theme change moves part of the scale and leaves the rest.

**Recommendation: accept and document.** Record the exception in CLAUDE.md so it stops reading as a violation. Promoting the three literals to theme tokens is the alternative and is more work for little gain.

**Blast radius.** One constant, consumed at `TicketsTable.tsx:74` and `TicketDetail.tsx:18`.

---

## TD-03 — `as any` on the Sentry Vite plugin

**Area** Client build · **File** `client/vite.config.ts:20` · **Severity** Load-bearing · **Effort** 0 min

**Evidence.** `sentryVitePlugin({ disable, org, project, authToken }) as any`.

**Why it exists.** A type mismatch between `@sentry/vite-plugin` and Vite 7's plugin signature. Runtime behaviour is correct; source maps upload when `SENTRY_AUTH_TOKEN` is set ([[12-build-deploy]]).

**Recommendation: accept.** An upstream typing problem, not a defect here. Hand-writing a structural type to satisfy the interface would be more code and more fragile, and would need deleting once upstream fixes it. Revisit only when the plugin is upgraded and the cast can simply go.

**Blast radius.** One line of build config. No runtime impact.

---

## TD-04 — `client/README.md` is untouched Vite boilerplate

**Area** Client docs · **File** `client/README.md` · **Severity** Load-bearing · **Effort** ~15 min, or delete

**Evidence.** Still the scaffold: "This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules." Its ESLint section names plugins the project does not use; it mentions none of Bun, Tailwind 4, shadcn/ui, Vitest or Better Auth.

**Why it matters, mildly.** It is misleading to a newcomer and it is a file people open early. Note the *genuine* onboarding gap is sharper and lives elsewhere: TD-19 means a fresh clone cannot type-check or start the server. A README saying only that would be worth more than this one.

**Recommendation: delete.** The root `CLAUDE.md` already documents the stack and the dev commands, so deletion loses nothing.

---

## TD-05 — No timeout on any OpenAI call

**Area** Server integrations · **Files** `lib/classify-ticket.ts:30-38`, `lib/auto-resolve-ticket.ts:43-61`, `routes/replies.ts:97-108`, `:131-141` · **Severity** Medium · **Effort** ~30 min

**Evidence.** None of the four call sites configures a timeout. Found by [[10-integrations]].

**Why it matters.** A hung request holds a pg-boss worker open indefinitely — and with three queues sharing the worker pool, a stuck job is not isolated to its own queue. The two synchronous routes have no retry either, so the Express handler waits until something else gives up.

**Recommendation: worth fixing.** The Vercel AI SDK accepts `abortSignal`; wrap each call in an `AbortController` with a ~30s timeout.

**Blast radius.** Four call sites. No contract or type change.

---

## TD-06 — Outbound email not idempotent, failure silent

**Area** Server integrations · **File** `lib/send-email.ts:21-42` · **Severity** Medium · **Effort** ~2 h

**Evidence.** Enqueued from `auto-resolve-ticket.ts:96-100` and `routes/replies.ts:61-65`. Nothing keys a send to a `(ticketId, replyId)` pair, so a job reprocessed after a worker crash sends twice. After three retries the job is marked failed with no alert, no fallback and no manual re-send path. Found by [[10-integrations]].

**Why it matters.** This is the worst failure mode in the register, because of what the *rest* of the system says while it happens: the ticket may read `resolved` and the reply row exists, so every internal surface claims the customer was answered. The customer waits for something that exists nowhere.

**Recommendation: worth fixing.** Key sends to `(ticketId, replyId)` and skip a duplicate. Surface final failure somewhere monitored. A manual re-send for admins would be the fuller answer.

**Blast radius.** One queue handler, two enqueue sites, possibly a new table or a pg-boss state query.

---

## TD-07 — Sentry can receive customer personal data

**Area** Server integrations · **File** `lib/sentry.ts:3-8` · **Severity** Medium · **Effort** ~30 min

**Evidence.** No `beforeSend` scrubber, so request bodies are unfiltered and an error thrown after body parsing can carry names, addresses and message text to Sentry. Found by [[10-integrations]].

**Why it matters.** Not a breach today — [[00-vision]] records no real users and no real personal data. It is recorded because it is precisely the kind of thing that is easy to forget in the window between acquiring real traffic and noticing.

**Recommendation: worth fixing.** Add a `beforeSend` that strips `req.body`, `req.query` and sensitive headers. Cheap now, awkward later.

**Blast radius.** One config file.

---

## TD-08 — Job enqueue failures logged but never retried

**Area** Server integrations · **File** `routes/webhooks.ts:83-89` · **Severity** Medium · **Effort** ~1 h

**Evidence.** `sendClassifyJob(ticket).catch((error) => console.error(...))`, after the 201 has been sent. Job execution retries three times; enqueueing does not retry at all. Found by [[13-cross-cutting]].

**Why it matters.** The weaker guarantee sits on the path that has already reported success to a caller that will not retry. A transient queue hiccup leaves a ticket created but stuck in `new` — which the agent UI filters out, so **no human ever sees it**. It is a silent drop, not a visible error.

**Recommendation: worth fixing.** Simplest correct change: enqueue *before* responding, so a failure can 500 and let SendGrid's own retry do the work. A retry wrapper is the alternative.

**Blast radius.** One webhook handler, possibly the two job-send helpers.

---

## TD-09 — `DELETE /api/users/:id` — three writes, no transaction

**Area** Server API · **File** `routes/users.ts:120-130` · **Severity** Medium · **Effort** ~15 min

**Evidence.** `user.update` (soft-delete), `ticket.updateMany` (unassign), `session.deleteMany` (invalidate) run sequentially, unwrapped.

**Why it matters.** A failure after write 1 leaves a soft-deleted user with live sessions. The `deletedAt` check in `requireAuth` (`middleware/require-auth.ts:15-18`) catches exactly that case, which is why that check is not the dead code it can look like — it is the backstop for this gap.

**Recommendation: worth fixing.** Wrap in `$transaction`. `POST /api/users` at `:38` already does this; copy it.

**Blast radius.** One route handler.

---

## TD-10 — `PUT /api/users/:id` — two writes, no transaction

**Area** Server API · **File** `routes/users.ts:85-96` · **Severity** Medium · **Effort** ~10 min

**Evidence.** `user.update` (name, email), then conditionally `account.updateMany` (password).

**Why it matters.** A failure between them means the admin sees a saved profile and the user's password silently did not change — the two halves of one "save" diverging with no signal.

**Recommendation: worth fixing.** Wrap both in `$transaction`, keeping the password write conditional.

**Blast radius.** One route handler.

---

## TD-11 — `Account` rows never cleaned for a soft-deleted user

**Area** Server data · **File** `routes/users.ts:120-133` · **Severity** Low · **Effort** ~10 min

**Evidence.** Sessions are deleted (`:130`); `Account` rows (`schema.prisma:72-89`) are not. Found by [[07-data-model]].

**Why it matters.** A password hash outlives the user it authenticates. Harmless while the user's `deletedAt` blocks sign-in, but it is stored credential material with no owner.

**Recommendation: fix when next touching user deletion.** Add `account.deleteMany` alongside the session delete — ideally inside the transaction from TD-09.

---

## TD-12 — No actor attribution on any table

**Area** Server data · **Severity** Low · **Effort** — · Found by [[07-data-model]]

**Evidence.** No `createdBy` or `modifiedBy` column anywhere. `createdAt`/`updatedAt` record when, never who.

**Recommendation: accept.** Neither [[00-vision]] nor [[00-scope]] asks for audit trails. Recorded so that a future requirement to attribute a change — particularly a permission change — starts from a known position rather than a discovery.

---

## TD-13 — No CI runs any test

**Area** Infrastructure · **Severity** Medium · **Effort** ~4–6 h · Found by [[11-testing]], [[00-scope]]

**Evidence.** `.github/workflows/` holds only `claude.yml`, a `@claude` mention responder. Nothing triggers on push or pull request. `solvo.json` sets `quality.tests.onPr: "run"`, so the configuration expects a pipeline that does not exist.

**Why it matters.** **An absent pipeline is not a green pipeline.** Every quality gate is local and unenforced, and the only honest claim any change can make is "verification ran locally", never "CI passed".

**Recommendation: worth fixing, but deliberately out this horizon** per [[00-scope]]. The point of recording it is to keep the claim honest in the meantime.

---

## TD-14 — UUID route params not validated

**Area** Server API · **Files** `routes/users.ts:71,106` · **Severity** Low · **Effort** ~5 min

**Evidence.** Neither handler validates `:id`. `parseId` (`lib/parse-id.ts:1-4`) is numeric-only and does not apply to UUIDs; nothing replaces it.

**Why it matters.** Mildly: a malformed id yields 404 where the numeric-id routes would yield 400. Inconsistent rather than unsafe.

**Recommendation: fix when next touching `/api/users`.** A `parseUuid` helper mirroring `parseId` would keep the shape consistent.

---

## TD-15 — Session expiry UX inconsistent

**Area** Client + Server · **Severity** Low · **Effort** ~1 h · Found by [[13-cross-cutting]]

**Evidence.** No 401 interceptor. The server 401s immediately, but the user sees an error alert on a button press and a redirect to sign-in on a navigation.

**Recommendation: fix when next touching auth.** An Axios interceptor that catches 401, clears the session and redirects, registered once.

---

## TD-16 — `UpdateTicket.tsx` has no error surface

**Area** Client · **Severity** Medium · **Effort** ~5 min

**Evidence.** The `PATCH` mutation (`:21-44`) has no `onError` and renders no `ErrorAlert`. The only mutation in the client that does not.

**Why it matters.** A failed status, category or assignment change is invisible: the dropdown reverts on refetch and the user reasonably concludes it worked, or that the UI is glitchy. Five minutes of work against a real wrong-belief failure.

**Recommendation: fix when next touching ticket detail.** `<ErrorAlert error={mutation.error} fallback="Failed to update ticket" />`, as every other page does.

---

## TD-17 — Ticket list cache never invalidated

**Area** Client · **File** `client/src/pages/UpdateTicket.tsx:41` · **Severity** Low · **Effort** —

**Evidence.** `["ticket", id]` is invalidated; `["tickets", …]` never is, anywhere.

**Recommendation: accept.** `staleTime: 0` plus refetch-on-focus corrects it fast enough that it has evidently never been felt. Adding `["tickets"]` to the same `onSuccess` is a one-line fix if it ever is.

---

## TD-18 — GPT endpoints unbounded

**Area** Server API · **Files** `routes/replies.ts:70,112` · **Severity** Low · **Effort** — · Found by [[13-cross-cutting]]

**Evidence.** No rate limit, throttle or cost cap on `/summarize` or `/polish`; the auth limiter covers only `/api/auth/*`. Each is a paid call from one click, and the limiter is additionally disabled outside production.

**Recommendation: accept now, revisit before real traffic.** [[00-scope]] records the absent cost ceiling as acceptable this horizon. Per-user rate limiting keyed on `req.user.id` is the fix when it is needed.

---

## TD-19 — Generated Prisma client gitignored and unwired

**Area** Infrastructure · **Files** `.gitignore:36`, `server/package.json` · **Severity** Medium · **Effort** ~15 min

**Evidence.** `server/src/generated/prisma/` is ignored and absent from a fresh clone, and no `postinstall` generates it.

**Why it matters.** **This is the repo's sharpest real onboarding gap.** A new checkout cannot type-check or start the server, and the failure gives no hint that `prisma generate` is what is missing. Gitignoring the client is correct; not wiring the generation step is the omission.

**Recommendation: worth fixing.** `"postinstall": "prisma generate"` in `server/package.json` — the standard Prisma pattern.

**Blast radius.** One `package.json` change.

---

## TD-20 — Two E2E tests deliberately disabled

**Area** Testing · **File** `e2e/tests/auth.spec.ts:384-397` · **Severity** Low · **Effort** 0 min, blocked

**Evidence.** Two commented-out tests — "should redirect agent to home when accessing admin route" and "should not show 'Users' link in navigation for agent" — with a comment at `:381-382` naming the blocker: only an admin is seeded.

**Not tech debt.** A documented future task with an explicit unblocking condition. It is in the register so the condition is discoverable from here.

**Recommendation: enable when a non-admin user is seeded.** Shares its blocker with TD-21.

---

## TD-21 — No authorization tested at API level

**Area** Testing · **Severity** Medium · **Effort** ~2 h · Found by [[11-testing]]

**Evidence.** Every authorization assertion in the suite is a UI observation. With no server test suite, nothing proves `requireAdmin` refuses a non-admin request, and nothing proves the admin-deletion 403 at `routes/users.ts:115-118` fires.

**Why it matters.** The client's own guards are explicitly display-only in two places ([[13-cross-cutting]]), so the server is the entire boundary — and the boundary is the untested part. A regression that removed `requireAdmin` from a route would break no test.

**Recommendation: worth fixing.** Drive Playwright's `request` fixture directly and assert the status codes, following `webhook-inbound-email.spec.ts`, which already tests auth this way for the webhook secret. Needs a seeded non-admin user, same as TD-20.

---

## Related

- [[legacy-map]] — the evidence behind each entry
- [[08-standards/conflicts]] — the structural gaps (no CI, no server ESLint, split TypeScript strictness, no coverage thresholds, test distribution)
- [[05-api-surface]] · [[07-data-model]] · [[10-integrations]] · [[11-testing]] · [[13-cross-cutting]]
- [[00-scope]] — refactors are out of scope this horizon
- [[00-vision]] — the maturity that calibrates every severity here
