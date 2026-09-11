import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { loginAsAdmin } from "../fixtures/auth";
import type { InboundEmailInput } from "core/schemas/tickets.ts";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;
const API_BASE_URL = process.env.BETTER_AUTH_URL!;

/**
 * Creates a ticket via the inbound email webhook and returns the ticket object.
 */
async function createTicketViaWebhook(
  request: APIRequestContext,
  payload: InboundEmailInput
) {
  const from = payload.fromName?.trim()
    ? `${payload.fromName} <${payload.from}>`
    : payload.from;
  const response = await request.post(
    `${API_BASE_URL}/api/webhooks/inbound-email`,
    {
      headers: { "x-webhook-secret": WEBHOOK_SECRET },
      multipart: {
        from,
        subject: payload.subject,
        text: payload.body,
        ...(payload.bodyHtml ? { html: payload.bodyHtml } : {}),
      },
    }
  );
  expect(response.status()).toBe(201);
  const body = await response.json();
  return body.ticket as {
    id: number;
    subject: string;
    senderName: string;
    senderEmail: string;
    body: string;
    bodyHtml: string | null;
    status: string;
    category: string | null;
  };
}

/**
 * Waits for the auto-resolve-ticket job to finish with this ticket, then puts the
 * ticket into the state the test needs.
 *
 * The inbound-email webhook enqueues auto-resolve-ticket, which writes status
 * "processing" and then a terminal status -- "open" when the AI call fails or
 * escalates, "resolved" when it succeeds (auto-resolve-ticket.ts:67-92). Until
 * that terminal write lands, any status or assignment the test sets is liable to
 * be overwritten by the job, which is what used to make these tests fail after a
 * reload.
 *
 * Two things this deliberately does NOT do:
 *
 * 1. It does not wait for "open" specifically. That would couple the *wait* to the
 *    AI call failing, which is only true because .env.test configures no
 *    OPENAI_API_KEY -- add one and the job writes "resolved" instead and the wait
 *    would never finish. It waits for *any* terminal status, then PATCHes the
 *    status it wants, so the test controls the status rather than inheriting
 *    whatever the job decided.
 *
 *    Note the narrow scope of that: it decouples **status only**. The category
 *    assertions in these tests still assume classify-ticket fails -- they locate
 *    the category control by `hasText: "None"`, and a classify job that succeeded
 *    would have written a real category (classify-ticket.ts:49-52), so that
 *    locator would match nothing. Supplying an OPENAI_API_KEY would still need
 *    those assertions revisited.
 * 2. It does not rely on the default per-test timeout. pg-boss drains one job per
 *    polling interval (batchSize 1, ~2s), so a job enqueued behind a full run's
 *    worth can wait tens of seconds before it even starts. With the default 30s
 *    test budget the wait alone could consume all of it and the real assertions
 *    would never run -- which failed deterministically when this spec ran
 *    alongside webhook-inbound-email.spec.ts. The budget is raised here, in the
 *    helper that needs it, so a future caller cannot forget to.
 *
 * (classify-ticket also runs and always fails under test, but it only writes on
 * success, so it cannot clobber anything -- it just retries and logs.)
 */
async function settleTicketAndOpen(page: Page, ticketId: number) {
  test.setTimeout(90_000);

  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `${API_BASE_URL}/api/tickets/${ticketId}`
        );
        expect(response.status()).toBe(200);
        return (await response.json()).status;
      },
      {
        message:
          `auto-resolve-ticket never reached a terminal status for ticket ${ticketId} ` +
          `(still "new" or "processing" after 60s -- the job queue is probably backed up)`,
        timeout: 60_000,
      }
    )
    .toMatch(/^(open|resolved)$/);

  // The job is finished, so nothing else will write to this ticket.
  const response = await page.request.patch(
    `${API_BASE_URL}/api/tickets/${ticketId}`,
    { data: { status: "open" } }
  );
  expect(response.status()).toBe(200);
}

/**
 * Builds a unique inbound-email payload so tests don't collide with each other.
 */
function createTestPayload(
  uniqueId: string,
  overrides?: Partial<InboundEmailInput>
): InboundEmailInput {
  return {
    from: `sender-${uniqueId}@example.com`,
    fromName: `Test Sender ${uniqueId}`,
    subject: `Test Subject ${uniqueId}`,
    body: `This is the body of ticket ${uniqueId}`,
    ...overrides,
  };
}

test.describe("Ticket Detail Page", () => {
  test("should redirect unauthenticated user to login", async ({
    page,
    request,
  }) => {
    const uniqueId = `nav-unauth-${Date.now()}`;
    const ticket = await createTicketViaWebhook(
      request,
      createTestPayload(uniqueId)
    );

    await page.goto(`/tickets/${ticket.id}`);

    await expect(page).toHaveURL("/login");
  });

  test("should persist ticket updates after page reload", async ({
    page,
    request,
  }) => {
    const uniqueId = `persist-updates-${Date.now()}`;
    const ticket = await createTicketViaWebhook(
      request,
      createTestPayload(uniqueId)
    );

    await loginAsAdmin(page);

    // Let the auto-resolve job finish before touching the ticket, then set the
    // status this test needs.
    await settleTicketAndOpen(page, ticket.id);
    await page.goto(`/tickets/${ticket.id}`);

    // Update status
    const statusPatch = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/tickets/${ticket.id}`) &&
        resp.request().method() === "PATCH" &&
        resp.status() === 200
    );
    await page.getByRole("combobox").filter({ hasText: "Open" }).click();
    await page.getByRole("option", { name: /^Resolved$/ }).click();
    await statusPatch;

    // Update category
    const categoryPatch = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/tickets/${ticket.id}`) &&
        resp.request().method() === "PATCH" &&
        resp.status() === 200
    );
    await page.getByRole("combobox").filter({ hasText: "None" }).click();
    await page.getByRole("option", { name: /^Technical$/ }).click();
    await categoryPatch;

    // Update assignment
    const assignPatch = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/tickets/${ticket.id}`) &&
        resp.request().method() === "PATCH" &&
        resp.status() === 200
    );
    await page.getByRole("combobox").nth(2).click();
    await page.getByRole("option", { name: /^Admin$/ }).click();
    await assignPatch;

    // Reload and verify all changes persisted
    await page.reload();

    await expect(
      page.getByRole("combobox").filter({ hasText: "Resolved" })
    ).toBeVisible();
    await expect(
      page.getByRole("combobox").filter({ hasText: "Technical" })
    ).toBeVisible();
    await expect(
      page.getByRole("combobox").filter({ hasText: "Admin" })
    ).toBeVisible();
  });

  test("should persist replies after page reload", async ({
    page,
    request,
  }) => {
    const uniqueId = `persist-reply-${Date.now()}`;
    const ticket = await createTicketViaWebhook(
      request,
      createTestPayload(uniqueId)
    );

    await loginAsAdmin(page);
    await page.goto(`/tickets/${ticket.id}`);

    const replyText = `Persisted reply for ${uniqueId}`;

    const postPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/tickets/${ticket.id}/replies`) &&
        resp.request().method() === "POST" &&
        resp.status() === 201
    );

    await page.getByPlaceholder(/type your reply/i).fill(replyText);
    await page.getByRole("button", { name: /send reply/i }).click();
    await postPromise;

    await page.reload();

    await expect(page.getByText(replyText)).toBeVisible();
  });

  test("should complete full agent workflow: navigate, view, update, reply, and return to list", async ({
    page,
    request,
  }) => {
    const uniqueId = `workflow-${Date.now()}`;
    const payload = createTestPayload(uniqueId, {
      body: `Customer question for ${uniqueId}`,
    });
    const ticket = await createTicketViaWebhook(request, payload);

    await loginAsAdmin(page);

    // Let the auto-resolve job finish before touching the ticket, then set the
    // status this test needs.
    await settleTicketAndOpen(page, ticket.id);

    // Navigate from list to detail
    await page.goto("/tickets");
    const subjectLink = page.getByRole("link", {
      name: ticket.subject,
      exact: true,
    });
    await expect(subjectLink).toBeVisible();
    await subjectLink.click();
    await expect(page).toHaveURL(`/tickets/${ticket.id}`);

    // Verify ticket details
    await expect(
      page.getByRole("heading", { name: ticket.subject })
    ).toBeVisible();
    const fromRow = page.locator("div").filter({ hasText: /^From:\s/ });
    await expect(fromRow.first()).toContainText(ticket.senderName);
    await expect(fromRow.first()).toContainText(ticket.senderEmail);
    await expect(page.getByText(ticket.body, { exact: true })).toBeVisible();

    // Update status
    const statusPatch = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/tickets/${ticket.id}`) &&
        resp.request().method() === "PATCH" &&
        resp.status() === 200
    );
    await page.getByRole("combobox").filter({ hasText: "Open" }).click();
    await page.getByRole("option", { name: /^Resolved$/ }).click();
    await statusPatch;
    await expect(
      page.getByRole("combobox").filter({ hasText: "Resolved" })
    ).toBeVisible();

    // Update category
    const categoryPatch = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/tickets/${ticket.id}`) &&
        resp.request().method() === "PATCH" &&
        resp.status() === 200
    );
    await page.getByRole("combobox").filter({ hasText: "None" }).click();
    await page.getByRole("option", { name: /^Technical$/ }).click();
    await categoryPatch;
    await expect(
      page.getByRole("combobox").filter({ hasText: "Technical" })
    ).toBeVisible();

    // Add a reply
    const replyText = `Agent resolution note for ${uniqueId}`;
    const postPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/tickets/${ticket.id}/replies`) &&
        resp.request().method() === "POST" &&
        resp.status() === 201
    );
    await page.getByPlaceholder(/type your reply/i).fill(replyText);
    await page.getByRole("button", { name: /send reply/i }).click();
    await postPromise;
    await expect(page.getByText(replyText)).toBeVisible();

    // Navigate back to list
    await page.getByRole("link", { name: /back to tickets/i }).click();
    await expect(page).toHaveURL("/tickets");
  });
});
