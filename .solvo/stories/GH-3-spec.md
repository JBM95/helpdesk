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
- **AC-e** — Added at round 4, because round 3 found this case still broken and recon had predicted it:
  two *filter* controls changing before either settles keep both values, in either order. Choosing a
  status and typing a search yields `?status=open&search=login` whichever came first.
- **AC-c** — AC6 still holds: changing a filter or sort resets to page 1, including when a page change
  preceded it in the same render.
- **AC-d** — No behaviour that GH-1's approved case set already fixes changes, with one deliberate
  exception: `CASE-93514dfd0070` ("advance exactly one page on a double-click of Next"). Its expectation
  moves from `?page=2` to `?page=3`, because the old expectation was only ever satisfied by the sibling
  defect this cycle also fixes. See "AC-d's revised expectation" below. Every other approved case stays
  green as written.

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

**Tracking the pending write was tried and abandoned.** It was the delivered mechanism for two review
rounds, and it cannot be made correct. A Back that returns to the exact history entry an in-flight write
was issued from leaves the committed search, `location.key` and `useNavigationType()` all unchanged —
measured, not reasoned — so an abandoned write is indistinguishable from one still in flight by anything
React has committed. The consequence was a regression in the same class as GH-3 itself: the next control
the reader touched merged onto the abandoned write and resurrected the filter they had just navigated
away from. Both attempts to bound it (a single pending slot, then a queue) failed on the same case.

## Approach

Separate the two jobs the snapshot is currently doing. **Render from the committed params; write from
the live URL.**

- Keep `params = parseTicketListParams(searchParams)` exactly as it is for rendering. A render must use
  the committed value, and nothing about that is wrong today.
- Merge every write against the router's **live** location instead of the render snapshot. The live
  location already reflects any `pushState` this component has issued and any history navigation the
  reader has made, whether or not React has committed either — which is precisely the gap the defect
  lived in. Measured on both sides: during the race the live search reads
  `?sortBy=subject&sortOrder=asc` while the committed snapshot is still empty, and after an abandoned
  write plus a Back it reads the popped URL rather than the write.
- The live location is reachable through `UNSAFE_NavigationContext`'s navigator, which is authoritative
  under `BrowserRouter` and `MemoryRouter` alike — unlike `window.location`, which the component tests
  never touch.

There is nothing to keep in sync, so there is no ref, no effect, no pending state and no window in which
this component's idea of the URL can disagree with the router's. That is the point of the design: the
two rejected mechanisms above both failed by trying to model the URL rather than read it.

**The cost, stated rather than buried.** `UNSAFE_NavigationContext` is a private react-router export and
a live `location` on its navigator is not a documented guarantee, so a future upgrade could remove it.
Two things contain that, and both are asserted by tests: the read falls back to the committed params when
no live location is present, so an upgrade degrades to the pre-fix snapshot behaviour instead of
crashing; and the live read is asserted directly. Approved by JB Mccallaghan against the two
alternatives — documenting the residue, or owning the history object via `unstable_HistoryRouter`
(7 test files).

**The containment has a hole, found at round 3 and not closed.** An earlier revision of this section
claimed such an upgrade "fails a test naming this file". That holds only for a version bump that removes
the getter, and even then the tests it fails are the two page-level race tests, which name `TicketsPage`.
It does not hold for a change of **router type**, measured in `react-router@7.13.0`:

| Router | Navigator | Live `location`? |
|---|---|---|
| `BrowserRouter` | `createBrowserHistory()` | yes — getter reads `window.location` per access |
| `MemoryRouter` | `createMemoryHistory()` | yes — getter returns the current entry |
| `RouterProvider` (`createBrowserRouter`) | `{createHref, encodeLocation, go, push, replace}` | **no** |

So migrating this app to a data router would activate the fallback in production — silently restoring the
GH-3 defect — while every component test kept mounting `MemoryRouter` and stayed green. The hook's own
live-read tests would not catch it either: they inject a hand-built navigator and never mount a real
router. Carried to the merge gate as a decision rather than fixed here, because closing it means either a
runtime assertion in a hot path or a test that mounts a data router this app does not use.

Also worth stating: the fallback is **unreachable** under both routers installed today, since
`history.location.search` is always a string. It is tested future-proofing, not dead code, but production
never exercises it.

`handleFiltersChange`'s `refiningExistingSearch` comparison must read from the same live location, not
from the render snapshot — otherwise the push-versus-replace decision stays one write behind and the
history rule GH-1 established silently regresses. Added at round 4: the comparison was already correct,
but nothing tested it, so reverting it to the snapshot left all 242 tests green. Now guarded by
"should replace rather than push when a second keystroke lands in the same render".

### The hook is necessary but not sufficient: the controls also have to send deltas

Reading the live URL fixes every pair where the second write is a *different kind* of write — a filter
then a page, a sort then a page. It does not fix **two filter writes in one render**, and round 3 found
that still broken: status then search gave `?search=login` with the status gone; the reverse gave
`?status=open` with the search gone.

The cause is a level above the hook. `TicketsFilters` renders from the committed filter set and each
control emitted `{ ...filters, <its own key> }`, so the payload carried the other two keys **as they
were committed**. The page then merged that whole set over the live params, and the stale keys
overwrote the write that had just landed. Reading the live URL cannot help: the clobber arrives inside
the payload.

So each control now emits only the key it owns, and the page merges that delta against the live params.
Approved by JB Mccallaghan at the round-4 gate, over the alternative of diffing the incoming set against
the committed one inside `TicketsPage` — which keeps the change inside the original blast radius but
leaves the stale-set trap in place for whatever calls it next.

The compiler cannot hold this: every field of `TicketFilters` is optional, so a delta and a full set are
the same type. Two tests hold it instead, one per ordering, and reverting either control fails exactly
the ordering in which that control writes second.

## Files to touch

| File | Change |
|---|---|
`client/src/pages/TicketsPage.tsx` | `write()` merging against the latest params, and the three handlers plus the refining comparison reading from them; from round 4, merging the filter delta against them too |
`client/src/lib/use-latest-ticket-list-params.ts` | **added after GATE 1** — the live-location read, behind one hook so the private-API dependency has exactly one site. Approved at a scope-drift pause |
`client/src/lib/use-latest-ticket-list-params.test.ts` | the three properties a react-router upgrade could break: that the read is live, that an empty live search means the bare list rather than a missing location, and that it degrades to the committed params rather than throwing |
`client/src/pages/TicketsPage.test.tsx` | new tests per the AC map below |
`client/src/pages/TicketsTable.tsx` | **added after GATE 1** — the sibling defect `FIND-5232572f9eda` (the footer unmounting on refetch), plus the loading affordance that fix requires. Approved at the same pause |
`client/src/pages/TicketsFilters.tsx` | **added at round 4** — each control emits only the key it owns, instead of spreading the committed filter set. Approved by JB Mccallaghan; see the section above for why the hook alone does not cover this |
`client/src/lib/ticket-list-params.ts` | **added at round 4** — the `TicketFiltersDelta` type and the reason the compiler cannot enforce it |
`e2e/tests/ticket-list-url-state.spec.ts` | the intermediate-URL assertion that separates the two competing readings (see Open question) |

Recon put the blast radius at 1 source file and 8 call paths into `write()`. Nothing under `server/`,
`core/` or `prisma/` is implicated.

An earlier revision of this section claimed `TicketsFilters.tsx` was **not** changed because "it already
passes deltas outward". That was false — it passed the whole committed set — and the defect it caused is
the section above. Round 3 found it; recon had named the same pair at
[[GH-3-recon]] ("filter A + filter B", "Every pair of writes is affected"), so the claim contradicted
this cycle's own recon rather than merely being unverified.

Every post-GATE-1 addition is recorded with its reason in `.solvo/state/GH-3.json` → `scopeChanges`. The
delivered blast radius is 5 source files, still far under the escalation threshold, so the tier is
unchanged.

## AC → test map

| AC | Proven at |
|---|---|
| AC-a | component: "should keep both writes when a search and a page change are issued in the same render" — both events inside one `act`, asserting `?search=login&page=2`. E2E: `CASE-8e3d236b21a9`, which was failing and is now green |
| AC-b | component: "should keep both writes when a sort and a page change are issued in the same render", asserting `?sortBy=subject&sortOrder=asc&page=2` |
| AC-c | component: the existing AC6 cases stay green, plus "should still reset to page 1 when a filter change follows a page change" (serialised) and "should drop the page when a page change and a filter are issued in the same render" (the same-render half, asserting `?search=login` with the page gone) |
| AC-d | component: `CASE-93514dfd0070` **with a revised expectation** — `?page=3`, not `?page=2`. See the note below |
| AC-e | component: "should keep both writes when two different filters change in the same render" and "...the other way round", both asserting `?status=open&search=login`. The select is opened before the `act` so its portal render does not sit between the two writes |

Both AC-a and AC-b tests are mutation-verified: unwiring the hook from `TicketsPage` (reading `params`
instead of `latest.read()`) fails both and nothing else in the suite. Making the hook return the
committed params instead of the live ones fails those two plus the two hook tests; removing the fallback
fails the third hook test.

AC-e's two tests are mutation-verified one control at a time, and each ordering is pinned separately
rather than redundantly: reverting the search control to `{ ...filters, search }` fails only the ordering
where the search writes second (`?search=login`, status lost), and reverting the status control fails
only the other one (`?status=open`, search lost). A stale set clobbers whatever landed before it, so the
control that writes first cannot expose its own bug.

Beyond the ACs, three regression guards:

- "should not resurrect a filter the reader abandoned by navigating back" — fails against the
  pending-write mechanism this spec previously described, with exactly the value review observed
  (`?search=login&page=2` where `?page=2` is required), so it pins the class rather than just the current
  implementation.
- "should not resurrect a filter the reader left by a Back onto the unfiltered list" — added at round 4.
  The guard above cannot see the case where the popped URL is bare and the committed params are not,
  because there the committed params and the params parsed from an empty search agree. Weakening the
  hook's `live?.search === undefined` to a falsy check fails this test and the matching hook test, and
  nothing else — before round 4 that mutation left all 242 tests green.
- "should replace rather than push when a second keystroke lands in the same render" — added at round 4,
  covering GH-1's one-entry-per-search-session rule under the same race. `CASE-222fa42cb560` cannot:
  `user.type` serialises the keystrokes, so each sees a freshly committed render.

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

### E2E coverage is deliberately thin, and one placement needs a decision

Only AC-a has an E2E scenario, and it rides as an added assertion inside `CASE-8e3d236b21a9` — an
approved GH-1 AC4 case about the nav link returning a clean list. AC-b and AC-c have no E2E scenario at
all. Two repo rules pull against each other here: `CLAUDE.md` directs component-first and forbids
duplicating component coverage in E2E, while mixing a GH-3 race assertion into another AC's approved case
muddies what that case attests. Left as it is because the assertion is what resolves this spec's open
question and the racing sequence is already in that scenario; flagged for the merge gate to accept or
send to `/qa-cases` as a case-set change.

### AC-d's revised expectation

`CASE-93514dfd0070` (double-clicking Next) was approved expecting `?page=2`. It only ever passed
because the footer defect `FIND-5232572f9eda` swallowed the second click — isolated by removing that
fix alone, which returns the case to `?page=2`. Two clicks mean two pages, so the case now expects
`?page=3`, confirmed by a named human at a scope-drift pause. `.solvo/testplans/GH-1-cases.md` still
records the old expectation and needs a case-set revision through `/qa-cases`; that artifact is not
edited from a dev cycle.

## Anti-regression plan

- `cd client && bun run test` in full, not a targeted file run. All 229 must stay green, and
  `TicketsPage.test.tsx`'s exact-params assertion stays an exact match — it is GH-1's AC9 control and
  must not be loosened to `objectContaining`. (Round 3 noted the old line reference here had drifted by
  about 15 lines; it is quoted by name now rather than by line, since the tests around it keep moving.)
- `bun run test:e2e` in full. Two scenarios currently fail; `CASE-8e3d236b21a9` must go green here.
  `CASE-e51a15eb56e6` is the sibling defect `FIND-5232572f9eda` (the footer unmount), which was brought
  into this cycle at a scope-drift pause and must therefore also go green rather than being reported red.
- The suite runs at `workers: 1`; do not raise it to make anything pass.

**Result.** Client suite 247/247, up from the 229 baseline.

E2E across seven full runs. The mechanism changed twice during this cycle, so the runs are grouped by
what they actually measured — an earlier revision of this section reported "three full runs: 81/82,
82/82, 82/82" without saying that all three predate the delivered code, which is what round 3 raised as
B-R3-4:

| Mechanism | Runs | Result |
|---|---|---|
| pending-write queue — **deleted, measures nothing shipped** | 3 | 81/82, 82/82, 82/82 |
| live location, before the round-4 filter-delta fix | 2 | 82/82, 82/82 |
| live location + filter deltas — **the delivered code** | 2 | 82/82 (4.8m), 82/82 (2.7m) |

The single failure across all seven was `CASE-f8fac94b30ab` ("should undo a filter change on Back"), on
the first run only, under a mechanism no longer in the tree. It passes 5/5 in isolation and 13/13 with
its own spec file — the suite's known shared-database ordering flakiness, not a regression from this
change.

The first of the two delivered-code runs had a doc comment in
`client/src/lib/use-latest-ticket-list-params.ts` edited while it was in flight, so Vite reloaded that
module mid-suite. Comment-only, no behaviour, and it passed — but the second run exists because a number
measured against a tree that changed underneath it is the exact defect B-R3-4 named, and recording it
without re-running would have repeated it.

`OPENAI_API_KEY` is unset on this machine in every run, so `auto-resolve-ticket` throws
`AI_LoadAPIKeyError` and no seeded ticket transitions to `resolved`. That is unchanged from GH-1's runs
and is recorded rather than treated as passing.

`checks.e2e` in the state file records all of this.

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
