---
tags: [tickets, support]
---

# Domain: Tickets

> **Slug**: `tickets`
> **Status**: active
> **Last refreshed**: 2026-09-08 by `explore-05-domain-mapper` (full-stack scope; was client-only before)

## Business purpose

Agents work the queue of tickets the AI could not resolve. The list view filters by status, category and free-text search, sorts by any column and paginates. The detail view shows the ticket body, the reply thread, an on-demand AI summary, and inline controls for status, category and assignment. Agents write replies, optionally asking the AI to polish a draft first.

Tickets arrive by inbound email webhook, are classified and auto-resolved by AI workers, and escalate to agents when the AI returns `ESCALATE`. Outbound replies are sent by email via SendGrid.

## Code locations

**Backend**
- Routes: `server/src/routes/tickets.ts`, `replies.ts`, `webhooks.ts`, `agents.ts`
- Workers: `server/src/lib/classify-ticket.ts`, `auto-resolve-ticket.ts`, `send-email.ts`
- Queue: `server/src/lib/queue.ts` — pg-boss setup, registers all three workers

**Frontend**
- Pages: `client/src/pages/TicketsPage.tsx`, `TicketsFilters.tsx`, `TicketsTable.tsx`, `TicketDetailPage.tsx`
- Components: `TicketDetail.tsx`, `TicketSummary.tsx`, `UpdateTicket.tsx`, `ReplyForm.tsx`, `ReplyThread.tsx`, `StatusBadge.tsx`, `TicketDetailSkeleton.tsx`
- Tests: `TicketsPage.test.tsx`, `TicketDetailPage.test.tsx`, `TicketDetail.test.tsx`, `TicketSummary.test.tsx`, `ReplyForm.test.tsx`, `ReplyThread.test.tsx`

**Core (shared vocabulary)**
- `core/constants/ticket.ts`, `ticket-status.ts`, `ticket-category.ts`, `sender-type.ts`, `ai-agent.ts`
- `core/schemas/tickets.ts` — `inboundEmailSchema`, `ticketListQuerySchema`, `updateTicketSchema`
- `core/schemas/replies.ts` — `createReplySchema`, `polishReplySchema`

**Data ownership (Prisma)**
- `Ticket` (`server/prisma/schema.prisma:91-107`), `Reply` (`:109-121`)
- Enums `TicketStatus` (`:21-27`), `TicketCategory` (`:34-38`), `SenderType` (`:29-32`)

**Test coverage**
- Component: 6 of 11 components have a direct test. `TicketsFilters`, `TicketsTable`, `UpdateTicket`, `StatusBadge`, `TicketDetailSkeleton` have none; the first two are exercised through `TicketsPage.test.tsx`.
- E2E: `e2e/tests/tickets.spec.ts`, `ticket-detail.spec.ts`, `webhook-inbound-email.spec.ts` — webhook to agent reply.

## Entry points

| Route | Component | Guard |
|-------|-----------|-------|
| `/tickets` | `TicketsPage` | `ProtectedRoute` |
| `/tickets/:id` | `TicketDetailPage` | `ProtectedRoute` |

Nav link at `client/src/components/Layout.tsx:52-55`.

| Method | Route | Handler | Auth | Purpose |
|--------|-------|---------|------|---------|
| GET | `/api/tickets/stats` | `tickets.ts:20-32` | `requireAuth` | Dashboard stats via stored function |
| GET | `/api/tickets/stats/daily-volume` | `tickets.ts:34-61` | `requireAuth` | Rolling 30-day chart data |
| GET | `/api/tickets` | `tickets.ts:63-107` | `requireAuth` | Paginated, filtered, sorted list |
| GET | `/api/tickets/:id` | `tickets.ts:109-129` | `requireAuth` | Ticket detail |
| PATCH | `/api/tickets/:id` | `tickets.ts:131-168` | `requireAuth` | Update status, category, assignee |
| GET | `/api/tickets/:ticketId/replies` | `replies.ts:13-33` | `requireAuth` | Reply thread |
| POST | `/api/tickets/:ticketId/replies` | `replies.ts:35-68` | `requireAuth` | Agent reply; enqueues email |
| POST | `/api/tickets/:ticketId/replies/summarize` | `replies.ts:70-110` | `requireAuth` | AI summary, no DB write |
| POST | `/api/tickets/:ticketId/replies/polish` | `replies.ts:112-144` | `requireAuth` | AI polishes a draft, no DB write |
| GET | `/api/agents` | `agents.ts:8-16` | `requireAuth` | Assignment dropdown source |
| POST | `/api/webhooks/inbound-email` | `webhooks.ts:28-90` | `requireWebhookSecret` | Inbound email → ticket or reply |

Full detail in [[05-api-surface]].

Every route in this domain requires only `requireAuth` — **agents and admins have identical access to tickets.** Nothing in this domain is role-gated.

## Ticket lifecycle

1. **Inbound email** hits `/api/webhooks/inbound-email` in SendGrid's multipart format.
2. **Create or append** (`webhooks.ts:48-68`): an existing `new`/`processing`/`open` ticket from the same sender with a matching subject gets a `Reply` with `senderType: "customer"`; otherwise a new `Ticket` is created with status `new` and `assignedToId = AI_AGENT_ID`.
3. **Enqueue jobs** (`webhooks.ts:83-89`), both fire-and-forget:
   - `classify-ticket` — GPT assigns a category
   - `auto-resolve-ticket` — GPT attempts a resolution against `knowledge-base.md`; success sets `resolved` and writes an agent reply, `ESCALATE` sets `open`
4. **Agent workflow** — `new` and `processing` tickets never appear in the UI (`tickets.ts:72`). Agents see `open`, `resolved`, `closed`, and can assign, re-categorize, reply and close.
5. **Outbound email** — a reply enqueues `send-email`, whose worker calls SendGrid.

```
new → processing → open (escalated) or resolved (AI succeeded)
                        ↓
                     closed (agent closes)
```

## AI workers (pg-boss)

Registered at `queue.ts:18-25`, all with `retryLimit: 3`, `retryDelay: 30`, `retryBackoff: true`.

**`classify-ticket`** (`classify-ticket.ts:19-60`) — `gpt-5-nano`, in: subject and body, out: one of `ticketCategories`, validated at `:42`. On success updates `Ticket.category`; on failure logs a warning and the ticket stays uncategorized.

**`auto-resolve-ticket`** (`auto-resolve-ticket.ts:25-109`) — `gpt-5-nano`, in: subject, body, sender name and email, plus `knowledge-base.md` (loaded `:12-15`). Sets status `processing` before calling GPT (`:36-39`). On a usable answer: status `resolved`, a `Reply` from the AI, and a `send-email` job. On `ESCALATE`: status `open`.

**`send-email`** — sends the reply through SendGrid. See [[10-integrations]].

## Frontend state ownership

| Concern | Owner | Detail |
|---------|-------|--------|
| Filters | `TicketsPage.tsx:14` | `useState<TicketFilters>({})` — all fields optional, initially `undefined` |
| Sort | `TicketsTable.tsx:99-101` | `useState<SortingState>([{ id: "createdAt", desc: true }])` |
| Pagination | `TicketsTable.tsx:102-105` | `useState<PaginationState>({ pageIndex: 0, pageSize: 10 })` |

`TicketFilters` is declared and exported at `TicketsPage.tsx:7-11`:

```ts
export interface TicketFilters {
  status?: TicketStatus;
  category?: TicketCategory;
  search?: string;
}
```

### Filter control defaults

`TicketsFilters.tsx:13` declares `const ALL = "__all__"`. All three controls hold `undefined` in state and adapt at the display layer:

| Control | Displayed value | Written to state |
|---------|----------------|------------------|
| Search (`:28-33`) | `filters.search ?? ""` | `e.target.value \|\| undefined` — an emptied input becomes `undefined`, never `""` |
| Status (`:36-53`) | `filters.status ?? ALL` | `value === ALL ? undefined : value` |
| Category (`:55-70`) | `filters.category ?? ALL` | `value === ALL ? undefined : value` |

The `"__all__"` sentinel exists only because Radix `Select` cannot hold an empty value; it never reaches state or the network.

Status options map over `agentTicketStatuses` (`:47`), so only `open`, `resolved` and `closed` appear — `new` and `processing` are system-managed and deliberately absent. **Category options are hardcoded** at `:66-68` rather than mapping `ticketCategories`, unlike `UpdateTicket.tsx:86`. Recorded as [[tech-debt|TD-01]].

### Query keying

`TicketsTable.tsx:119`:

```ts
queryKey: ["tickets", sortBy, sortOrder, filters, pagination.pageIndex]
```

`pageSize` is absent from the key because it is a module constant and cannot vary at runtime. Request params (`:122-128`) spread `...filters`, so `undefined` fields are omitted from the query string entirely rather than sent empty. `page` goes out 1-based while state is 0-based.

The server validates the same shape via `ticketListQuerySchema` (`core/schemas/tickets.ts:31-39`) and caps `pageSize` at 100 — the one place the client's module constant is not the last word.

### Pagination reset

`TicketsTable.tsx:107-109`:

```ts
useEffect(() => {
  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
}, [filters]);
```

The dependency is the `filters` **object identity**, not its contents. `TicketsFilters` builds a fresh object on every change, so this fires on any filter interaction. Sorting resets the page separately inside `onSortingChange` (`:141-144`); sort state is never reset by a filter change.

## Dependencies

**Inbound**
- [[dashboard]] — reads `/api/tickets/stats` and `/api/tickets/stats/daily-volume`, no mutation coupling

**Outbound**
- [[auth]] — `requireAuth` on every ticket and reply route
- [[user-management]] — `GET /api/agents` supplies the assignment dropdown, consumed at `UpdateTicket.tsx:30`
- `core/constants/ticket*.ts`, `sender-type.ts`, `ai-agent.ts`; `core/schemas/tickets.ts`, `replies.ts`
- OpenAI via the Vercel AI SDK; SendGrid inbound parser and mail SDK; pg-boss; Prisma — see [[10-integrations]]
- DOMPurify, client-side, before `dangerouslySetInnerHTML`

## Open questions

- `UpdateTicket.tsx` renders no error UI for a failed `PATCH` — the mutation error is not surfaced. Whether that is deliberate is not determinable from the code.
- `/summarize` and `/polish` are GPT calls behind a button with no client throttle and no server rate limit (the auth limiter covers only `/api/auth/*`). Cost exposure is unbounded, accepted per [[00-scope]].
- Subject matching for threading is case-insensitive at comparison (`webhooks.ts:52`) but stores the normalized subject as-is (`:72`). Whether that asymmetry matters has not been tested.
- Resolved from the server side: `/api/agents` and `/api/users` read the same `User` table with different filters and projections. `/api/agents` excludes soft-deleted users and the AI agent and returns only id and name.
- Resolved from the server side: the stats endpoint calls a real stored function, `get_ticket_stats`, created by migration 10. See [[07-data-model]].

## Related

- [[dashboard]] — consumes two of this domain's endpoints
- [[user-management]] — provides `/api/agents`; this domain's assignments are nulled when a user is deleted
- [[05-api-surface]] — every endpoint with citations
- [[07-data-model]] — `Ticket`, `Reply` and their enums
- [[10-integrations]] — OpenAI, SendGrid, pg-boss
- [[06-frontend-map]] — full query-key and component inventory
- [[04-features/view-tickets-list]], [[04-features/view-ticket-detail]]
- [[tech-debt]] — TD-01 (hardcoded categories in the filter), TD-02 (hardcoded colors in `StatusBadge`)
