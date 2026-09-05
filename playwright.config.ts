import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tests",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  // One worker, deliberately. Every spec runs against the same database and there is no per-test
  // data isolation, so specs that assert "my ticket is on page 1 of /tickets" are only safe while
  // no other spec is creating tickets at the same time. That held by luck until a spec needed
  // enough tickets to paginate: 8 tests x 11 seeded tickets pushed other specs' rows off page 1,
  // and tickets.spec.ts and ticket-detail.spec.ts failed on data they did not create. Parallelism
  // here trades ~30s of wall clock for tests that fail for reasons unrelated to the code.
  // Removing this needs per-test isolation (a data namespace or teardown), not a worker count.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  outputDir: "./e2e/test-results",
  reporter: [["html", { outputFolder: "./e2e/playwright-report" }]],
  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "bun run --cwd server --env-file=.env.test src/index.ts",
      url: "http://localhost:3001/api/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      // VITE_API_URL goes through `env` rather than a `VAR=value cmd` prefix on the
      // command: Playwright spawns webServer through the platform shell, and cmd.exe
      // reads that prefix as a program name ("'VITE_API_URL' is not recognized"), so
      // the suite could not start on Windows at all.
      command: "bun run --cwd client vite --port 5174",
      env: { VITE_API_URL: "http://localhost:3001" },
      url: "http://localhost:5174",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
