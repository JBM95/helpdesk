---
tags: [tickets, feature]
---

# Feature: View replies thread

> **Slug** `view-replies-thread` · **Domain** [[tickets]] · **Personas** Support Agent, Admin
> Cataloged 2026-09-07 (client scope).

## What the user does

Reads the conversation on a ticket in chronological order. Each card shows the sender, a sender-type label, a timestamp and the body.

## Entry

Ticket detail page, between the AI summary and the reply form.

## Components

`components/ReplyThread.tsx` (110 LOC).

## API

`GET /api/tickets/:id/replies` at `:29`, key `["replies", ticketId]`. Reply shape: `{ id, body, bodyHtml | null, senderType, user | null, createdAt }`. Invalidated by [[add-reply]].

## UI states

| State | Rendering |
|-------|-----------|
| Loading | 2 skeleton cards (`:36-42`) |
| Error | `ErrorAlert` "Failed to load replies" (`:45-47`) |
| Empty | "No replies yet", muted (`:49-51`) |
| Populated | cards in chronological order (`:54-108`) |

## Card styling

Agent replies get a primary border and a Bot icon; sender replies get a default border and a User icon. Agent replies display `user.name`, falling back to "Agent" when `user` is null — which is how **AI-authored replies appear**, since auto-resolution creates a reply with `userId: null`. So a thread can show an "Agent" reply that no person wrote, and the UI does not distinguish the two.

## Sanitisation

`DOMPurify.sanitize()` on `bodyHtml` before `dangerouslySetInnerHTML` (`:93-98`); plain-text fallback with `whitespace-pre-line` (`:100-102`). Reply bodies can originate from inbound email, so this is untrusted content.

## Tests

`components/ReplyThread.test.tsx` (160 LOC) — covers loading, empty, error, agent vs customer rendering, the "Agent" fallback when `user` is null, and multiple replies.
