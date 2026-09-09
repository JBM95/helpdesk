---
tags: [legacy, client, server, core, e2e]
---

# Legacy Map

> **Client** audited by `explore-13-legacy-detective` via `/setup-05-explore client` on 2026-09-07.
> **Server, core, e2e** audited by `explore-13-legacy-detective` via `/setup-05-explore server core e2e` on 2026-09-08.
> **Scope:** full repo. Excluded: `client/src/components/ui/` (vendored shadcn primitives) and `server/src/generated/prisma/` (generated, gitignored).

## Summary

**21 findings across the full stack**, registered as TD-01 through TD-21 in [[tech-debt]]. **None threatens correctness at current maturity** ([[00-vision]] — no real users, no real personal data).

By area: client 6 · server integrations 4 · server API 4 · server data model 2 · infrastructure 2 · testing 2 · client-and-server 1.

The character of the findings matters more than the count. This is a young codebase — first commit 2026-02 — with **no framework rot, no deprecated dependencies, no dead code and no TODO/FIXME/HACK comments in source**. What it has instead are *isolated gaps*, mostly of one kind: **operations that fail quietly**. Five of the six medium-severity entries are silent-failure findings, not decay.

## Frontend (client)

### Duplicated domain knowledge — `TicketsFilters.tsx:66-68`

The category filter lists its three options as literal `SelectItem` values:

```tsx
<SelectItem value="general_question">General question</SelectItem>
<SelectItem value="technical_question">Technical question</SelectItem>
<SelectItem value="refund_request">Refund request</SelectItem>
```

The status filter **in the same file** (`:47`) maps over `agentTicketStatuses` from `core/constants/ticket-status.ts`, and `UpdateTicket.tsx:5,86-88` maps over `ticketCategories` with `categoryLabel[c]`.

So the shared constant exists, is used for exactly this purpose in a sibling component, and is bypassed here. **Adding a category to `core/constants/ticket-category.ts` would silently fail to appear in the filter** — no type error, because the literals still compile. The failure mode is a filter that quietly cannot reach a subset of tickets. → [[tech-debt|TD-01]]

### Style inconsistency — `StatusBadge.tsx:3-9`

Three of five statuses use hardcoded Tailwind palette classes (`bg-sky-500/15`, `bg-amber-500/15`, `bg-pink-400/15`); the other two use semantic tokens (`bg-muted text-muted-foreground`). CLAUDE.md declares semantic tokens, and [[08-standards/observed]] records 100% adherence everywhere else outside `components/ui/`.

Five statuses need five distinguishable colours and the semantic palette does not supply five, so reaching for named hues is defensible. The finding is the *mix within one object*: the badge's colour language is half theme-derived and half literal, so a theme change moves two of the five. → [[tech-debt|TD-02]]

### Missing error surface — `UpdateTicket.tsx`

The `PATCH /api/tickets/:id` mutation (`:21-44`) has no `onError` and renders no `ErrorAlert`. A failed status, category or assignment change is **silent** — the dropdown snaps back when the ticket refetches, with nothing explaining why. Every other mutation in the client surfaces errors; this is the sole exception. → [[tech-debt|TD-16]]

### Query invalidation gap — the ticket list cache

`UpdateTicket.tsx:41` invalidates `["ticket", id]` only. No code anywhere invalidates `["tickets", …]`, so a status change on the detail page leaves the cached list stale until unmount or refocus. With `staleTime: 0` it self-corrects quickly enough that it has evidently never been felt. → [[tech-debt|TD-17]]

### Build tooling — a type escape hatch

`vite.config.ts:20` — `sentryVitePlugin({...}) as any`, a typing mismatch between `@sentry/vite-plugin` and Vite 7's plugin type. Runtime behaviour is correct; source maps upload when the token is set ([[12-build-deploy]]). → [[tech-debt|TD-03]], recommendation: leave it.

### Documentation — a stale template

`client/README.md` is the unmodified Vite scaffold. Its ESLint guidance names plugins the project does not use, and it mentions none of Bun, Tailwind 4, shadcn/ui, Vitest or Better Auth. → [[tech-debt|TD-04]]

## Backend (server)

### Silent failure modes

**No timeout on any OpenAI call** — all four sites: `lib/classify-ticket.ts:30-38`, `lib/auto-resolve-ticket.ts:43-61`, `routes/replies.ts:97-108` and `:131-141`. A hung request holds a pg-boss worker or an Express handler open indefinitely. Found by [[10-integrations]]. → [[tech-debt|TD-05]]

**Outbound email is not idempotent and its failure is silent** — `lib/send-email.ts:21-42`, enqueued from `auto-resolve-ticket.ts:96-100` and `routes/replies.ts:61-65`. Nothing keys a send to a `(ticketId, replyId)` pair, so a reprocessed job double-sends. After three retries the job fails with no alert and no re-send path, **while the ticket may still read `resolved`** — a customer waits for a reply that no longer exists anywhere in the system. Found by [[10-integrations]]. → [[tech-debt|TD-06]]

**Sentry can receive customer personal data** — `lib/sentry.ts:3-8` has no `beforeSend` scrubber, so request bodies are unfiltered and an error thrown after body parsing can carry names, addresses and message text off-system. Found by [[10-integrations]]. → [[tech-debt|TD-07]]

**Job enqueue failures are logged but never retried** — `routes/webhooks.ts:83-89`:

```typescript
sendClassifyJob(ticket).catch((error) =>
  console.error(`Failed to enqueue classify job for ticket ${ticket.id}:`, error)
);
```

Job *execution* retries three times; job *enqueueing* does not retry at all. The 201 has already gone out, so SendGrid will not retry, and the ticket exists with no classification and no auto-resolve attempt — stuck in `new`, which the agent UI filters out, so **nobody sees it**. The weaker guarantee sits on the path that has already reported success. Found by [[13-cross-cutting]]. → [[tech-debt|TD-08]]

### Non-transactional writes

**`DELETE /api/users/:id` — three writes, no transaction** (`routes/users.ts:152-162`): soft-delete the user, unassign their tickets, delete their sessions. A partial failure leaves a soft-deleted user whose sessions are still live, or whose tickets are still assigned. → [[tech-debt|TD-09]]

**`PUT /api/users/:id` — the password write sits outside the transaction** (`routes/users.ts:112-128`): the profile update and the demotion session drop are batched, then conditionally the password is written separately. A failure between them updates the profile and leaves the password unchanged. GH-8 (2026-09-08) added the `$transaction` around the first two only — the case with an authorization consequence — so this narrowed rather than closed. → [[tech-debt|TD-10]]

Both are notable because `POST /api/users` at `:38-61` **does** use `$transaction` — the pattern is present in the same file, applied to the `PUT` only in part and not at all to `DELETE`.

### Data model gaps

**`Account` rows are never cleaned for a soft-deleted user** — `DELETE /api/users/:id` removes sessions (`:162`) but not credentials (`schema.prisma:72-89`), so a password outlives the user it belongs to. Found by [[07-data-model]]. → [[tech-debt|TD-11]]

**No actor attribution on any table** — no `createdBy` or `modifiedBy` column exists anywhere. Timestamps record *when*, never *who*. Found by [[07-data-model]]. → [[tech-debt|TD-12]]

### Validation gap

**UUID route params are not validated** — `PUT`/`DELETE /api/users/:id` (`routes/users.ts:71,106`) never check the param. `parseId` (`lib/parse-id.ts:1-4`) is numeric-only and does not apply, and nothing replaces it, so a malformed id falls through to a 404 instead of the 400 the numeric-id routes would return. → [[tech-debt|TD-14]]

### Unbounded GPT endpoints

`/summarize` and `/polish` (`routes/replies.ts:70,112`) have no rate limit, no throttle and no cost cap — the auth limiter covers only `/api/auth/*`. Each is a paid OpenAI call from one button click. Found by [[13-cross-cutting]]. → [[tech-debt|TD-18]]

## Client and server together

**Session expiry behaves differently depending on what the user clicks.** There is no 401 interceptor, so the server's immediate 401 surfaces as an ordinary error alert on a button press, but as a redirect to sign-in on a navigation — one condition, two experiences. Found by [[13-cross-cutting]]. → [[tech-debt|TD-15]]

## Build and infrastructure

**No CI runs any test.** `.github/workflows/` holds one workflow, `claude.yml`, a `@claude` mention responder. Nothing builds, type-checks, lints or tests on push or pull request — while `solvo.json` sets `quality.tests.onPr: "run"`, so the config expects a pipeline that does not exist. **An absent pipeline is not a green pipeline**; every gate here is local and unenforced. Found by [[11-testing]] and [[00-scope]]. → [[tech-debt|TD-13]]

**The generated Prisma client is gitignored and unwired.** `server/src/generated/prisma/` is ignored (`.gitignore:36`) and absent from a fresh clone, and no `postinstall` script generates it — so a new checkout cannot type-check or start the server until someone knows to run `prisma generate`. This is the repo's sharpest genuine onboarding gap. → [[tech-debt|TD-19]]

## Testing gaps

**Two E2E tests are deliberately disabled** at `e2e/tests/auth.spec.ts:384-397` — "should redirect agent to home when accessing admin route" and "should not show 'Users' link in navigation for agent" — with a comment naming the reason: the seed creates only one user, an admin. **Not rot; a documented future task with a clear unblocking condition.** → [[tech-debt|TD-20]]

**No authorization is tested at API level.** Every authorization assertion in the suite is a UI observation — a link is visible, a button is present, a route redirects. With no server test suite, **nothing anywhere proves that `requireAdmin` refuses a non-admin request.** Found by [[11-testing]]. → [[tech-debt|TD-21]]

TD-20 and TD-21 share the same blocker: a second, non-admin principal in the seed. Anything that adds one unlocks both.

## Searched for and not found

Checked across `server/`, `core/` and `e2e/`, all clean:

| Pattern | Result |
|---------|--------|
| `TODO` / `FIXME` / `HACK` comments | **0** in source — the only hits are seed fixture strings describing sample bug reports |
| `@deprecated` / obsolete markers | 0 |
| Commented-out code | only the 2 deliberately disabled tests above, with their reason stated |
| Dead code, unused exports | 0 — every route is mounted, every middleware used |
| Empty catch blocks | 0 |
| `as any` / `: any` in hand-written code | 0 — the only instance is TD-03 in build config |
| Legacy frameworks, EOL packages | 0 — see [[dependencies]] |

## Deliberately not classified as debt

Recorded so a later pass does not re-raise them:

- **`@ts-expect-error` at `e2e/tests/webhook-inbound-email.spec.ts:166`** — deliberately constructing an invalid payload to test rejection. Correct use.
- **`upload.any()` at `routes/webhooks.ts:28`** — multer parsing SendGrid multipart, not a type escape.
- **`$transaction` present only at user creation and auto-resolve** — the two flows that have it are right; the absence elsewhere is TD-09 and TD-10, not a pattern to imitate.
- **`console.*` in server source** — four operational log lines, not debug noise. (Note `send-email.ts:35` logs recipient addresses, which is a data-in-logs consideration rather than debt.)
- **`e2e/global-teardown.ts:2` console.log** — documents the deliberate no-op teardown policy.

## Related

- [[tech-debt]] — the ranked register, with severity, effort and a recommendation per entry
- [[08-standards/conflicts]] — the structural gaps (no CI, no server ESLint, split TypeScript strictness, no coverage thresholds, test distribution)
- [[05-api-surface]] · [[07-data-model]] · [[10-integrations]] · [[11-testing]] · [[13-cross-cutting]] — the source docs behind these findings
- [[00-scope]] — refactors are out of scope this horizon
- [[00-vision]] — the maturity that calibrates every severity above
