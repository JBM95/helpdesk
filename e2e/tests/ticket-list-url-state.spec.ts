import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "../fixtures/auth";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;
const API_BASE_URL = process.env.BETTER_AUTH_URL!;

/**
 * GH-1 — the ticket list's filters, sort and page live in URL search params.
 *
 * These cover only what needs a real browser: real Back/Forward, a real reload, and the real
 * ProtectedRoute redirect. Everything else about the URL grammar — every invalid-param fallback,
 * the omission of defaults, the page-1 reset, the request params — is covered by component tests in
 * `client/src/pages/TicketsPage.test.tsx` and unit tests in
 * `client/src/lib/ticket-list-params.test.ts`. Case ids refer to `.solvo/testplans/GH-1-cases.md`.
 */

/**
 * Creates enough agent-visible tickets for a second page to exist.
 *
 * The webhook is the only way in, and it creates tickets with status `new`, which `/api/tickets`
 * excludes — they only become visible once the `classify-ticket` / `auto-resolve-ticket` jobs have
 * run, which is not something a test should wait on. So each ticket is patched straight to `open`.
 *
 * `page.request` rather than the standalone `request` fixture, because `PATCH /api/tickets/:id` sits
 * behind `requireAuth` and only `page.request` carries the browser context's session cookie. Call
 * this after `loginAsAdmin`.
 *
 * KNOWN FRAGILITY: the patch races the `auto-resolve-ticket` job the webhook enqueues, which may
 * move a ticket to `resolved` after this returns. That matters for the tests that page **while a
 * `status=open` filter is applied** — if enough tickets get resolved, there is no second page, Next
 * is disabled, and the click times out rather than failing on an assertion. Those tests are the
 * AC4 retrace and nav-link ones and the AC5 unwind and rapid-history ones. Replace this helper with
 * a dedicated seed route when one exists; that is the real fix.
 */
async function seedOpenTickets(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    const unique = `${Date.now()}-${i}`;

    const created = await page.request.post(
      `${API_BASE_URL}/api/webhooks/inbound-email`,
      {
        headers: { "x-webhook-secret": WEBHOOK_SECRET },
        multipart: {
          from: `Seed Sender ${unique} <seed-${unique}@example.com>`,
          subject: `Seeded ticket ${unique}`,
          text: `Seeded body ${unique}`,
        },
      }
    );
    expect(
      created.status(),
      "webhook should accept the seeded ticket"
    ).toBe(201);
    const { ticket } = await created.json();

    const patched = await page.request.patch(
      `${API_BASE_URL}/api/tickets/${ticket.id}`,
      { data: { status: "open" } }
    );
    // Asserted, because an unauthenticated or rejected patch would leave every seeded ticket
    // invisible and every pagination test below would fail somewhere far less obvious.
    expect(
      patched.status(),
      "seeded ticket should be patched to open"
    ).toBe(200);
  }
}

/**
 * The filter controls are Radix Selects — a button with role `combobox`, not a native `<select>` —
 * so they are driven by opening the trigger and clicking an option, and read with `toHaveText`
 * rather than `toHaveValue`.
 */
function statusFilter(page: Page) {
  return page.getByRole("combobox").first();
}

async function chooseStatus(page: Page, optionName: string) {
  await statusFilter(page).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

/** The sortable control is the Button inside the column header, not the header cell itself. */
function sortButton(page: Page, column: RegExp) {
  return page.getByRole("button", { name: column });
}

const ticketLink = (page: Page) =>
  page.getByRole("table").getByRole("link").first();

test.describe("Ticket list URL state (GH-1)", () => {
  test.describe("AC3 — current page in the URL", () => {
    // CASE-adc92fc24569
    test("should still show page 2 after a full browser reload", async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await seedOpenTickets(page, 11);

      await page.goto("/tickets?page=2");
      await expect(page.getByText(/^Page 2 of/)).toBeVisible();

      await page.reload();

      await expect(page).toHaveURL("/tickets?page=2");
      await expect(page.getByText(/^Page 2 of/)).toBeVisible();
    });
  });

  test.describe("AC4 — returning to the list", () => {
    // CASE-e51a15eb56e6
    test("should restore filter, sort and page when returning from a ticket", async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await seedOpenTickets(page, 11);

      await page.goto("/tickets");
      await chooseStatus(page, "Open");
      await expect(page).toHaveURL(/status=open/);

      await sortButton(page, /Subject/).click();
      await expect(page).toHaveURL(/sortBy=subject/);

      await page.getByRole("button", { name: "Next page" }).click();
      await expect(page).toHaveURL(/page=2/);

      const listUrl = new URL(page.url()).search;

      await ticketLink(page).click();
      await expect(page).toHaveURL(/\/tickets\/\d+$/);

      await page.getByRole("link", { name: /back to tickets/i }).click();

      await expect(page).toHaveURL(`/tickets${listUrl}`);
      await expect(statusFilter(page)).toHaveText("Open");
      await expect(page.getByText(/^Page 2 of/)).toBeVisible();
    });

    // CASE-f3c0d3dae2bb
    test("should restore a filtered and paged list after a reload", async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await seedOpenTickets(page, 11);

      await page.goto("/tickets?status=open&page=2");
      await expect(page.getByText(/^Page 2 of/)).toBeVisible();

      await page.reload();

      await expect(page).toHaveURL("/tickets?status=open&page=2");
      await expect(statusFilter(page)).toHaveText("Open");
      await expect(page.getByText(/^Page 2 of/)).toBeVisible();
    });

    // CASE-f4309d9553e2
    test("should redirect a parameterised list URL to login with no session", async ({
      page,
    }) => {
      const listRequests: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/tickets")) {
          listRequests.push(request.url());
        }
      });

      await page.goto("/tickets?status=open&page=2");

      await expect(page).toHaveURL("/login");
      await expect(page.getByText("Welcome back")).toBeVisible();
      await expect(page.getByRole("table")).toHaveCount(0);
      expect(
        listRequests,
        "the guarded list must not fetch tickets before the redirect"
      ).toEqual([]);
    });

    // CASE-b66a9cb01fd3 — the list state is NOT carried through the login redirect: the app sends
    // every successful login to "/". That is the existing behaviour of the login flow (the shared
    // `loginAsAdmin` fixture asserts the same thing), not a preference of this story. Asserted here
    // so it stays a deliberate choice rather than drifting silently.
    test("should land on home, not the deep link, after logging in from a guarded URL", async ({
      page,
    }) => {
      await page.goto("/tickets?status=open&page=2");
      await expect(page).toHaveURL("/login");

      await loginAsAdmin(page);

      await expect(page).toHaveURL("/");
    });

    // CASE-8e3d236b21a9 — decided at GATE 1: the nav link means "a fresh list", so it deliberately
    // does not restore state. The retrace paths above are what restore it.
    test("should land on a clean list when using the nav Tickets link", async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await seedOpenTickets(page, 11);

      await page.goto("/tickets");
      await chooseStatus(page, "Open");
      await page.getByRole("button", { name: "Next page" }).click();
      await expect(page).toHaveURL(/status=open/);
      await expect(page).toHaveURL(/page=2/);

      // The nav link to "/" is labelled Dashboard, not Home
      await page.getByRole("link", { name: /^dashboard$/i }).click();
      await expect(page).toHaveURL("/");

      await page.getByRole("link", { name: /^tickets$/i }).click();

      await expect(page).toHaveURL("/tickets");
    });
  });

  test.describe("AC5 — browser back and forward", () => {
    // CASE-f8fac94b30ab
    test("should undo a filter change on Back", async ({ page }) => {
      await loginAsAdmin(page);

      await page.goto("/tickets");
      await chooseStatus(page, "Open");
      await expect(page).toHaveURL(/status=open/);

      await page.goBack();

      await expect(page).toHaveURL("/tickets");
      await expect(statusFilter(page)).toHaveText("All statuses");
    });

    // CASE-8548791d29f3
    test("should undo a page change on Back", async ({ page }) => {
      await loginAsAdmin(page);
      await seedOpenTickets(page, 11);

      await page.goto("/tickets");
      await page.getByRole("button", { name: "Next page" }).click();
      await expect(page).toHaveURL("/tickets?page=2");

      await page.goBack();

      await expect(page).toHaveURL("/tickets");
      await expect(page.getByText(/^Page 1 of/)).toBeVisible();
    });

    // CASE-4aa8b6f78dbf
    test("should re-apply the state on Forward after Back", async ({ page }) => {
      await loginAsAdmin(page);

      await page.goto("/tickets");
      await chooseStatus(page, "Resolved");
      await expect(page).toHaveURL(/status=resolved/);

      await page.goBack();
      await expect(page).toHaveURL("/tickets");

      await page.goForward();

      await expect(page).toHaveURL(/status=resolved/);
      await expect(statusFilter(page)).toHaveText("Resolved");
    });

    // CASE-a95f558f6ba0
    test("should unwind three successive states in order", async ({ page }) => {
      await loginAsAdmin(page);
      await seedOpenTickets(page, 11);

      await page.goto("/tickets");

      await chooseStatus(page, "Open");
      await expect(page).toHaveURL(/status=open/);
      const afterFilter = new URL(page.url()).search;

      await sortButton(page, /Subject/).click();
      await expect(page).toHaveURL(/sortBy=subject/);
      const afterSort = new URL(page.url()).search;

      await page.getByRole("button", { name: "Next page" }).click();
      await expect(page).toHaveURL(/page=2/);

      await page.goBack();
      await expect(page).toHaveURL(`/tickets${afterSort}`);

      await page.goBack();
      await expect(page).toHaveURL(`/tickets${afterFilter}`);

      await page.goBack();
      await expect(page).toHaveURL("/tickets");
      await expect(statusFilter(page)).toHaveText("All statuses");
    });

    // CASE-fe4d5dbbfc65 — an untouched list must not trap the reader. It would if arriving at
    // /tickets replaced the previous entry instead of pushing one.
    test("should leave the tickets page on Back when no control was touched", async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await expect(page).toHaveURL("/");

      await page.getByRole("link", { name: /^tickets$/i }).click();
      await expect(page).toHaveURL("/tickets");

      await page.goBack();

      await expect(page).toHaveURL("/");
    });

    // CASE-b45e016761f1
    test("should keep the rendered list in step with the URL through rapid Back and Forward", async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await seedOpenTickets(page, 11);

      await page.goto("/tickets");
      await chooseStatus(page, "Open");
      await expect(page).toHaveURL(/status=open/);
      await sortButton(page, /Subject/).click();
      await expect(page).toHaveURL(/sortBy=subject/);
      await page.getByRole("button", { name: "Next page" }).click();
      await expect(page).toHaveURL(/page=2/);

      await page.goBack();
      await page.goBack();
      await page.goForward();
      await page.goForward();
      await page.goBack();

      // Settled state: filter + sort, page 1. Asserted through the URL, the controls and the footer
      // so a URL that disagrees with what is rendered fails here.
      await expect(page).toHaveURL(/status=open/);
      await expect(page).toHaveURL(/sortBy=subject/);
      await expect(page).not.toHaveURL(/page=/);
      await expect(statusFilter(page)).toHaveText("Open");
      await expect(page.getByText(/^Page 1 of/)).toBeVisible();
    });

    // CASE-6e5a5e6f195f
    test("should not render a superseded in-flight response after Back", async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await seedOpenTickets(page, 11);

      await page.goto("/tickets");
      await chooseStatus(page, "Open");
      await expect(page).toHaveURL(/status=open/);

      // Hold the next list request open so Back happens while it is in flight.
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/tickets?*", async (route) => {
        await held;
        await route.continue();
      });

      await sortButton(page, /Subject/).click();
      await expect(page).toHaveURL(/sortBy=subject/);

      await page.goBack();
      release();
      await page.unroute("**/api/tickets?*");

      // Back landed on filter-only, so that is what must be rendered — not the sort whose request
      // was still outstanding.
      await expect(page).toHaveURL(/status=open/);
      await expect(page).not.toHaveURL(/sortBy=/);
      await expect(statusFilter(page)).toHaveText("Open");

      // The URL and the trigger are both derived from the URL, so they cannot detect a stale render
      // on their own. The row order is what actually distinguishes the superseded response: the
      // sorted request that was in flight would have returned subject-ascending rows.
      const subjects = await page
        .getByRole("table")
        .getByRole("link")
        .allInnerTexts();
      const sortedBySubject = [...subjects].sort((a, b) => a.localeCompare(b));
      expect(
        subjects,
        "rows should be in the default createdAt order, not the superseded subject sort"
      ).not.toEqual(sortedBySubject);
    });
  });
});
