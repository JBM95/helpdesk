---
tags: [ui, feature]
---

# Feature: Toggle theme

> **Slug** `toggle-theme` · **Domain** — cross-cutting UI concern, not a business domain · **Personas** Support Agent, Admin
> Cataloged 2026-09-07 (client scope).

## What the user does

Clicks the sun/moon icon in the nav bar to switch between light and dark.

## Entry

Nav bar (`Layout.tsx:64-74`), consuming `useTheme()` from `lib/theme.tsx`.

## Components

`lib/theme.tsx` (44 LOC) — context provider, mounted in `main.tsx:23`. Default `"dark"`; persisted to `localStorage` under `helpdesk-theme`.

## API

None. Entirely client-side.

## Implementation

The effect at `theme.tsx:21-29` adds or removes the `dark` class on `document.documentElement` and writes the preference. Tailwind 4 picks it up through `@custom-variant dark (&:is(.dark *))` (`index.css:5`). This is the one legitimate non-fetching `useEffect` + `useState` pair in the client — noted as such in [[08-standards/observed]], where every other data-fetching case uses TanStack Query.

## UI states

Moon icon shown in light mode, sun icon in dark.

## Note

The preference is per-device, not per-user — nothing is stored server-side, so an agent switching machines gets the `"dark"` default again.

## Tests

None, at any level. Appropriate: a localStorage-backed CSS class toggle carries no business logic.
