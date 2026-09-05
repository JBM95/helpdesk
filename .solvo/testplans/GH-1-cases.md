---
type: testplan
github: GH-1
tier: T2
tags: [tickets]
date: 2026-09-05
---

# GH-1 Test Cases — Preserve ticket list filters, sorting and pagination in the URL

Plan: [[GH-1-plan]] · Story: [[GH-1-spec]] · Domain: [[tickets]] · Feature: [[tickets-list]]

Generated from the plan approved at revision 2. **Tier T2**, so the classes below are the ones whose
predicate the ACs and the (provisional) blast radius meet — all six of them, per the plan. Cases are
deliberately over-generated within each class; pruning is the human gate's call, by id, through
`qa-scope curate`.

The **Result** column is `pending` and stays that way. This file is canonical for *scope*, not for
results — execution truth lives in the `QaRun` that `/qa-execute` writes to
`.solvo/evidence/qa/GH-1-run-<commit>.json`. Nothing projects outcomes back into this table.

**AC10** ("Add/update component tests covering URL initialization, state changes, pagination reset,
and invalid params") has no behaviour instances of its own and therefore no cases. It is a process AC
satisfied by the set below; `/qa-verify` should read it that way rather than looking for a behaviour
to prove.

## Counts

| AC | Cases | happy | boundary | negative | authz | concurrency | failure |
|---|---|---|---|---|---|---|---|
| AC1 | 12 | 6 | 3 | — | — | 2 | 1 |
| AC2 | 7 | 4 | 2 | — | — | 1 | — |
| AC3 | 9 | 3 | 2 | — | — | 3 | 1 |
| AC4 | 7 | 5 | — | — | 2 | — | — |
| AC5 | 7 | 3 | 2 | — | — | 1 | 1 |
| AC6 | 7 | 5 | 2 | — | — | — | — |
| AC7 | 14 | — | 1 | 12 | — | — | 1 |
| AC8 | 6 | 5 | 1 | — | — | — | — |
| AC9 | 5 | 4 | — | 1 | — | — | — |
| **total** | **74** | **35** | **13** | **13** | **2** | **7** | **4** |

## AC1 — Status, category and search filters are reflected in the URL

| ID | Class | Behaviour instance | Steps | Expected | Result |
|---|---|---|---|---|---|
| `CASE-e08e0e3c793c` | happy | selecting a status writes status to the URL | Mount the tickets list at /tickets<br>Select 'Open' in the status filter | The URL search string contains status=open and /api/tickets is called with status: "open" | pending |
| `CASE-5e855865f6b2` | happy | selecting a category writes category to the URL | Mount the tickets list at /tickets<br>Select 'Refund' in the category filter | The URL search string contains category=refund_request and /api/tickets is called with category: "refund_request" | pending |
| `CASE-337c883e0c29` | happy | typing a search term writes search to the URL | Mount the tickets list at /tickets<br>Type 'login' into the search input | The URL search string contains search=login and /api/tickets is called with search: "login" | pending |
| `CASE-f3e86fed5d68` | happy | all three filters set together appear together in the URL | Mount the tickets list at /tickets<br>Select a status, then a category, then type a search term | The URL carries all three params simultaneously and the request carries all three filters | pending |
| `CASE-3924bab2bec2` | happy | mounting at a URL with all three filter params initialises all three controls | Mount at /tickets?status=open&category=technical_question&search=login | The status select shows 'Open', the category select shows 'Technical', and the search input contains 'login' | pending |
| `CASE-27dd90575a06` | happy | mounting at a filtered URL sends those filters to the API | Mount at /tickets?status=resolved&category=general_question&search=vpn | The first /api/tickets call includes status, category and search from the URL — not the defaults | pending |
| `CASE-040ad9228689` | boundary | a single-character search term round-trips through the URL | Mount at /tickets<br>Type a single character 'a' into the search input | search=a appears in the URL and is sent to the API; the input still shows 'a' | pending |
| `CASE-655998d07a02` | boundary | a search term containing URL-reserved characters round-trips encoded | Mount at /tickets<br>Type 'a&b=c?d#e' into the search input<br>Read the URL, then read the search input back | The term is percent-encoded in the URL, decoded back into the input unchanged, and sent to the API as the original string | pending |
| `CASE-2ae124573efe` | boundary | a search term at maximum practical length round-trips | Mount at /tickets<br>Type a 300-character search term into the search input | The term round-trips through the URL and the page renders; no truncation that changes the sent value silently | pending |
| `CASE-e8fb8a4bf179` | concurrency | typing a search term rapidly leaves the URL matching the final value | Mount at /tickets<br>Type 'login' quickly, character by character | The URL ends on search=login and the last request sent carries 'login', not an intermediate prefix | pending |
| `CASE-b545d0a5c4bf` | concurrency | changing status then category before the first request settles keeps both | Mount at /tickets with a slow /api/tickets response<br>Select a status, then immediately select a category before the first response resolves | The URL carries both params and the settled list reflects both filters | pending |
| `CASE-2845362e6dfc` | failure | a filtered request that fails leaves the filter in the URL | Mount at /tickets?status=open<br>Make /api/tickets reject | ErrorAlert 'Failed to fetch tickets' renders and status=open remains in the URL so the user can correct or retry | pending |

## AC2 — Sort field and sort direction are reflected in the URL

| ID | Class | Behaviour instance | Steps | Expected | Result |
|---|---|---|---|---|---|
| `CASE-fabda9180a68` | happy | clicking a column header writes sortBy and sortOrder to the URL | Mount at /tickets<br>Click the Subject column header | The URL contains sortBy=subject and sortOrder=asc, and the request carries the same | pending |
| `CASE-4234ebc72492` | happy | clicking the same header twice flips sortOrder in the URL | Mount at /tickets<br>Click the Subject header twice | The URL moves from sortOrder=asc to sortOrder=desc and the request follows | pending |
| `CASE-12efbff9d879` | happy | mounting at a sort URL shows the matching sort indicator | Mount at /tickets?sortBy=subject&sortOrder=asc | The Subject header shows the ascending arrow; no other header shows a direction arrow | pending |
| `CASE-d901f3d998b8` | happy | mounting at a sort URL sends that sort to the API | Mount at /tickets?sortBy=senderName&sortOrder=asc | The first request carries sortBy: "senderName", sortOrder: "asc" instead of the createdAt/desc default | pending |
| `CASE-32e17db60aa6` | boundary | each sortable column round-trips through the URL | For each of subject, senderName, status, category, createdAt: mount at /tickets?sortBy=<column><br>Read the header indicator and the request params | Every column in core/schemas/tickets.ts sortableColumns is accepted from the URL and sent through | pending |
| `CASE-1d6a0684e1d0` | boundary | both sort directions round-trip through the URL | Mount at /tickets?sortBy=subject&sortOrder=asc, then at sortOrder=desc | Each mount shows the matching arrow and sends the matching sortOrder | pending |
| `CASE-33e9012af743` | concurrency | clicking two different headers before the first request settles leaves the URL on the second | Mount at /tickets with a slow response<br>Click the Subject header, then immediately click the Created header | The URL and the settled list both reflect sortBy=createdAt; the Subject sort does not win the race | pending |

## AC3 — Current page is reflected in the URL

| ID | Class | Behaviour instance | Steps | Expected | Result |
|---|---|---|---|---|---|
| `CASE-e83eec605a96` | happy | clicking Next writes the page to the URL | Mount at /tickets with a total of 50 tickets<br>Click Next page | The URL contains page=2 and the request carries page: 2 | pending |
| `CASE-adc92fc24569` | happy | mounting at a page URL requests that page | Mount at /tickets?page=2 with a total of 50 tickets | The first request carries page: 2 and the footer reads 'Page 2 of 5' with 'Showing 11-20 of 50 tickets' | pending |
| `CASE-875adb87792b` | happy | First, Previous and Last each update the URL page | Mount at /tickets?page=3 with a total of 50 tickets<br>Click Previous, then First, then Last | The URL page param tracks each control (2, then absent-or-1, then 5) and each request matches | pending |
| `CASE-752a41e3d870` | boundary | the last page is reachable from the URL and disables Next | Mount at /tickets?page=5 with a total of 50 tickets | Next and Last are disabled, Previous and First are enabled, footer reads 'Page 5 of 5' | pending |
| `CASE-095552a8995f` | boundary | a page beyond the last page renders without crashing | Mount at /tickets?page=99 with a total of 50 tickets | The page renders (empty body or clamped to the last page) — no crash, no unhandled error, no blank screen | pending |
| `CASE-9a9129bfb43d` | concurrency | the current page survives a re-render with unchanged filters | Mount at /tickets?page=2<br>Force a parent re-render without changing any filter value | The page stays 2 and no page: 1 request is issued — the filters-object identity does not reset pagination | pending |
| `CASE-33183e39dc55` | concurrency | the current page survives a background refetch | Mount at /tickets?page=2<br>Trigger a React Query refetch of the tickets query | The refetch requests page 2 and the URL still says page=2 | pending |
| `CASE-93514dfd0070` | concurrency | double-clicking Next advances exactly one page | Mount at /tickets with a total of 50 tickets<br>Double-click Next page | The URL lands on page=2, not page=3, and one page-2 request is settled | pending |
| `CASE-9be39e305430` | failure | a paged request that fails leaves the page in the URL | Mount at /tickets?page=2<br>Make /api/tickets reject | ErrorAlert renders and page=2 stays in the URL | pending |

## AC4 — Opening a ticket and returning to the Tickets page restores the previous list state

| ID | Class | Behaviour instance | Steps | Expected | Result |
|---|---|---|---|---|---|
| `CASE-e51a15eb56e6` | happy | opening a ticket and returning restores the list state | Log in and go to /tickets<br>Apply a status filter, sort by Subject, go to page 2<br>Open a ticket from the list<br>Return to the tickets list | The filter, sort and page are all restored exactly as they were left | pending |
| `CASE-8d69642c9b08` | happy | the list mounts from the URL alone with no in-memory carry-over | Mount the list at a fully-parameterised URL<br>Unmount it completely and remount at the same URL | The second mount produces identical controls and an identical request — no state is held outside the URL | pending |
| `CASE-20e7b0b98b08` | happy | the ticket detail back-link returns to the list URL including its params | Open a ticket from a filtered, sorted, paged list<br>Use the in-app navigation back to the tickets list | The destination URL carries the same search params the list was left on | pending |
| `CASE-f3c0d3dae2bb` | happy | reloading the browser on a parameterised list URL restores the same list | Log in, go to /tickets, apply a filter and go to page 2<br>Reload the browser | The same filter and page are shown after the reload | pending |
| `CASE-f4309d9553e2` | authz | deep-linking to a parameterised list URL while unauthenticated redirects to login | With no session, navigate directly to /tickets?status=open&page=2 | ProtectedRoute redirects to /login; the ticket list is never rendered and no /api/tickets call is made | pending |
| `CASE-b66a9cb01fd3` | authz | after logging in from a guarded deep link the list state is restored or explicitly lost | Navigate to /tickets?status=open&page=2 with no session<br>Log in at the redirect | Either the original parameterised URL is restored, or the user lands on the default list — whichever the implementation chooses must be deliberate and consistent, not intermittent | pending |
| `CASE-8e3d236b21a9` | happy | arriving at the list from the nav link produces a defined list state | Apply a filter and go to page 2 on /tickets<br>Navigate to another page (e.g. Home)<br>Click the Tickets link in the navigation | The destination is deliberate and repeatable — either the preserved parameterised URL or a clean /tickets. The story does not say which, so whichever is implemented must be consistent and stated; it must not vary by how the nav link is reached | pending |

## AC5 — Browser back/forward navigation restores the corresponding list state

| ID | Class | Behaviour instance | Steps | Expected | Result |
|---|---|---|---|---|---|
| `CASE-f8fac94b30ab` | happy | back after a filter change returns to the previous filter state | Go to /tickets<br>Apply a status filter<br>Press browser Back | The list returns to the unfiltered state and the URL loses the status param | pending |
| `CASE-8548791d29f3` | happy | back after a page change returns to the previous page | Go to /tickets with a total of 50 tickets<br>Click Next page<br>Press browser Back | The list returns to page 1 and the URL page param follows | pending |
| `CASE-4aa8b6f78dbf` | happy | forward after back re-applies the state | Apply a filter, press Back, then press Forward | The filter is re-applied and the URL matches the state it had before Back | pending |
| `CASE-a95f558f6ba0` | boundary | back through three successive states unwinds them in order | Apply a filter, then a sort, then go to page 2<br>Press Back three times | Each Back lands on the immediately preceding list state, ending at the default list | pending |
| `CASE-fe4d5dbbfc65` | boundary | back from the first list state leaves the tickets page rather than trapping the user | Navigate to /tickets from another page<br>Press Back without touching any control | The browser leaves /tickets for the previous page; the user is not held on the list by a replaced history entry | pending |
| `CASE-b45e016761f1` | concurrency | rapid back and forward leaves the rendered list agreeing with the URL | Build three list states<br>Press Back and Forward rapidly several times<br>Stop and compare the rendered controls, the rows and the URL | The rendered filter/sort/page controls and the row set all match the final URL | pending |
| `CASE-6e5a5e6f195f` | failure | navigating history while a request is in flight does not render the superseded result | Apply a filter with a slow /api/tickets response<br>Press Back before the response arrives | The settled list matches the URL after the Back, not the superseded in-flight request | pending |

## AC6 — Changing a filter or sort resets pagination to page 1

| ID | Class | Behaviour instance | Steps | Expected | Result |
|---|---|---|---|---|---|
| `CASE-54ddb84f8d5c` | happy | changing the status filter while on a later page resets to page 1 | Mount at /tickets?page=3 with a total of 50 tickets<br>Change the status filter | The request carries page: 1 and the URL no longer says page=3 | pending |
| `CASE-1f30bb0a8eee` | happy | changing the category filter while on a later page resets to page 1 | Mount at /tickets?page=3 with a total of 50 tickets<br>Change the category filter | The request carries page: 1 and the URL no longer says page=3 | pending |
| `CASE-1e9fb05ae79a` | happy | changing the search term while on a later page resets to page 1 | Mount at /tickets?page=3 with a total of 50 tickets<br>Type a search term | The request carries page: 1 and the URL no longer says page=3 | pending |
| `CASE-0947995d87db` | happy | changing the sort while on a later page resets to page 1 | Mount at /tickets?page=3&sortBy=createdAt with a total of 50 tickets<br>Click the Subject column header | The request carries sortBy: "subject" with page: 1 and the URL reflects both | pending |
| `CASE-187f6a80d1e3` | happy | the pagination reset is visible in the URL and not only in the request | Mount at /tickets?page=4<br>Change any filter<br>Read the URL | The URL either drops the page param or sets page=1 — it never keeps a stale page=4 while requesting page 1 | pending |
| `CASE-b7a0968876d3` | boundary | clearing a filter while on a later page also resets to page 1 | Mount at /tickets?status=open&page=3<br>Set the status filter back to 'All statuses' | The request carries page: 1 and the URL drops both status and page | pending |
| `CASE-222fa42cb560` | boundary | changing a filter while already on page 1 does not add a redundant history entry | Mount at /tickets<br>Change a filter<br>Press Back once | One Back returns to the unfiltered list — the reset does not push an extra indistinguishable entry | pending |

## AC7 — Unknown/invalid query-param values fall back safely to supported defaults rather than breaking the page

| ID | Class | Behaviour instance | Steps | Expected | Result |
|---|---|---|---|---|---|
| `CASE-94d5af5f9efe` | negative | an unsupported status value falls back to no status filter | Mount at /tickets?status=frozen | The list renders unfiltered, the status select shows 'All statuses', and no status param is sent to /api/tickets | pending |
| `CASE-4380d2a19b98` | negative | a real ticket status that agents cannot filter by falls back | Mount at /tickets?status=new | The value is treated as unsupported (it is in ticketStatuses but not agentTicketStatuses) and is not sent — the server would 400 and blank the page | pending |
| `CASE-8646466a3043` | negative | an unsupported category value falls back to no category filter | Mount at /tickets?category=billing | The list renders with no category filter and no category param is sent | pending |
| `CASE-0abb1d5dcdef` | negative | a rendered but unsortable column falls back to the default sort | Mount at /tickets?sortBy=senderEmail | The sort falls back to createdAt/desc and sortBy=senderEmail is never sent — it is a rendered column but absent from sortableColumns | pending |
| `CASE-5f5a79a6d058` | negative | an unsupported sort direction falls back to the default direction | Mount at /tickets?sortBy=subject&sortOrder=sideways | sortOrder falls back to desc; sortBy=subject is still honoured | pending |
| `CASE-b048b7aec830` | negative | a zero page value falls back to page 1 | Mount at /tickets?page=0 | The request carries page: 1 — the server's min(1) constraint is never reached | pending |
| `CASE-f712934f69ca` | negative | a negative page value falls back to page 1 | Mount at /tickets?page=-1 | The request carries page: 1 and the page renders | pending |
| `CASE-73f3dcc5a1d6` | negative | a non-numeric page value falls back to page 1 | Mount at /tickets?page=abc | The request carries page: 1 — no NaN reaches the query params | pending |
| `CASE-8bca3b4a2a3a` | negative | a fractional page value falls back to a valid integer page | Mount at /tickets?page=1.5 | An integer page is sent; the server's int() constraint is never reached | pending |
| `CASE-34f10743279c` | negative | duplicate values for one param resolve to a single supported value | Mount at /tickets?status=open&status=closed | Exactly one supported status is applied and sent; the page does not send a comma-joined or array value the server would reject | pending |
| `CASE-167bc56de8f8` | negative | an unrecognised query param does not break the page | Mount at /tickets?assignee=me&status=open | The status filter applies, the unknown param is ignored or preserved harmlessly, and nothing extra is sent to /api/tickets | pending |
| `CASE-7f01d782c90b` | negative | a malformed query string renders the default list | Mount at /tickets?%%%&=&status | The default list renders with default sort and page; no crash and no error alert | pending |
| `CASE-4cf6ae359e0d` | failure | every invalid combination still produces a successful API request | Mount at /tickets?status=frozen&category=billing&sortBy=senderEmail&sortOrder=sideways&page=abc<br>Inspect the outgoing request params | The request contains only schema-valid values, so ticketListQuerySchema cannot 400 and 'Failed to fetch tickets' is not shown | pending |
| `CASE-c27e798cbe1d` | boundary | a page far beyond the result set renders without crashing | Mount at /tickets?page=999999 with a total of 50 tickets | The page renders with an empty body or clamps to the last page; the footer text does not show a nonsensical range | pending |

## AC8 — Empty/default values are omitted where practical so URLs remain clean

| ID | Class | Behaviour instance | Steps | Expected | Result |
|---|---|---|---|---|---|
| `CASE-c676aa4d6c2f` | happy | the default list state produces no search params | Mount at /tickets and change nothing | The URL search string stays empty — no sortBy, sortOrder or page appears just because defaults exist | pending |
| `CASE-f4b2c0c285fa` | happy | clearing a filter removes its param rather than leaving it empty | Mount at /tickets?status=open<br>Set the status filter back to 'All statuses' | The URL drops status entirely — it does not read status= or status=__all__ | pending |
| `CASE-70b9f471d1ea` | happy | emptying the search input removes the search param | Mount at /tickets?search=login<br>Clear the search input | The URL drops search entirely and no empty search string is sent to the API | pending |
| `CASE-76b3900894f2` | happy | the default sort is absent from the URL | Mount at /tickets<br>Sort by Subject, then sort back to Created descending | Once the state matches the createdAt/desc default, the sort params are absent from the URL | pending |
| `CASE-c9644e6ae50c` | happy | page 1 is absent from the URL | Mount at /tickets with a total of 50 tickets<br>Click Next, then Previous | Back on the first page the URL has no page param rather than page=1 | pending |
| `CASE-2ce11011a545` | boundary | returning every control to its default leaves the URL clean again | Apply a status, a category, a search term, a sort and a page<br>Return every control to its default | The URL search string is empty again — no residual params from the journey | pending |

## AC9 — Existing /api/tickets request/response behavior remains unchanged

| ID | Class | Behaviour instance | Steps | Expected | Result |
|---|---|---|---|---|---|
| `CASE-980cc3885141` | happy | the default request params are unchanged | Mount the tickets list with no URL params<br>Assert the axios call with an exact params object | axios.get is called with { sortBy: "createdAt", sortOrder: "desc", page: 1, pageSize: 10 } — the existing exact-match test passes unmodified, not loosened to objectContaining | pending |
| `CASE-08476f34d947` | negative | pageSize stays fixed and is not made URL-controllable | Mount at /tickets?pageSize=100 | The request still sends pageSize: 10 — page size is out of scope for this story | pending |
| `CASE-a6d60258881b` | happy | no new query param is introduced on the API call | Exercise every filter, sort and page control<br>Collect the params of every outgoing request | Every request's params are a subset of the keys ticketListQuerySchema already accepts | pending |
| `CASE-071ab822b94e` | happy | the server and shared schema are untouched | Inspect the diff for server/** and core/schemas/tickets.ts | Neither is modified; the change is confined to the client. There is no server test suite in this repo, so diff inspection is the control | pending |
| `CASE-47298dac3ca4` | happy | the response shape is consumed unchanged | Return the existing { tickets, total, page, pageSize } shape<br>Read the table body and the pagination footer | Rows, total count and footer text render exactly as before the change | pending |

## Exploratory charters (from the approved plan)

Both are gating obligations at T2, closed only by a human `qa-result perform` — never by the absence
of a finding.

| Charter | AC | Text |
|---|---|---|
| `CH-be78fe0e3063` | AC7 | CHARTER: explore the tickets list URL state with hand-edited and shared/bookmarked URLs to discover states the page cannot recover from |
| `CH-5e072067c341` | AC5 | CHARTER: explore browser history navigation on the tickets list with rapid back/forward and in-flight requests to discover stale list renders that disagree with the URL |

## Execution split

Component (Vitest + RTL, `cd client && bun run test`) carries everything except the cases that need a
real browser: `CASE-e51a15eb56e6`, `CASE-f3c0d3dae2bb`, `CASE-f4309d9553e2`, `CASE-b66a9cb01fd3`,
`CASE-afaeaa6a68a1` and the whole of AC5 — real Back/Forward, a real reload and a real
`ProtectedRoute` redirect. Those go to Playwright (`bun run test:e2e`).

`CASE-071ab822b94e` is proven by diff inspection, not by a runner: this repo has no server test
suite, which is why `quality.tests.backend` stays an `n/a:` marker.
