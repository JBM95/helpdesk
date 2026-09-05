---
tags: [<domain-slug>]
---

# Domain: <Name>

> **Slug**: `<slug>`
> **Status**: active | maintenance | deprecated
> **Last refreshed**: <YYYY-MM-DD by domain-mapper>

## Business purpose

<1-3 sentences describing what this part of the system does for users. No code references here.>

## Code locations

- Backend: `<path>` (project: `<csproj name>`)
- Frontend: `<path>` (feature module: `<module-name>`)
- Data: schema `<schema>`, primary tables `<list>`

## API surface

| METHOD | Route | Controller.Action | Notes |
|--------|-------|-------------------|-------|
|        |       |                   |       |

## Frontend surface

| Route | Component | Lazy-loaded? | Guards |
|-------|-----------|--------------|--------|
|       |           |              |        |

## Data ownership

| Table | Entity | Owning DbContext | Notes |
|-------|--------|------------------|-------|
|       |        |                  |       |

## Dependencies

**Inbound** (other domains that call into this one):
- `<other-domain>` — <how/why>

**Outbound** (other domains this one depends on):
- `<other-domain>` — <how/why>

## Maturity signals

- Recent commit activity: <high/medium/low>
- Test coverage ratio: <number>
- Legacy artefacts present: <list any R2/R3 findings>

## Open questions

- <Anything you couldn't determine from code alone — flag for human follow-up>
