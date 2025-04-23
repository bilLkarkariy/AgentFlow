import { test, expect } from '@playwright/test';

// HubSpot authentication E2E tests

test.describe('HubSpot Auth E2E', () => {
  test('redirects to OAuth URL on Connect', async ({ page }) => {
    await page.route('**/api/hubspot/credentials/*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) }),
    );

    await page.route('**/api/hubspot/authorize/*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: '/fake-oauth' }) }),
    );

    await page.goto('/agents/agent-1/hubspot');
    await expect(page.getByRole('button', { name: /Connect to HubSpot/i })).toBeVisible();

    await page.click('button:has-text("Connect to HubSpot")');
    // should navigate within the same origin to /fake-oauth
    await expect(page).toHaveURL(/.*\/fake-oauth$/);
  });

  test('shows Disconnect and removes credentials', async ({ page }) => {
    const creds = { id: '1', accessToken: 'tok', refreshToken: 'ref', expiresAt: new Date(Date.now() + 3600 * 1e3).toISOString(), scope: 's', agent: { id: 'agent-1' } };

    await page.route('**/api/hubspot/credentials/*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(creds) }),
    );

    await page.route('**/api/hubspot/credentials/*', (route, request) => {
      if (request.method() === 'DELETE') route.fulfill({ status: 200 });
      else route.continue();
    });

    await page.goto('/agents/agent-1/hubspot');
    await expect(page.getByText(/Connected\./i)).toBeVisible();
    await page.click('button:has-text("Disconnect")');

    await page.route('**/api/hubspot/credentials/*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) }),
    );
    await expect(page.getByRole('button', { name: /Connect to HubSpot/i })).toBeVisible();
  });
});
