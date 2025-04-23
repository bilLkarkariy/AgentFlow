import { test, expect } from '@playwright/test';

test.describe('HubSpot Auth E2E', () => {
  test('redirects to OAuth URL on Connect', async ({ page }) => {
    // Stub empty credentials
    await page.route('**/api/hubspot/credentials/*', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    );
    // Stub authorize endpoint
    await page.route('**/api/hubspot/authorize/*', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'http://fake-oauth' }),
      })
    );
    // Navigate to HubSpot page
    await page.goto('/agents/agent-1/hubspot');
    await expect(page.getByRole('button', { name: /Connect to HubSpot/i })).toBeVisible();
    // Click and verify redirect
    await page.click('button:has-text("Connect to HubSpot")');
    await expect(page).toHaveURL('http://fake-oauth');
  });

  test('shows Disconnect and removes credentials', async ({ page }) => {
    const creds = {
      id: '1',
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      scope: 'scope',
      agent: { id: 'agent-1' },
    };
    // Stub existing credentials
    await page.route('**/api/hubspot/credentials/*', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(creds),
      })
    );
    // Stub delete
    await page.route('**/api/hubspot/credentials/*', (route, request) => {
      if (request.method() === 'DELETE') {
        route.fulfill({ status: 200 });
      } else {
        route.continue();
      }
    });
    await page.goto('/agents/agent-1/hubspot');
    await expect(page.getByText(/Connected\./i)).toBeVisible();
    await page.click('button:has-text("Disconnect")');
    // After delete, stub fetch returns null
    await page.route('**/api/hubspot/credentials/*', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    );
    // Ensure Connect button reappears
    await expect(page.getByRole('button', { name: /Connect to HubSpot/i })).toBeVisible();
  });
});
