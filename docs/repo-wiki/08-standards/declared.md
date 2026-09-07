---
tags: [standards, declared, config]
---

# Declared Standards

> Extracted from config files and `CLAUDE.md` by `explore-02-standards-extractor` via `/setup-05-explore global` on 2026-09-07.

## TypeScript compiler settings

### Client (`client/tsconfig.app.json`)

```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "erasableSyntaxOnly": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedSideEffectImports": true,
  "moduleResolution": "bundler",
  "verbatimModuleSyntax": true
}
```

**Path aliases:**
- `@/*` → `./src/*`
- `core/*` → `../core/*`

### Server (`server/tsconfig.json`)

```json
{
  "strict": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noUnusedLocals": false,
  "noUnusedParameters": false,
  "noPropertyAccessFromIndexSignature": false
}
```

**Path alias:** `core/*` → `../core/*`

### Root (E2E, `tsconfig.json`)

Target `ES2022`, module `ESNext`, `moduleResolution: bundler`, `esModuleInterop: true`.

## ESLint

`client/eslint.config.js:1-23` — flat config, applies to `**/*.{ts,tsx}`:

- `@eslint/js` recommended
- `typescript-eslint` recommended
- `eslint-plugin-react-hooks` flat recommended
- `eslint-plugin-react-refresh` Vite config
- Globals: browser. Ignores: `dist/`

**No ESLint config exists for `server` or `core`** — verified: the only config in the repo is `client/eslint.config.js`.

## Testing

### Vitest (client component tests)

`client/vite.config.ts:41-50`:

```typescript
test: {
  globals: true,
  environment: "jsdom",
  setupFiles: "./src/test/setup.ts",
  server: { deps: { inline: ["@tanstack/react-table"] } },
}
```

**No coverage threshold configured.**

### Playwright (E2E)

`playwright.config.ts:1-34`:

- `testDir: ./e2e/tests`, globalSetup/Teardown at `./e2e/global-{setup,teardown}.ts`
- `fullyParallel: true`; `forbidOnly` and `retries: 2` apply in CI only (0 retries locally)
- `baseURL: http://localhost:5174`
- `webServer` starts both server (port 3001) and client (port 5174)

**No coverage threshold configured.**

## CLAUDE.md conventions

`CLAUDE.md:24-94` declares the following project-specific standards.

### Path aliases

- `@/` for client imports (maps to `./src/`)
- `core/*` for shared code

### Library usage

- **Runtime**: Bun (not npm/yarn/Node)
- **Validation**: Zod from `zod/v4`
- **HTTP client**: Axios (not `fetch`)
- **Server state**: TanStack React Query (`useQuery`, `useMutation`) — not `useEffect` + `useState`
- **Forms**: React Hook Form + Zod resolver (`@hookform/resolvers/zod`)
- **UI**: shadcn/ui components from `@/components/ui/*`

### Server route conventions

- Endpoints organised into Express `Router` modules under `server/src/routes/`, mounted in `index.ts`
- Validate request bodies with the shared `validate` helper (`../lib/validate`)
- Parse numeric ID route params with `parseId` (`../lib/parse-id`)
- **Do not wrap async route handlers in try/catch** — Express 5 catches rejected promises

### Shared code conventions

- Zod schemas in `core/schemas/`
- Constants and domain types in `core/constants/` as **union types**, not `enum` — the client has `erasableSyntaxOnly` enabled
- `as const` objects where runtime access is needed (e.g. `Role` at `core/constants/role.ts`)
- Use the shared `Role` constant instead of hardcoded `"admin"` / `"agent"`

### Client conventions

- **shadcn semantic colour tokens** (`bg-background`, `text-muted-foreground`, `text-destructive`) instead of hardcoded Tailwind colours
- `ErrorAlert` for error messages — static (`message=`) or Axios-extracting (`error=` + `fallback=`)
- `ErrorMessage` for field validation errors

### Testing policy

- **Prefer component tests** for the majority of coverage (rendering, states, data display, error handling)
- **Reserve E2E** for things needing a real browser + server: navigation, auth redirects, full-stack integration
- Never duplicate in E2E what component tests already cover

## Coverage thresholds

**None configured anywhere.** Verified: no `coverage` key in `client/vite.config.ts` or `playwright.config.ts`, no `.nycrc`, no coverage flags in any `package.json`. This is the input to the calibration step — there is no repo-configured threshold to reuse, so the shipped fallback applies.

## Related

- [[observed]] — what the code actually does
- [[conflicts]] — where declared and observed disagree
- [[00-scope]] — records that no CI enforces any of the above
