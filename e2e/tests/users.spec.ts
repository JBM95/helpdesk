import { expect, test, type Browser, type Page } from '@playwright/test';
import { Role } from 'core/constants/role.ts';
import { login, loginAsAdmin } from '../fixtures/auth';

/**
 * E2E tests for User Management CRUD operations
 *
 * These tests cover the happy paths for:
 * - Viewing the users list
 * - Creating a new user
 * - Editing an existing user
 * - Deleting a user
 *
 * All tests run as an admin user since user management is admin-only.
 */
test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin before each test
    await loginAsAdmin(page);
    // Navigate to the users page
    await page.goto('/users');
  });

  test.describe('View Users', () => {
    test('should display users table with correct columns', async ({
      page,
    }) => {
      // Wait for table to be visible
      const table = page.getByRole('table');
      await expect(table).toBeVisible();

      // Check all column headers are present
      await expect(
        page.getByRole('columnheader', { name: /^name$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('columnheader', { name: /^email$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('columnheader', { name: /^role$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('columnheader', { name: /^created$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('columnheader', { name: /^actions$/i }),
      ).toBeVisible();
    });
  });

  test.describe('Create User', () => {
    test("should open create user dialog when clicking 'New User'", async ({
      page,
    }) => {
      // Click "New User" button
      await page
        .getByRole('button', { name: /new user/i })
        .click();

      // Dialog should be visible
      await expect(
        page.getByRole('heading', { name: /^create user$/i }),
      ).toBeVisible();

      // Form fields should be visible
      await expect(page.getByLabel(/^name$/i)).toBeVisible();
      await expect(page.getByLabel(/^email$/i)).toBeVisible();
      await expect(page.getByLabel(/^password$/i)).toBeVisible();

      // Submit button should be visible
      await expect(
        page.getByRole('button', { name: /create user/i }),
      ).toBeVisible();
    });

    test('should create a new agent user successfully', async ({
      page,
    }) => {
      // Verify we're on the users page and logged in
      await expect(page).toHaveURL('/users');
      await expect(
        page.getByRole('heading', { name: /^users$/i }),
      ).toBeVisible();

      // Click "New User" button
      await page
        .getByRole('button', { name: /new user/i })
        .click();

      // Fill in the form
      const timestamp = Date.now();
      const userName = `Test Agent ${timestamp}`;
      const userEmail = `agent${timestamp}@example.com`;
      const userPassword = 'password123';

      await page.getByLabel(/^name$/i).fill(userName);
      await page.getByLabel(/^email$/i).fill(userEmail);
      await page.getByLabel(/^password$/i).fill(userPassword);

      // Listen for the API response to capture any errors
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/users') &&
          response.request().method() === 'POST',
        { timeout: 10000 },
      );

      // Submit the form
      await page
        .getByRole('button', { name: /create user/i })
        .click();

      // Wait for the API response
      const response = await responsePromise;
      const status = response.status();

      // If the request failed, get the error details
      if (status !== 201) {
        const responseBody = await response.text();
        throw new Error(
          `API request failed with status ${status}: ${responseBody}`,
        );
      }

      // Wait for the new user to appear in the table
      await expect(
        page.getByRole('cell', { name: userEmail, exact: true }),
      ).toBeVisible();

      // Verify user details are correct
      const newUserRow = page
        .getByRole('row')
        .filter({ hasText: userEmail });
      await expect(newUserRow).toContainText(userName);
      await expect(newUserRow).toContainText(userEmail);

      // New user should have "agent" role (default)
      await expect(newUserRow).toContainText('agent');

      // New agent user should have both edit and delete buttons
      await expect(
        newUserRow.getByRole('button', {
          name: new RegExp(`edit ${userName}`, 'i'),
        }),
      ).toBeVisible();
      await expect(
        newUserRow.getByRole('button', {
          name: new RegExp(`delete ${userName}`, 'i'),
        }),
      ).toBeVisible();
    });

    // Note: Loading state test is skipped as the operation completes too quickly to reliably test
  });

  test.describe('Edit User', () => {
    test('should open edit user dialog when clicking edit button', async ({
      page,
    }) => {
      // First create a user to edit
      await page
        .getByRole('button', { name: /new user/i })
        .click();
      const timestamp = Date.now();
      const userName = `Edit Test ${timestamp}`;
      const userEmail = `edittest${timestamp}@example.com`;

      await page.getByLabel(/^name$/i).fill(userName);
      await page.getByLabel(/^email$/i).fill(userEmail);
      await page.getByLabel(/^password$/i).fill('password123');
      await page
        .getByRole('button', { name: /create user/i })
        .click();

      // Wait for user to appear in the table (which indicates dialog has closed)
      await expect(
        page.getByRole('cell', { name: userEmail }),
      ).toBeVisible();

      // Click edit button for the newly created user
      const userRow = page
        .getByRole('row')
        .filter({ hasText: userEmail });
      await userRow
        .getByRole('button', {
          name: new RegExp(`edit ${userName}`, 'i'),
        })
        .click();

      // Edit dialog should be visible
      await expect(
        page.getByRole('heading', { name: /^edit user$/i }),
      ).toBeVisible();

      // Form fields should be pre-populated
      await expect(page.getByLabel(/^name$/i)).toHaveValue(
        userName,
      );
      await expect(page.getByLabel(/^email$/i)).toHaveValue(
        userEmail,
      );

      // Password field should be empty (with placeholder text)
      await expect(page.getByLabel(/^password$/i)).toHaveValue(
        '',
      );
      await expect(
        page.getByLabel(/^password$/i),
      ).toHaveAttribute(
        'placeholder',
        /leave blank to keep current/i,
      );

      // Submit button should say "Save Changes"
      await expect(
        page.getByRole('button', { name: /save changes/i }),
      ).toBeVisible();
    });

    test('should edit user name and email together', async ({
      page,
    }) => {
      // Create a user
      await page
        .getByRole('button', { name: /new user/i })
        .click();
      const timestamp = Date.now();
      const originalName = `Original Both ${timestamp}`;
      const originalEmail = `originalboth${timestamp}@example.com`;

      await page.getByLabel(/^name$/i).fill(originalName);
      await page.getByLabel(/^email$/i).fill(originalEmail);
      await page.getByLabel(/^password$/i).fill('password123');
      await page
        .getByRole('button', { name: /create user/i })
        .click();

      // Wait for user to appear in the table (which indicates dialog has closed)
      await expect(
        page.getByRole('cell', {
          name: originalEmail,
          exact: true,
        }),
      ).toBeVisible();

      // Open edit dialog
      const userRow = page
        .getByRole('row')
        .filter({ hasText: originalEmail });
      await userRow
        .getByRole('button', {
          name: new RegExp(`edit ${originalName}`, 'i'),
        })
        .click();

      // Edit both name and email
      const newName = `Updated Both ${timestamp}`;
      const newEmail = `updatedboth${timestamp}@example.com`;
      await page.getByLabel(/^name$/i).clear();
      await page.getByLabel(/^name$/i).fill(newName);
      await page.getByLabel(/^email$/i).clear();
      await page.getByLabel(/^email$/i).fill(newEmail);

      // Submit the form
      await page
        .getByRole('button', { name: /save changes/i })
        .click();

      // Wait for the updated values to appear in the table (indicates successful update)
      await expect(
        page.getByRole('cell', { name: newEmail, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('cell', { name: newName, exact: true }),
      ).toBeVisible();

      // Original values should not be visible
      await expect(
        page.getByText(originalName),
      ).not.toBeVisible();
      await expect(
        page.getByText(originalEmail),
      ).not.toBeVisible();
    });

    // Note: Loading state test is skipped as the operation completes too quickly to reliably test
  });

  test.describe('Delete User', () => {
    test('should open delete confirmation dialog when clicking delete button', async ({
      page,
    }) => {
      // Create a user to delete
      await page
        .getByRole('button', { name: /new user/i })
        .click();
      const timestamp = Date.now();
      const userName = `Delete Test ${timestamp}`;
      const userEmail = `deletetest${timestamp}@example.com`;

      await page.getByLabel(/^name$/i).fill(userName);
      await page.getByLabel(/^email$/i).fill(userEmail);
      await page.getByLabel(/^password$/i).fill('password123');
      await page
        .getByRole('button', { name: /create user/i })
        .click();

      // Wait for user to appear in the table (which indicates dialog has closed)
      await expect(
        page.getByRole('cell', { name: userEmail }),
      ).toBeVisible();

      // Click delete button
      const userRow = page
        .getByRole('row')
        .filter({ hasText: userEmail });
      await userRow
        .getByRole('button', {
          name: new RegExp(`delete ${userName}`, 'i'),
        })
        .click();

      // Delete confirmation dialog should be visible
      await expect(
        page.getByRole('heading', { name: /^delete user$/i }),
      ).toBeVisible();

      // Confirmation message should include user name
      await expect(
        page.getByText(
          new RegExp(
            `are you sure you want to delete ${userName}`,
            'i',
          ),
        ),
      ).toBeVisible();

      // Cancel and Confirm buttons should be visible
      await expect(
        page.getByRole('button', { name: /^cancel$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /^confirm$/i }),
      ).toBeVisible();
    });

    test('should delete user successfully when clicking Confirm', async ({
      page,
    }) => {
      // Create a user to delete
      await page
        .getByRole('button', { name: /new user/i })
        .click();
      const timestamp = Date.now();
      const userName = `To Delete ${timestamp}`;
      const userEmail = `todelete${timestamp}@example.com`;

      await page.getByLabel(/^name$/i).fill(userName);
      await page.getByLabel(/^email$/i).fill(userEmail);
      await page.getByLabel(/^password$/i).fill('password123');
      await page
        .getByRole('button', { name: /create user/i })
        .click();

      // Wait for user to appear in the table (which indicates dialog has closed)
      await expect(
        page.getByRole('cell', { name: userEmail }),
      ).toBeVisible();

      // Click delete button
      const userRow = page
        .getByRole('row')
        .filter({ hasText: userEmail });
      await userRow
        .getByRole('button', {
          name: new RegExp(`delete ${userName}`, 'i'),
        })
        .click();

      // Click Confirm
      await page
        .getByRole('button', { name: /^confirm$/i })
        .click();

      // Wait for the user to be removed from the table (indicates successful deletion)
      await expect(
        page.getByRole('cell', { name: userEmail, exact: true }),
      ).not.toBeVisible();

      // Also verify the user name is gone
      await expect(page.getByText(userName)).not.toBeVisible();
    });
  });
});

/**
 * E2E tests for role promotion and demotion (GH-8).
 *
 * These live at the E2E layer on purpose. The server has no test suite, so a
 * Playwright spec is the only place a server-side authorization claim can be
 * proven in this repo — see docs/repo-wiki/11-testing.md. API-level assertions
 * drive `request` directly, the pattern webhook-inbound-email.spec.ts sets.
 *
 * The seed creates exactly one user (an admin), so every negative case needs a
 * second principal. Each test creates its own through POST /api/users, which
 * needs no seed change and exercises AC6 on the way past.
 */
const PASSWORD = 'password123';

/** The suite is fullyParallel, so every principal needs a unique email. */
function unique() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type TestUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

async function createAgent(adminPage: Page, label: string): Promise<TestUser> {
  const suffix = unique();
  const name = `${label} ${suffix}`;
  const email = `${label.toLowerCase().replace(/\s+/g, '-')}-${suffix}@example.com`;

  const response = await adminPage.request.post('/api/users', {
    data: { name, email, password: PASSWORD },
  });
  expect(response.status()).toBe(201);

  const { user } = await response.json();
  return { id: user.id, name, email, role: user.role };
}

/** Full PUT payload — role is a required field, so every update carries one. */
async function setRole(adminPage: Page, user: TestUser, role: string) {
  return adminPage.request.put(`/api/users/${user.id}`, {
    data: { name: user.name, email: user.email, password: '', role },
  });
}

async function storedRole(adminPage: Page, id: string) {
  const response = await adminPage.request.get('/api/users');
  expect(response.status()).toBe(200);
  const { users } = await response.json();
  return users.find((u: { id: string }) => u.id === id)?.role;
}

/** A second, independently-authenticated session in its own browser context. */
async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { email, password: PASSWORD });
  await expect(page).toHaveURL('/');
  return { context, page };
}

test.describe('Role management', () => {
  test.describe('AC1, AC8 — editing a role from the Users page', () => {
    test('should change an agent to an admin and show the new role in the table', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const target = await createAgent(page, 'Promote UI');
      await page.goto('/users');

      const row = page.getByRole('row').filter({ hasText: target.email });
      await expect(row).toContainText(Role.agent);

      await row
        .getByRole('button', { name: new RegExp(`edit ${target.name}`, 'i') })
        .click();

      // The dialog exposes the current role before it is changed
      const roleSelect = page.getByRole('combobox', { name: 'Role' });
      await expect(roleSelect).toContainText('Agent');

      await roleSelect.click();
      await page.getByRole('option', { name: 'Admin' }).click();
      await page.getByRole('button', { name: /save changes/i }).click();

      // AC8 — the table reflects the persisted role with no manual refresh
      await expect(row).toContainText(Role.admin);
      expect(await storedRole(page, target.id)).toBe(Role.admin);
    });

    // The promotion case above only proves one direction. AC1 is explicit that an
    // admin can move a user *between* the two roles, so the demotion direction
    // needs its own UI scenario rather than resting on the API-level cases.
    test('should change an admin back to an agent and show the new role in the table', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const target = await createAgent(page, 'Demote UI');
      expect((await setRole(page, target, Role.admin)).status()).toBe(200);

      await page.goto('/users');
      const row = page.getByRole('row').filter({ hasText: target.email });
      await expect(row).toContainText(Role.admin);

      // UsersTable hides Delete for admins, so it must be absent here...
      await expect(
        row.getByRole('button', { name: new RegExp(`delete ${target.name}`, 'i') }),
      ).toBeHidden();

      await row
        .getByRole('button', { name: new RegExp(`edit ${target.name}`, 'i') })
        .click();

      const roleSelect = page.getByRole('combobox', { name: 'Role' });
      await expect(roleSelect).toContainText('Admin');

      await roleSelect.click();
      await page.getByRole('option', { name: 'Agent' }).click();
      await page.getByRole('button', { name: /save changes/i }).click();

      // AC8 — the badge repaints on the ["users"] invalidation, no manual refresh
      await expect(row).toContainText(Role.agent);
      expect(await storedRole(page, target.id)).toBe(Role.agent);

      // ...and the role-conditional Delete button comes back with the demotion
      await expect(
        row.getByRole('button', { name: new RegExp(`delete ${target.name}`, 'i') }),
      ).toBeVisible();
    });

    test('should not offer a role control when creating a user', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await page.goto('/users');

      await page.getByRole('button', { name: /new user/i }).click();
      await expect(
        page.getByRole('heading', { name: /^create user$/i }),
      ).toBeVisible();

      await expect(
        page.getByRole('combobox', { name: 'Role' }),
      ).toBeHidden();
    });
  });

  test.describe('AC2 — only the admin-protected API may mutate a role', () => {
    test('should reject a role change from an authenticated non-admin', async ({
      page,
      browser,
    }) => {
      await loginAsAdmin(page);
      const victim = await createAgent(page, 'Victim');
      const attacker = await createAgent(page, 'Attacker');

      const { context, page: attackerPage } = await signIn(
        browser,
        attacker.email,
      );

      // Calling the API directly, not through the UI it never sees
      const response = await attackerPage.request.put(
        `/api/users/${victim.id}`,
        {
          data: {
            name: victim.name,
            email: victim.email,
            password: '',
            role: Role.admin,
          },
        },
      );

      expect(response.status()).toBe(403);
      // "Forbidden" is requireAdmin's message — proves the admin guard refused
      // it, not some later rule that happens to also return 403.
      expect((await response.json()).error).toBe('Forbidden');
      expect(await storedRole(page, victim.id)).toBe(Role.agent);

      await context.close();
    });

    test('should reject a role change from an unauthenticated caller', async ({
      page,
      request,
    }) => {
      await loginAsAdmin(page);
      const target = await createAgent(page, 'Unauth Target');

      const response = await request.put(`/api/users/${target.id}`, {
        data: {
          name: target.name,
          email: target.email,
          password: '',
          role: Role.admin,
        },
      });

      expect(response.status()).toBe(401);
      expect(await storedRole(page, target.id)).toBe(Role.agent);
    });

    test('should reject an agent promoting themselves', async ({
      page,
      browser,
    }) => {
      await loginAsAdmin(page);
      const agent = await createAgent(page, 'Self Promoter');

      const { context, page: agentPage } = await signIn(browser, agent.email);

      const response = await agentPage.request.put(`/api/users/${agent.id}`, {
        data: {
          name: agent.name,
          email: agent.email,
          password: '',
          role: Role.admin,
        },
      });

      expect(response.status()).toBe(403);
      // requireAdmin refuses before the self-role-change guard is ever reached
      expect((await response.json()).error).toBe('Forbidden');
      expect(await storedRole(page, agent.id)).toBe(Role.agent);

      await context.close();
    });
  });

  test.describe('AC3 — strict role validation', () => {
    test('should reject an unsupported role and leave the stored role alone', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const target = await createAgent(page, 'Bad Role');

      const response = await page.request.put(`/api/users/${target.id}`, {
        data: {
          name: target.name,
          email: target.email,
          password: '',
          role: 'superuser',
        },
      });

      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe(
        'Role must be either agent or admin',
      );
      expect(await storedRole(page, target.id)).toBe(Role.agent);
    });

    test('should reject a missing role and leave the stored role alone', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const target = await createAgent(page, 'No Role');

      const response = await page.request.put(`/api/users/${target.id}`, {
        data: { name: target.name, email: target.email, password: '' },
      });

      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe(
        'Role must be either agent or admin',
      );
      expect(await storedRole(page, target.id)).toBe(Role.agent);
    });

    // z.enum is case-sensitive; documenting that rather than leaving it implied
    test('should reject a role differing only in case', async ({ page }) => {
      await loginAsAdmin(page);
      const target = await createAgent(page, 'Cased Role');

      const response = await page.request.put(`/api/users/${target.id}`, {
        data: {
          name: target.name,
          email: target.email,
          password: '',
          role: 'Admin',
        },
      });

      expect(response.status()).toBe(400);
      expect(await storedRole(page, target.id)).toBe(Role.agent);
    });

    test('should reject a null role and leave the stored role alone', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const target = await createAgent(page, 'Null Role');

      const response = await page.request.put(`/api/users/${target.id}`, {
        data: {
          name: target.name,
          email: target.email,
          password: '',
          role: null,
        },
      });

      expect(response.status()).toBe(400);
      expect(await storedRole(page, target.id)).toBe(Role.agent);
    });

    test('should not change a role that was already rejected for another field', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const target = await createAgent(page, 'Short Name');

      // Name fails validation, so nothing is written even though role is valid
      const response = await page.request.put(`/api/users/${target.id}`, {
        data: {
          name: 'ab',
          email: target.email,
          password: '',
          role: Role.admin,
        },
      });

      expect(response.status()).toBe(400);
      // The name error, not the role error — validation rejected the whole
      // payload before the handler could apply the otherwise-valid role.
      expect((await response.json()).error).toBe(
        'Name must be at least 3 characters',
      );
      expect(await storedRole(page, target.id)).toBe(Role.agent);
    });

    // The role write sits after the email-uniqueness check, so a 409 must leave
    // the role alone too -- the whole request is rejected, not just the email.
    test('should not change a role when the email is already taken', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const target = await createAgent(page, 'Conflict Target');
      const other = await createAgent(page, 'Conflict Holder');

      const response = await page.request.put(`/api/users/${target.id}`, {
        data: {
          name: target.name,
          email: other.email,
          password: '',
          role: Role.admin,
        },
      });

      expect(response.status()).toBe(409);
      expect((await response.json()).error).toBe('Email already exists');
      expect(await storedRole(page, target.id)).toBe(Role.agent);
    });
  });

  test.describe('AC4, AC5 — a role change binds an existing session', () => {
    test('should stop authorizing admin APIs on a demoted admin existing session', async ({
      page,
      browser,
    }) => {
      await loginAsAdmin(page);
      const target = await createAgent(page, 'Demote Me');
      expect((await setRole(page, target, Role.admin)).status()).toBe(200);

      // The target signs in while still an admin, so the session predates the demotion
      const { context, page: targetPage } = await signIn(browser, target.email);
      expect((await targetPage.request.get('/api/users')).status()).toBe(200);

      expect((await setRole(page, target, Role.agent)).status()).toBe(200);

      // Same session, no reload, no re-login — the privilege is gone
      const afterDemotion = await targetPage.request.get('/api/users');
      expect(afterDemotion.status()).toBe(401);
      expect(await storedRole(page, target.id)).toBe(Role.agent);

      await context.close();
    });

    test('should authorize admin APIs on a promoted agent existing session', async ({
      page,
      browser,
    }) => {
      await loginAsAdmin(page);
      const target = await createAgent(page, 'Promote Me');

      // Signs in as an agent, so this session predates the promotion
      const { context, page: targetPage } = await signIn(browser, target.email);
      expect((await targetPage.request.get('/api/users')).status()).toBe(403);

      expect((await setRole(page, target, Role.admin)).status()).toBe(200);

      // Same session and no re-login: this is what proves the role is
      // re-read from the User row on every request rather than cached.
      const afterPromotion = await targetPage.request.get('/api/users');
      expect(afterPromotion.status()).toBe(200);

      const me = await targetPage.request.get('/api/me');
      expect((await me.json()).user.role).toBe(Role.admin);

      await context.close();
    });
  });

  test.describe('AC6 — creation policy is unchanged', () => {
    test('should still create an agent through POST /api/users', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const created = await createAgent(page, 'Still Agent');

      expect(created.role).toBe(Role.agent);
      expect(await storedRole(page, created.id)).toBe(Role.agent);
    });

    test('should ignore a role supplied to POST /api/users', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const suffix = unique();
      const email = `sneaky-${suffix}@example.com`;

      const response = await page.request.post('/api/users', {
        data: {
          name: `Sneaky ${suffix}`,
          email,
          password: PASSWORD,
          role: Role.admin,
        },
      });

      expect(response.status()).toBe(201);
      const { user } = await response.json();
      expect(user.role).toBe(Role.agent);
    });
  });

  test.describe('AC7 — admin deletion protection survives', () => {
    test('should refuse to delete a user whose stored role is admin', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const target = await createAgent(page, 'Undeletable');
      expect((await setRole(page, target, Role.admin)).status()).toBe(200);

      const response = await page.request.delete(`/api/users/${target.id}`);

      expect(response.status()).toBe(403);
      expect((await response.json()).error).toBe(
        'Admin users cannot be deleted',
      );
      expect(await storedRole(page, target.id)).toBe(Role.admin);
    });

    test('should allow deletion once an admin has been demoted', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const target = await createAgent(page, 'Demote Then Delete');
      expect((await setRole(page, target, Role.admin)).status()).toBe(200);
      expect((await page.request.delete(`/api/users/${target.id}`)).status()).toBe(
        403,
      );

      expect((await setRole(page, target, Role.agent)).status()).toBe(200);

      // Deliberate per AC7, which protects the *currently* stored role: demoting
      // and then deleting is two individually-legal steps, not a bypass.
      expect((await page.request.delete(`/api/users/${target.id}`)).status()).toBe(
        200,
      );
      expect(await storedRole(page, target.id)).toBeUndefined();
    });
  });

  test.describe('Self role change is refused', () => {
    test('should refuse to let an admin demote themselves', async ({ page }) => {
      await loginAsAdmin(page);

      const me = await page.request.get('/api/me');
      const self = (await me.json()).user;
      expect(self.role).toBe(Role.admin);

      const response = await page.request.put(`/api/users/${self.id}`, {
        data: {
          name: self.name,
          email: self.email,
          password: '',
          role: Role.agent,
        },
      });

      expect(response.status()).toBe(403);
      expect((await response.json()).error).toBe(
        'You cannot change your own role',
      );

      // Still an admin, and the session still works
      expect((await page.request.get('/api/users')).status()).toBe(200);
      expect(await storedRole(page, self.id)).toBe(Role.admin);
    });

    // The self-role guard is ordered *before* the email-uniqueness check so an
    // authorization refusal is never reported as a data conflict. Nothing else in
    // the suite distinguishes the two orders: every other case trips only one of
    // them. This is the payload that trips both at once, so it is the only
    // scenario that fails if the guards are ever swapped.
    test('should refuse a self role change with a 403, not a 409, when the email is also taken', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const other = await createAgent(page, 'Email Holder');

      const self = (await (await page.request.get('/api/me')).json()).user;
      expect(self.role).toBe(Role.admin);

      const response = await page.request.put(`/api/users/${self.id}`, {
        data: {
          name: self.name,
          email: other.email, // already held by another user -> would be a 409
          password: '',
          role: Role.agent, // ...but this is a self role change -> must be a 403
        },
      });

      expect(response.status()).toBe(403);
      expect((await response.json()).error).toBe(
        'You cannot change your own role',
      );

      // Neither field was written, and the caller keeps their own email
      expect(await storedRole(page, self.id)).toBe(Role.admin);
      const users = await (await page.request.get('/api/users')).json();
      expect(
        users.users.find((u: { id: string }) => u.id === self.id).email,
      ).toBe(self.email);
    });

    // The role control renders on every row, including the caller's own, so this
    // refusal is reachable through the UI and not only by calling the API.
    test('should show the refusal in the dialog when an admin demotes themselves', async ({
      page,
    }) => {
      await loginAsAdmin(page);
      const self = (await (await page.request.get('/api/me')).json()).user;
      await page.goto('/users');

      const ownRow = page.getByRole('row').filter({ hasText: self.email });
      await ownRow
        .getByRole('button', { name: new RegExp(`edit ${self.name}`, 'i') })
        .click();

      await expect(page.getByRole('combobox', { name: 'Role' })).toContainText(
        'Admin',
      );
      await page.getByRole('combobox', { name: 'Role' }).click();
      await page.getByRole('option', { name: 'Agent' }).click();
      await page.getByRole('button', { name: /save changes/i }).click();

      // The server's message reaches the user rather than being swallowed
      await expect(
        page.getByText('You cannot change your own role'),
      ).toBeVisible();

      // ...and nothing was persisted
      expect(await storedRole(page, self.id)).toBe(Role.admin);
    });

    test('should allow an admin to save their own profile with an unchanged role', async ({
      page,
    }) => {
      await loginAsAdmin(page);

      const me = await page.request.get('/api/me');
      const self = (await me.json()).user;

      // The guard is about *changing* your own role, not about touching your row
      const response = await page.request.put(`/api/users/${self.id}`, {
        data: {
          name: self.name,
          email: self.email,
          password: '',
          role: Role.admin,
        },
      });

      expect(response.status()).toBe(200);
      expect(await storedRole(page, self.id)).toBe(Role.admin);
    });
  });

  test.describe('Unknown user', () => {
    test('should return 404 for a role change against an unknown id', async ({
      page,
    }) => {
      await loginAsAdmin(page);

      const response = await page.request.put(
        `/api/users/${crypto.randomUUID()}`,
        {
          data: {
            name: 'Nobody At All',
            email: `nobody-${unique()}@example.com`,
            password: '',
            role: Role.admin,
          },
        },
      );

      expect(response.status()).toBe(404);
    });
  });
});
