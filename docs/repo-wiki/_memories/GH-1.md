---
type: memory
github: GH-1
tier: T2
tags: [tickets]
date: 2026-09-05
---

# GH-1 — ticket list state moved into the URL

Story: [[GH-1-spec]] · Evidence: [[GH-1]] · Domain: [[tickets]] · Feature: [[tickets-list]]

## What changed

The ticket list's filters, sort and page moved out of component state into URL search params.
`client/src/lib/ticket-list-params.ts` owns the grammar: parsing validates every param against the
allow-lists in `core/constants/`, and serialising omits anything equal to its default so the plain
list is a bare `/tickets`. `sortableColumns` moved from `core/schemas/tickets.ts` to
`core/constants/ticket-sort.ts` so client and server validate `sortBy` against one list.

## Traps in this area, for whoever comes next

**Trimming a controlled input's value on the way in eats the character being typed.** The search input
is controlled by the parsed URL value. Trim on read while writing untrimmed and React restores the
trimmed value after each keystroke, so a space never survives to become part of the term: typing
"vpn access" produced "vpnaccess". Trimming now happens only where the request is built, so the URL
and the input keep what was typed and the API gets what was meant. If you add another text filter to
this page, put its normalisation at the request boundary too.

**`Number.isInteger` is not the server's integer.** Zod's `z.int()` caps at `MAX_SAFE_INTEGER`, so
`?page=1e21` passed a client guard written with `isInteger` and came back 400 — and because
`TicketsTable` turns any query error into an error alert, a bad param blanks the list rather than
degrading it. Use `Number.isSafeInteger`. There is a second, tighter ceiling: the route computes
`skip: (page - 1) * pageSize`, and while Prisma types `skip` as a plain `number` its query engine
rejects one outside signed 32-bit range at runtime, which is why
`ticket-list-params.ts` carries `MAX_PAGE` rather than trusting the schema's bound.

**Two values look valid from the UI and are not.** `?status=new` is a real `TicketStatus` but absent
from `agentTicketStatuses`, which is what the list endpoint accepts. `?sortBy=senderEmail` looks
plausible because the sender column renders an email, but `senderEmail` is not in `sortableColumns`.
Both 400 if forwarded.

**Never reset derived state in an effect keyed on a derived object.** The old `TicketsTable` reset
`pageIndex` in a `useEffect` keyed on the `filters` object. Once `filters` came from search params
that object was new every render, so the effect would have reset the page on every render — AC6 would
pass while AC3, AC4 and AC5 all failed. The reset belongs where the user changes the filter, in
`TicketsPage`, not in a reference comparison.

**Per-keystroke history is a real cost of URL state.** Pushing an entry per character makes Back
useless. The rule here: the first keystroke of a search pushes, refining replaces, clearing pushes,
and every discrete choice (status, category, sort, page) pushes.

## Traps in testing this area

**`window.history` is meaningless under `MemoryRouter`.** It never moves, so any assertion on
`window.history.length` passes regardless of the code. Use `useNavigationType()` to tell PUSH from
REPLACE.

**`rerender()` with the same element object does not re-render.** React sees `oldProps === newProps`
and skips the subtree. Force it from inside the tree and assert something moved.

**AC5-style history behaviour does not need a browser.** A router POP via `useNavigate(-1)` inside
`MemoryRouter` exercises the list re-deriving from the popped URL, which is the part that can break.
All seven AC5 instances are covered this way; Playwright covers the real Back button on top of that.

**TanStack's first sort direction depends on whether rows have loaded.** `getFirstSortDir` reads the
first row's value to guess the column type; with no rows it cannot, and a string column sorts
descending first instead of ascending. Any test that clicks a header while the response is in flight
must not assert the direction.

**`renderWithQuery` takes no `initialEntries` and is shared by six test files.** Build a local
router in the test rather than extending it. The Radix pointer-capture shim needed to drive a Select
in jsdom lives at `client/src/test/pointer-events.ts`.

## Traps in running the E2E suite at all

These cost more to rediscover than anything above, and none of them is about this story's code.

**The suite could not start on Windows, and had not been able to since the initial commit.**
`playwright.config.ts` started the client `webServer` with a POSIX `VITE_API_URL=... bun run` prefix.
Playwright spawns `webServer` through the platform shell, so cmd.exe read `VITE_API_URL` as a program
name: `'VITE_API_URL' is not recognized`. Anything environment-dependent in a `webServer` command
belongs in its `env` field, which is shell-independent. If you add a second `webServer`, do the same.

**The suite is pinned to `workers: 1`, and removing that will make specs fail on other specs' data.**
Every spec shares one database with no per-test isolation, and several assert "my ticket is on page 1
of `/tickets`" against an unfiltered list. That is safe only while nobody else is creating tickets.
This story's specs need 11 tickets to paginate, ×8 tests, which pushed `tickets.spec.ts`'s and
`ticket-detail.spec.ts`'s own tickets off page 1 — they failed on data they did not create. There is
no `DELETE /api/tickets` to clean up with. Before raising the worker count, give the specs a data
namespace or a teardown; a worker count is not the lever.

**`page.route` with a broad pattern holds requests you did not mean to hold.** A handler matching
`**/api/tickets?*` also catches the request `goBack()` fires for the popped URL. Park that against a
promise the test resolves later and the test deadlocks; call `page.unroute()` while handlers are still
parked and `route.continue()` returns `Route is already handled!`. This failed 6 runs in 10. Match the
one request you mean — here `/\/api\/tickets\?.*sortBy=subject/` — and you need no `unroute` at all,
since handlers die with the context.

**A test that passes in isolation is not a passing test here.** Both defects above were invisible when
the file ran alone and appeared only in the full suite. Run `--repeat-each` on anything touching
history or interception before believing it.

## What is still not verified

The 13 scenarios now pass — 13/13, and the full suite 82/82 on two consecutive runs. Two gaps remain:

- **The seed helper's race with `auto-resolve-ticket` is untested, not disproven.** It never fired
  because `OPENAI_API_KEY` is unset here, so auto-resolve throws before it can move a seeded ticket to
  `resolved`. On a machine with a real key those four status-filtered scenarios can still lose the race,
  and they time out rather than failing an assertion.
- Both exploratory charters on the approved plan are unperformed, and `/qa-verify` has not run.
