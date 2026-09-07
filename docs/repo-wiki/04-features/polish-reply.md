---
tags: [tickets, ai, feature]
---

# Feature: Polish reply with AI

> **Slug** `polish-reply` · **Domain** [[tickets]] · **Personas** Support Agent, Admin
> Cataloged 2026-09-07 (client scope).

## What the user does

Types a rough draft, clicks "Polish", and the AI's rewrite replaces the textarea contents. The agent can then edit further and send. This is the "edit a suggested reply rather than write from scratch" workflow [[00-vision]] describes.

## Entry

Ticket detail page, reply form — the same form as [[add-reply]].

## Components

`components/ReplyForm.tsx` (93 LOC).

## API

`POST /api/tickets/:id/replies/polish` at `:50`, body `{ body }`, returns `{ body: string }`. No cache interaction.

On success, `setValue("body", polished, { shouldValidate: true })` (`:56`) writes the result into React Hook Form state and re-validates.

## UI states

| State | Rendering |
|-------|-----------|
| Ready | enabled once the textarea is non-empty |
| Disabled | while empty, or while either mutation runs (`:82`) |
| Loading | disabled, "Polishing…" (`:85`) |
| Error | `ErrorAlert` above the form (`:65-67`) — **the draft is preserved** |
| Success | textarea replaced with the polished text |

## Behaviour worth noting

The polished text **overwrites the draft in place** with no undo and no side-by-side comparison. The original wording is not recoverable through the UI. That is a deliberate simplicity, but it means a polish the agent dislikes costs them their draft.

Preserving the draft on *failure* is explicitly tested, so the failure path was thought about.

## Cost note

A GPT call on a button with no throttle, same as [[generate-ticket-summary]].

## Tests

`components/ReplyForm.test.tsx` covers the request, replacement on success, the loading state, mutual button disabling, the error path, draft preservation on failure, and sending a polished reply afterwards.
