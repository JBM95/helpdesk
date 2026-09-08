---
tags: [integrations, architecture, server]
---

# Integrations — Helpdesk

> Mapped by `explore-10-integration-mapper` via `/setup-05-explore server` on 2026-09-08.
> **Scope:** `server/` only. Every external touchpoint — anything this process calls out to, or receives from, that is not its own frontend.
> **Nothing was called.** Every claim is read from source, with `file:line` citations. Env vars appear by **name only**, never by value.

## Summary

**5 external integrations** — OpenAI, SendGrid (inbound), SendGrid (outbound), PostgreSQL, Sentry — plus Better Auth, which is a local library rather than a service and is recorded here only for completeness.

| Direction | Integrations |
|-----------|--------------|
| Inbound | SendGrid Inbound Parse webhook |
| Outbound | OpenAI, SendGrid Mail, Sentry |
| Both | PostgreSQL (Prisma for application data, pg-boss for jobs — two clients, one database) |

## Inbound

### SendGrid Inbound Parse webhook

Receives support email and turns it into a ticket or a reply.

- **Protocol:** HTTP POST, `multipart/form-data` in SendGrid's Inbound Parse format
- **Library:** `@sendgrid/inbound-mail-parser@8.0.0`
- **Endpoint:** `POST /api/webhooks/inbound-email` — `server/src/routes/webhooks.ts:28-90`
- **Auth:** a shared secret, `WEBHOOK_SECRET`, checked against the `x-webhook-secret` header or a `secret` query param — `server/src/middleware/require-webhook-secret.ts:1-19`. **Not Better Auth**, so there is no `req.user` in this handler.
- **What arrives:** email metadata (to, from, subject, text, html) plus any attachments, which are parsed but not stored

**Handling:** parse sender name and address out of the `From` field (`:18-24`), strip `Re:`/`Fwd:` from the subject (`:14-16`), look for an existing `new`/`processing`/`open` ticket with the same sender and subject and append a customer reply if found (`:48-68`), otherwise create a ticket with status `new` assigned to `AI_AGENT_ID` (`:70-79`), then enqueue `classify-ticket` and `auto-resolve-ticket` (`:83-89`).

**Failure modes:** `WEBHOOK_SECRET` unset → 500, with a warning already logged at boot (`server/src/index.ts:81-83`); bad secret → 401; validation failure → 400; database failure → 500 via Express 5's automatic catch.

**Retry:** SendGrid retries on 5xx. There is no local retry.
**Idempotency:** duplicate detection by sender address plus subject, so a re-delivered email appends rather than creating a second ticket.
**Blast radius if down:** no new tickets enter the system, and the sender sees no error — delivery to SendGrid itself succeeded.

**Personal data received:** customer name, email address and message body, all persisted to `Ticket` and `Reply`.

## Outbound

### OpenAI, via the Vercel AI SDK

- **Protocol:** HTTPS to the OpenAI REST API
- **Libraries:** `@ai-sdk/openai@3.0.33`, `ai@6.0.100` · **Model:** `gpt-5-nano` · **Config:** `OPENAI_API_KEY`

| Call site | Purpose | Trigger | Personal data sent |
|-----------|---------|---------|--------------------|
| `lib/classify-ticket.ts:30-38` | Assign a category | `classify-ticket` job | subject, body |
| `lib/auto-resolve-ticket.ts:43-61` | Attempt resolution | `auto-resolve-ticket` job | subject, body, sender name, sender email, plus the knowledge base |
| `routes/replies.ts:97-108` | Summarize the thread | synchronous `POST .../summarize` | subject, body, every reply, agent names |
| `routes/replies.ts:131-141` | Polish a draft reply | synchronous `POST .../polish` | draft text, customer name, agent name |

**Knowledge base:** `server/knowledge-base.md` (151 lines), read once at module load (`auto-resolve-ticket.ts:12-15`). Support FAQs, refund policy, troubleshooting steps and escalation rules. The whole file goes into the system prompt on every auto-resolve attempt.

**Prompt shapes:** classify sends the valid category list as the system prompt and `Subject / Body` as the user prompt. Auto-resolve sends the knowledge base plus tone and escalation guidelines, and expects either a reply or the literal `ESCALATE`. Summarize asks for 2–4 sentences. Polish asks for clarity and tone while preserving meaning, injecting the customer and agent names.

**Timeout:** **none set at any of the four call sites.** A hung OpenAI request blocks a queue worker indefinitely, or hangs the Express handler on the two synchronous routes.

**Retry:** background jobs get pg-boss's 3 attempts with a 30s initial delay and exponential backoff (`classify-ticket.ts:21-23`, `auto-resolve-ticket.ts:27-29`). The synchronous routes get none.

**Failure handling:** classify captures to Sentry and rethrows so pg-boss retries (`:54-56`); an out-of-enum category is logged as a warning and the ticket simply stays uncategorized (`:42-47`). Auto-resolve captures to Sentry (`:63-65`) and transitions the ticket to `open` (`:67-72`) — so a GPT failure degrades to human handling rather than losing the ticket. Summarize and polish throw, Express 5 catches, the caller gets a 500, and nothing reaches Sentry.

**Idempotency:** the background jobs are safe to repeat. The synchronous calls are not deduplicated.

**Blast radius if down:** tickets stay in `new`, retry three times, then stop — and because the agent UI filters out `new` and `processing`, nobody sees them. Auto-resolve's fallback to `open` is what stops that being silent, but it only fires when the job runs at all. The two agent-facing AI features return 500; agents can still read and reply unaided.

**Cost:** unmetered, no ceiling and no circuit breaker, accepted per [[00-scope]].

### SendGrid Mail (outbound)

- **Protocol:** HTTPS to the SendGrid REST API · **Library:** `@sendgrid/mail@8.1.6`
- **Config:** `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (a verified sender)
- **Queue:** `send-email` — 3 attempts, 30s delay, exponential backoff · **Call site:** `lib/send-email.ts:21-42`
- **Triggers:** an auto-resolved ticket (`auto-resolve-ticket.ts:96-100`) and an agent reply (`routes/replies.ts:61-65`)
- **Sends:** a plain-text body always, HTML optionally, with subject `Re: {original subject}`

**Failure handling:** Sentry capture then rethrow, so pg-boss retries (`send-email.ts:36-39`). After the third failure the job is simply marked failed — **no alert, no fallback, no manual re-send path in the UI.**

**Undeliverable mail:** not handled in code. No bounce webhook is registered, so bounces and suppressions live only in SendGrid.

**Idempotency:** **not enforced.** Nothing keys a send to a `(ticketId, replyId)` pair, so a job re-enqueued or reprocessed after a worker crash sends the customer the same email twice.

**Blast radius if down:** the ticket may read `resolved` while the customer never received anything.

**Personal data sent:** customer email address and the reply body.

### Sentry

- **Protocol:** HTTPS to the Sentry ingest API · **Library:** `@sentry/node@10.42.0`
- **Config:** `SENTRY_DSN` (optional — the integration is off when empty, `lib/sentry.ts:6`), `SENTRY_ENVIRONMENT` (defaults to `development`)
- **Init:** `lib/sentry.ts:3-8`, imported first at `index.ts:2` · **Trace sample rate:** 100% (`sentry.ts:7`)
- **Express handler:** `Sentry.setupExpressErrorHandler(app)` at `index.ts:68`

**Manual captures:** `classify-ticket.ts:54-56`, `auto-resolve-ticket.ts:63-65` and `:102-104`, `send-email.ts:36-39`, `queue.ts:12`, `index.ts:104`.

**What is sent:** exception message, stack, context tags (queue name, ticket id where relevant) and Express request metadata.

**Request bodies are not filtered.** An error thrown after body parsing can carry customer names, addresses and message text to Sentry. No `beforeSend` scrubber is configured.

**Blast radius if down:** none operationally — the SDK buffers in memory and never blocks a request.

## PostgreSQL — two clients, one database

### Prisma (application data)

`@prisma/client@7.3.0` with `@prisma/adapter-pg@7.3.0`, config `DATABASE_URL`, singleton exported from `server/src/db.ts:1-7`. Six models and four enums — see [[07-data-model]].

No query timeout is set; the only limit is Prisma's 5s default transaction timeout. No retry at the Prisma layer; pooling is left to the underlying `pg` driver. Query errors throw and Express 5 turns them into a 500. Atomicity where it matters is explicit — e.g. `auto-resolve-ticket.ts:81-94` wraps the reply write and the status change in `$transaction`.

### pg-boss (job queue)

`pg-boss@12.13.0` against the **same** `DATABASE_URL` (`lib/queue.ts:8`), in its own auto-created `pgboss` schema. Three queues registered at `queue.ts:18-25`. Started before `app.listen()` inside `boot()` (`index.ts:86`) and stopped on `SIGTERM`/`SIGINT` with a 30s grace period (`queue.ts:29`). Errors go to Sentry and the console (`queue.ts:11-14`). If pg-boss cannot reach the database at startup, `boot()` fails and **the server does not start** (`index.ts:103-107`).

**Shared fate:** both clients use one connection string. There is no queue isolation and no read replica, which makes PostgreSQL the single highest-risk dependency here.

## Better Auth (local library, not a service)

`better-auth@1.4.18`, using the Prisma adapter against the same database (`lib/auth.ts:9-11`), mounted at `/api/auth/{*any}` (`index.ts:47-49`). Config: `BETTER_AUTH_SECRET` (required — missing throws at boot, `index.ts:18-20`), `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`. Email and password only, sign-up disabled (`auth.ts:13-15`), users seeded by `prisma/seed.ts`. Rate limited to 20 requests per 15 minutes, production only (`index.ts:35-42`).

**Nothing leaves the system.** Listed only because it shares the database. See [[auth]].

## Configuration matrix

Names only. `.env.example` documents every one of them — there are no undocumented integration variables.

| Integration | Env var(s) | Required | In `.env.example` |
|-------------|-----------|----------|-------------------|
| OpenAI | `OPENAI_API_KEY` | yes | yes (line 17) |
| SendGrid inbound | `WEBHOOK_SECRET` | yes | yes (line 15) |
| SendGrid outbound | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | yes | yes (lines 19-20) |
| PostgreSQL (both clients) | `DATABASE_URL` | yes | yes (line 8) |
| Sentry | `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | no | yes (lines 22-23) |
| Better Auth | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS` | first two | yes (lines 10-13) |

**When a variable is missing, the failure lands at different times.** `BETTER_AUTH_SECRET` throws at boot (`index.ts:18-20`) and `DATABASE_URL` fails on first connection — both loud. `OPENAI_API_KEY`, `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` have no boot check and fail only when a job runs or an endpoint is hit. `WEBHOOK_SECRET` warns at boot (`index.ts:81-83`) and 500s on the first webhook.

## Failure modes at a glance

| Integration | Retry | Timeout | Fallback | Idempotent |
|-------------|-------|---------|----------|------------|
| OpenAI (background) | 3, exponential, via pg-boss | none | auto-resolve moves the ticket to `open` | yes |
| OpenAI (synchronous) | none | none | none — 500 to caller | no |
| SendGrid outbound | 3, exponential, via pg-boss | none | none — fails silently | **no** |
| SendGrid inbound | SendGrid retries 5xx | none | none | yes |
| PostgreSQL (Prisma) | none | 5s transaction default only | none — 500 to caller | per query |
| PostgreSQL (pg-boss) | per queue | none | none — server will not start | per job |
| Sentry | SDK internal | SDK default | buffered locally | n/a |

Three things stand out and are worth carrying into [[tech-debt]] rather than leaving buried here:

1. **No timeout on any OpenAI call.** A hung request holds a queue worker or an Express handler open indefinitely.
2. **Outbound email is neither idempotent nor alerted.** A reprocessed job double-sends; three failures then go quiet while the ticket still reads `resolved`.
3. **Sentry can receive customer data.** Request bodies are unfiltered and there is no `beforeSend` scrubber.

None of these is in scope for current work; they are recorded so they are not rediscovered.

## Personal-data boundary

Which integrations move personal data off this system, and under what authentication.

| Integration | Personal data sent | Auth | In transit | Retention |
|-------------|--------------------|------|------------|-----------|
| OpenAI | customer name, email, subject, body; agent name | `OPENAI_API_KEY` bearer token | HTTPS | per OpenAI's policy — zero-retention mode is **not** enabled in code |
| SendGrid outbound | customer email address, reply body | `SENDGRID_API_KEY` bearer token | HTTPS | SendGrid delivery logs |
| Sentry | possibly, via unfiltered request bodies and error context | `SENTRY_DSN` (carries its own token) | HTTPS | per Sentry project settings, not configured in code |

**Does not leave the trust boundary:** PostgreSQL, Better Auth, and the SendGrid inbound webhook (which receives personal data but forwards none).

Per [[00-vision]] there are no real users and no real personal data at current maturity. The table describes the boundary **as built**, not a compliance finding. If real traffic were ever served, OpenAI's data handling, Sentry's body capture and SendGrid's delivery logs would each need a decision.

## Blast radius by dependency

| Down | Immediate impact | Mitigation in place | Recovery |
|------|------------------|---------------------|----------|
| OpenAI | jobs retry 3× then stop; tickets stuck in `new` and invisible to agents; the two AI endpoints 500 | auto-resolve degrades a ticket to `open`; agents can work unaided | pg-boss reprocesses on recovery; tickets left in `new` need manual attention |
| SendGrid outbound | replies never sent after 3 retries | none | manual re-send, for which there is no UI |
| SendGrid inbound | no new tickets; senders see no error | none | SendGrid's own retries drain once recovered |
| PostgreSQL | server fails to start, or crashes | graceful shutdown on pg-boss disconnect | restart after the database returns |
| Sentry | errors go unrecorded | SDK buffers in memory | flushes on recovery |

**Highest risk:** PostgreSQL — one connection string serves both Prisma and pg-boss, with no isolation or failover.
**Most silent:** outbound email — a customer waits for a reply that no longer exists anywhere in the system.

## Related

- [[05-api-surface]] — the webhook endpoint and the two synchronous AI routes, with guards
- [[07-data-model]] — the `pgboss` schema alongside Prisma's, and what the AI writes
- [[tickets]] — the domain every AI and email integration serves
- [[auth]] — Better Auth's place in the same database
- [[12-build-deploy]] — how these variables are supplied per environment
- [[dependencies]] — versions and advisory status for each SDK
- [[tech-debt]] — the three gaps called out above
- [[00-vision]] — maturity, and why the data boundary is descriptive
- [[00-scope]] — the accepted absence of a cost ceiling
- [[recon]] — stack fingerprint
