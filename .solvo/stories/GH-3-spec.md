---
type: story
github: GH-3
tier: T2
tags: [tickets]
date: 2026-09-06
---

# GH-3 — a filter or sort write is lost when pagination follows it immediately

Recon: [[GH-3-recon]] · Bug: https://github.com/JBM95/helpdesk/issues/3 · Origin finding: `FIND-86cc706fc23c` on [[GH-1-spec]] · Domain: [[tickets]] · Feature: [[tickets-list]]

## Intent

Two URL writes issued from one committed render both merge into the same render-snapshot params, so the
second silently discards the first. Choosing a Status and then clicking Next quickly leaves `?page=2`
with the filter gone. Make every write merge against the params as they are at the moment of the write,
so no write is lost, while rendering continues to use the committed value.

## Where this lands, and why it is not a new branch

The defect exists **only** on `gh/1-preserve-ticket-list-view-state`. On `test/solvo`,
`TicketsPage.tsx` still holds filters in `useState` and never calls `setSearchParams`, so a branch cut
from `test/solvo` would have nothing to modify. Confirmed in recon. **JB Mccallaghan decided at the
tier gate that the fix lands on the `gh/1` branch, inside PR #2**, so the defect never reaches
`test/solvo`. PR #2 already carries a `fail` QA verdict and should not merge as it stands.

## Grounding

`docs/repo-wiki/` is scaffold-only in this repo — no `03-domains/`, `04-features/`,
`05-api-surface.md`, `06-frontend-map.md` or `09-legacy/`, and `_state/exploration-state.json` does not
exist. The map was never built; this is not staleness. `state.grounding` is therefore `[]`, which is an
accurate record rather than a skipped step.

Grounded instead on: the source read during recon, `RUN-22425dc46b2e`'s captured evidence, the triage
record `TRI-39894cdd1547`, and the `react-router@7.13.0` source in `node_modules` (cited below, because
the fix turns on what it actually does rather than on what its type signature suggests).

## Acceptance criteria

`ticket-standard` has no bug variant — a known gap in that standard — so #3 carries no Gherkin. These
are derived from GH-1's AC1 and AC6, which are what the defect contradicts, and they are what the tests
below prove.

- **AC-a** — Choosing a status filter and then clicking Next before the list settles yields
  `?status=open&page=2`, with the Status control reading "Open" and the filtered list on page 2.
- **AC-b** — The same holds for a sort change followed immediately by Next: neither the sort field nor
  the direction is lost. The bug report names this explicitly; it is the same code path, not a
  speculative extension.
- **AC-c** — AC6 still holds: changing a filter or sort resets to page 1, including when a page change
  preceded it in the same render.
- **AC-d** — No behaviour that GH-1's approved case set already fixes changes. In particular
  `CASE-93514dfd0070` ("advance exactly one page on a double-click of Next") stays green.

### Ambiguity scan

Cleared. The two orderings do not compete: a filter change after a page change resets to page 1
(AC6/AC-c), and a page change after a filter change lands on page 2 of the filtered list (AC1/AC-a).
Two rapid writes to different keys both land; two to the same key resolve last-write-wins, which is
what the user's second action asked for.

## The trap that decides the implementation

**The obvious fix does not work, and I recorded the wrong one on #3 before checking.** The bug item
says to take `setSearchParams`'s functional-updater form. Reading
`node_modules/react-router/dist/development/chunk-HMDR2CVH.js:708-717`:

```js
let setSearchParams = React.useCallback((nextInit, navigateOptions) => {
  const newSearchParams = createSearchParams(
    typeof nextInit === "function" ? nextInit(new URLSearchParams(searchParams)) : nextInit
  );
  ...
}, [navigate, searchParams]);
```

`prev` is the **same closed-over render-snapshot** `searchParams` that `params` is derived from. Two
writes from one committed render receive identical `prev`, so the clobber survives that change
untouched. #3 needs correcting.

Why the window exists at all, from the same source: `chunk-WICQJKU6.js:286` calls
`globalHistory.pushState` **synchronously**, while `chunk-WICQJKU6.js:9275` defers the React state
update inside `React.startTransition`. Between those two the browser URL is already correct and the
committed render is one write behind.

**`window.location.search` is also rejected**, even though it would be correct in production. Every
component test mounts `MemoryRouter`, which never touches `window.location`, so reading it would make
229 tests exercise a code path production does not use — and rewriting them onto `BrowserRouter` would
widen the blast radius from 1 file to every test file that renders this page.

## Approach

Separate the two jobs the snapshot is currently doing. **Render from the committed params; write from
the latest params.**

- Keep `params = parseTicketListParams(searchParams)` exactly as it is for rendering. A render must use
  the committed value, and nothing about that is wrong today.
- Add a ref holding the latest params known to the component, and merge every write against it:
  - each write sets the ref to what it just wrote, synchronously, before `setSearchParams`, and queues
    the serialised URL it sent
  - an effect keyed on the committed `params` re-syncs the ref, which is what keeps Back, Forward, a
    reload and any external URL change authoritative
- The ref is written in the handler and in an effect, never during render. A render-phase mutation
  would be unsound under a transition: a discarded pending render would still have moved the ref.

Two details the effect cannot get right without them, both found in review:

- **The pending write is a queue, not a slot.** The race issues two writes before either commits, so the
  first commit to arrive is the older one. With a single slot it is unrecognisable as ours, and adopting
  it would discard the newer write — reintroducing the defect on the very sequence being fixed.
- **An outside navigation must beat a write in flight.** A commit that is neither one of our queued
  writes nor the current URL is Back, Forward, a reload or a hand-edited URL, and it wins: the queue is
  dropped and the ref adopts it. An earlier revision instead kept the written value and documented that
  as a bound "no worse than before"; review traced that to be false — pre-fix wrote the popped value,
  whereas pinning it makes the next write resurrect a filter the reader navigated away from. Comparing
  against the previous commit is what separates that case from an ordinary re-render (a query resolving
  re-runs the effect with the URL unchanged, and must not discard a live write).

`handleFiltersChange`'s `refiningExistingSearch` comparison must read from the same latest params, not
from the render snapshot — otherwise the push-versus-replace decision stays one write behind and the
history rule GH-1 established silently regresses.

## Files to touch

| File | Change |
|---|---|
`client/src/pages/TicketsPage.tsx` | `write()` merging against the latest params, and the three handlers plus the refining comparison reading from them |
`client/src/lib/use-latest-ticket-list-params.ts` | **added after GATE 1** — the ref and the effect, extracted so the commit sequences can be driven directly. Approved at a scope-drift pause |
`client/src/lib/use-latest-ticket-list-params.test.ts` | the hook's own commit-sequence tests |
`client/src/pages/TicketsPage.test.tsx` | new tests per the AC map below |
`client/src/pages/TicketsTable.tsx` | **added after GATE 1** — the sibling defect `FIND-5232572f9eda` (the footer unmounting on refetch), plus the loading affordance that fix requires. Approved at the same pause |
`e2e/tests/ticket-list-url-state.spec.ts` | the intermediate-URL assertion that separates the two competing readings (see Open question) |

Recon put the blast radius at 1 source file and 8 call paths into `write()`. Nothing under `server/`,
`core/` or `prisma/` is implicated. `TicketsFilters.tsx` is **not** changed: it already passes deltas
outward and the merge is the page's job.

Both post-GATE-1 additions are recorded with their reasons in `.solvo/state/GH-3.json` →
`scopeChanges`. The delivered blast radius is 3 source files, still far under the escalation threshold,
so the tier is unchanged.

## AC → test map

| AC | Proven at |
|---|---|
| AC-a | component: "should keep both writes when a search and a page change are issued in the same render" — both events inside one `act`, asserting `?search=login&page=2`. E2E: `CASE-8e3d236b21a9`, which was failing and is now green |
| AC-b | component: "should keep both writes when a sort and a page change are issued in the same render", asserting `?sortBy=subject&sortOrder=asc&page=2` |
| AC-c | component: the existing AC6 cases stay green, plus "should still reset to page 1 when a filter change follows a page change". The same-render half of AC-c is covered by the two AC-a/AC-b tests above, which are exactly that ordering |
| AC-d | component: `CASE-93514dfd0070` **with a revised expectation** — `?page=3`, not `?page=2`. See the note below |

Both AC-a and AC-b tests are mutation-verified: unwiring the hook from `TicketsPage` (reading `params`
instead of `latest.read()`) fails both and nothing else in the 246-test suite.

A component test can only catch this class if the two actions land in the **same** `act`. Sequential
`fireEvent`s do not: React Testing Library wraps each in its own `act`, which flushes react-router's
transition in between, so the second write sees fresh params. Every existing racing-pair test
serialises them that way — `TicketsPage.test.tsx:773` polls the URL between the two header clicks —
which is why the whole 229-test suite was green while the defect was live.

An earlier revision of this spec claimed the race was **not reproducible in jsdom at all**, and that
claim was wrong: it rested on a probe that used sequential `fireEvent`s and so measured the flush, not
the race. Two events inside one `act` reproduce it exactly. The hook extraction was justified on that
false premise; it is kept because the commit-sequence tests it enables are worth having on their own,
but it was not the only route to a guard.

### AC-d's revised expectation

`CASE-93514dfd0070` (double-clicking Next) was approved expecting `?page=2`. It only ever passed
because the footer defect `FIND-5232572f9eda` swallowed the second click — isolated by removing that
fix alone, which returns the case to `?page=2`. Two clicks mean two pages, so the case now expects
`?page=3`, confirmed by a named human at a scope-drift pause. `.solvo/testplans/GH-1-cases.md` still
records the old expectation and needs a case-set revision through `/qa-cases`; that artifact is not
edited from a dev cycle.

## Anti-regression plan

- `cd client && bun run test` in full, not a targeted file run. All 229 must stay green, and
  `TicketsPage.test.tsx:251`'s exact-params assertion stays an exact match — it is GH-1's AC9 control
  and must not be loosened to `objectContaining`.
- `bun run test:e2e` in full. Two scenarios currently fail; `CASE-8e3d236b21a9` must go green here.
  `CASE-e51a15eb56e6` is the sibling defect `FIND-5232572f9eda` (the footer unmount), which was brought
  into this cycle at a scope-drift pause and must therefore also go green rather than being reported red.
- The suite runs at `workers: 1`; do not raise it to make anything pass.

**Result.** Client suite 246/246, up from the 229 baseline. E2E across three full runs: 81/82, 82/82,
82/82. The single failure was `CASE-f8fac94b30ab` ("should undo a filter change on Back"), which passes
5/5 in isolation and 13/13 with its own spec file — the suite's known shared-database ordering
flakiness, not a regression from this change. `checks.e2e` in the state file records this.

## Rollback

Revert the commit. Pure client change, no migration, no flag, no config. Reverting restores the
lost-write behaviour rather than breaking anything new.

## Open question, carried rather than guessed

The QA evidence cannot separate two readings of the observed failure: the status write was issued and
then clobbered (what this spec fixes), or the Radix option click never produced a write at all. Both
produce `?page=2` with the trigger reading "All statuses". The fix addresses the first; if the second
is also live, the scenario will still fail after this change. The E2E change above is what tells them
apart, and it is cheap enough to include here rather than defer.

**Resolved: it was the first reading.** `CASE-8e3d236b21a9` now collects the URLs the page passes
through and asserts one of them carries `status=open` without `page=2` — proof the status write was
issued in its own right and then lost, not never issued. The assertion is collected rather than awaited
between the two clicks on purpose: awaiting there would let the first write commit and remove the very
window under test. It passes, so the Radix option click does produce a write and the second reading is
not live.
