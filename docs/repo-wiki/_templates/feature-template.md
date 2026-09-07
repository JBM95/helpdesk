---
tags: [<domain-slug>]
---

# Feature: <Name>

> **Slug**: `<slug>`
> **Owning domain**: `<domain-slug>`
> **Last refreshed**: <YYYY-MM-DD by feature-cataloger>

## What the user can do

<1-2 sentences in plain English. "A user with role X can ..." >

## User entry points

- URL: `/path`
- Menu item: `<label>` in `<area>`
- Deep links: `<list>`

## Frontend

| File | Role |
|------|------|
| `<component>.ts` | Container |
| `<component>.html` | Template |
| `<component>.scss` | Styles |
| `<service>.service.ts` | HTTP / state |

## API endpoints touched

| METHOD | Route | Controller.Action |
|--------|-------|-------------------|
|        |       |                   |

## Data entities involved

- `<Entity>` (table `<table>`)
- Stored procs: `<list>`

## Permissions / auth

- Frontend guards: `<list>`
- Backend `[Authorize]`: `<list>`
- Custom policies: `<list>`

## Dependencies on other features

- <feature-slug>: <why>

## Legacy indicators

- <list any TODO/FIXME/HACK/jQuery/AngularJS leftovers found, file:line>

## Test coverage

- Unit: `<file paths>`
- Integration: `<file paths>`
- E2E: `<file paths>`

## Open questions

- <anything unclear from code>
