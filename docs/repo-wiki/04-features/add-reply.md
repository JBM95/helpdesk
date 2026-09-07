---
tags: [tickets, feature]
---

# Feature: Add reply to ticket

> **Slug** `add-reply` · **Domain** [[tickets]] · **Personas** Support Agent, Admin
> Cataloged 2026-09-07 (client scope).

## What the user does

Types a reply and sends it. There is no draft state — the reply posts immediately, the textarea clears, and the thread refreshes.

**This reaches the sender.** Server-side, replies are emailed out via SendGrid ([[12-build-deploy]]), so sending is an outward-facing action, not an internal note.

## Entry

Ticket detail page, "Add a Reply" section below the thread.

## Components

`components/ReplyForm.tsx` (93 LOC) — shared with [[polish-reply]].

## API

`POST /api/tickets/:id/replies` at `:36`, body `{ body }`. Invalidates `["replies", ticketId]` on success (`:43`), which refreshes [[view-replies-thread]].

## Validation

`createReplySchema` from `core/schemas/replies.ts`, via `zodResolver` (`:29`). `body` required and non-empty. The same schema is used server-side at `routes/replies.ts:42` per [[08-standards/observed]] — client validation here is a UX affordance, not the control.

## UI states

| State | Rendering |
|-------|-----------|
| Ready | textarea + both buttons enabled once non-empty |
| Validation error | `ErrorMessage` below the textarea (`:75`) |
| Sending | both buttons disabled, "Sending…" (`:82,87-88`) |
| Error | `ErrorAlert` above the form (`:62-64`) |
| Success | `reset()` (`:44`), thread refreshes |

Both buttons disable while *either* mutation runs, so a reply cannot be sent mid-polish and vice versa.

## Tests

`components/ReplyForm.test.tsx` (256 LOC) — covers whitespace-only rejection, the request, clearing on success, loading, Axios and non-Axios errors, and the absence of an alert before first submit.
