import { test, expect } from '@playwright/test';

test('Logs panel collapse/expand on DesignerPage', async ({ page }) => {
  // Navigate to sample designer (replace 'test-agent' with a valid agentId)
  await page.goto('/flows/test-agent/designer');

  // Ensure logs toggle is visible
  const toggle = page.getByTestId('toggle-logs');
  await expect(toggle).toBeVisible();

  // Panel expanded by default
  await expect(page.getByTestId('logs-content')).toBeVisible();

  // Collapse and verify
  await toggle.click();
  await expect(page.getByTestId('logs-content')).toBeHidden();

  // Expand and verify
  await toggle.click();
  await expect(page.getByTestId('logs-content')).toBeVisible();
});
