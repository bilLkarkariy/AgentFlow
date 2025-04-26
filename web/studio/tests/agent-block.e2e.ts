import { test, expect } from '@playwright/test';

test.describe('Agent Block Node E2E', () => {
  test('should add Agent Block, simulate prompt and display result', async ({ page }) => {
    // Stub flow load
    await page.route('**/agents/*/flow', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nodes: [], edges: [] }),
      })
    );
    // Stub run endpoint
    await page.route('**/run', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: 'OK' }),
      })
    );

    await page.goto('/agents/agent-1/designer');
    // Wait for React Flow to initialize
    await page.waitForSelector('.reactflow-wrapper', { state: 'attached' });

    // Add Agent Block and wait for prompt textarea
    await page.click('text=Agent Block');
    await page.waitForSelector('textarea[placeholder="Enter prompt..."]', { state: 'visible' });
    const textarea = page.getByPlaceholder('Enter prompt...');
    await expect(textarea).toBeVisible();

    // Enter prompt
    await textarea.fill('Hello');

    // Simulate and verify result
    await page.click('button:has-text("Simulate")');
    await expect(page.getByText('OK')).toBeVisible();
  });

  test('shows validation error on empty prompt', async ({ page }) => {
    // Stub flow load
    await page.route('**/agents/*/flow', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nodes: [], edges: [] }) })
    );
    await page.goto('/agents/agent-1/designer');
    // Wait for React Flow to initialize
    await page.waitForSelector('.reactflow-wrapper', { state: 'attached' });
    // Add Agent Block
    await page.click('text=Agent Block');
    await page.waitForSelector('textarea[placeholder="Enter prompt..."]', { state: 'visible' });
    const textarea = page.getByPlaceholder('Enter prompt...');
    await expect(textarea).toBeVisible();

    // Simulate without entering prompt
    await page.click('button:has-text("Simulate")');
    await expect(page.getByText(/Prompt is required/i)).toBeVisible();
  });

  test('shows error message on network failure', async ({ page }) => {
    // Stub flow load
    await page.route('**/agents/*/flow', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nodes: [], edges: [] }) })
    );
    // Stub run endpoint failure
    await page.route('**/run', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: 'Internal Error' })
    );
    await page.goto('/agents/agent-1/designer');
    // Wait for React Flow to initialize
    await page.waitForSelector('.reactflow-wrapper', { state: 'attached' });
    await page.click('text=Agent Block');
    await page.waitForSelector('textarea[placeholder="Enter prompt..."]', { state: 'visible' });
    const textarea = page.getByPlaceholder('Enter prompt...');
    await textarea.fill('Hello');
    await page.click('button:has-text("Simulate")');
    await expect(page.getByText(/Internal Error|Request failed/i)).toBeVisible();
  });

  test('matches visual snapshot after simulation', async ({ page }) => {
    // Stub flow and run
    await page.route('**/agents/*/flow', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nodes: [], edges: [] }) })
    );
    await page.route('**/run', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'SNAP' }) })
    );
    await page.goto('/agents/agent-1/designer');
    // Wait for React Flow to initialize
    await page.waitForSelector('.reactflow-wrapper', { state: 'attached' });
    await page.click('text=Agent Block');
    await page.waitForSelector('textarea[placeholder="Enter prompt..."]', { state: 'visible' });
    const textareaSnap = page.getByPlaceholder('Enter prompt...');
    await textareaSnap.fill('Snap');
    await page.click('button:has-text("Simulate")');
    const node = page.locator('div.bg-white.p-3.rounded.shadow.w-48');
    await expect(node).toBeVisible();
    await expect(node).toHaveScreenshot('agent-block-node.png');
  });
});
