---
tags: [vision]
---

# Helpdesk — Vision

> Captured by `/setup-01-vision` on 2026-09-07. Re-run with `/setup-01-vision refine` to update.

## What Helpdesk IS

Helpdesk is a portfolio project that demonstrates what a support desk looks like when AI handles the first pass instead of a person. Inbound support email — modelled on a student-facing course support desk — arrives via a webhook, becomes a ticket, and is classified and attempted for resolution by GPT before any agent sees it. When the AI can answer, it writes the reply, emails the sender, and marks the ticket resolved with no human in the loop; the only route to a person is the model returning `ESCALATE`, which flips the ticket to `open` and puts it in the agent queue. It stands in for a shared email inbox at a single organisation running a single instance.

The bet being demonstrated is unattended resolution, not agent assistance. Classification, summaries and suggested replies exist to serve the tickets the AI *couldn't* close, not to gate the ones it could.

**Industries / customer types served:**

- Education support desks — a course or student support inbox (general questions, technical questions, refund requests). This is the **demo scenario**, not a permanent domain restriction: nothing in the vision forbids pointing the same machinery at another support domain.
- Single-organisation, single-instance internal support teams

**Current maturity:** no paying customer exists and no real users are served — seeded accounts and synthetic tickets only, no real PII, no compliance obligation, no uptime expectation. This describes where the project *is*, not a boundary on what it may become. Security, validation and auth are held to a production standard as craft, not to satisfy an external requirement.

## What Helpdesk IS NOT

The following are explicit non-goals. Anyone proposing work in these areas should be redirected.

- **Not a sender-facing portal**: students never get a login or a self-service ticket view. Email is their only surface, in and out. There is no "track your ticket" page and no plan for one.
- **Not an account-provisioning system**: sign-up is disabled by design. The admin is seeded via `prisma/seed.ts` and creates agent accounts; there is no self-service registration for anyone.
- **Not a refunds or payments system**: `Refund Request` is a classification and routing outcome only. There is no payment-provider integration and money never moves through this system. An agent handling a refund does the actual refund elsewhere by hand.
- **Not a student record system**: the schema holds `User`, `Session`, `Account`, `Ticket`, `Reply` and `Verification` — nothing else. No enrolments, courses, grades, or student profiles. A ticket's sender is an email address, not a modelled person.
- **Not multi-tenant**: one organisation, one instance, settled. No tenant isolation, no per-tenant knowledge base or configuration, no per-customer branding. Work proposing a tenant dimension is out of scope, not deferred.

Deliberately **not** listed as non-goals — these are genuinely undecided and `00-scope.md` must make an explicit call on each: non-email channels (chat / phone / SMS / web form), and a knowledge-base authoring UI.

## Personas

### Support Agent

- **What they do**: Works the open ticket queue — the tickets the AI escalated rather than resolved. Opens the list filtered to `open`, works down it, reads the AI summary, edits the suggested reply rather than writing from scratch, and resolves. Never sees `new` or `processing` tickets; those are system-managed and hidden from the UI by design.
- **Frequency**: Several times a day.
- **Critical needs**:
  - A queue that only contains work that actually needs a human
  - An AI summary they can trust enough to skip reading the full thread
  - A suggested reply that is a usable starting point, editable before it sends
- **Friction points**:
  - Volume of repetitive tickets — hundreds of near-identical questions drown out the ones needing real thought. This is the friction the project exists to remove.

### Admin

- **What they do**: Deployed with the system rather than invited into it. Manages the agent roster — creates, edits and removes agent accounts and controls roles. Retains everything an agent can do on tickets.
- **Frequency**: Rarely — onboarding and offboarding only, not part of daily ticket work.
- **Critical needs**:
  - Create and remove agent accounts without a developer
  - Role control (`admin` vs `agent`) enforced on both the API and the UI
- **Friction points**:
  - Not captured in this pass. Worth asking on a `refine` run.

### Student Sender

- **What they do**: Emails the support address with a question and receives a reply. Never logs in, never sees a ticket, and does not know whether a person or a model answered them. Their reply may be entirely AI-authored and sent unattended. Every ticket in the system originates here.
- **Frequency**: Episodic — once per problem, not on a routine.
- **Critical needs**:
  - A fast, correct answer to a routine question
  - No account, no portal, no process to learn — replying to email is the whole interface
- **Friction points**:
  - Slow responses under agent load
  - Impersonal, templated replies — recognisably canned, which is the quality half of the volume problem

## Change log

| Date | Author | Change |
|------|--------|--------|
| 2026-09-07 | setup-01-vision | Initial capture |
| 2026-09-07 | setup-01-vision | Author review: single-tenancy promoted to a settled boundary; "not production" demoted from boundary to current-maturity note; education marked as demo scenario, not a domain restriction; multi-tenancy removed from the scope-deferred list |
