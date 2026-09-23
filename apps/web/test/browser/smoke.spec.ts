import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith('/protocol') ? { network: 'GenLayer Studio Dev', chain_id: 61997, paused: false, resolver_enabled: true, versions: { registry: 'evidra-registry-v1' } } : url.pathname.endsWith('/facts') ? { items: [], page: { total: 0 } } : url.pathname.endsWith('/stats') ? { stats: { resolution_count: '0' } } : url.pathname.endsWith('/activity') ? { items: [], page: { total: 0 } } : url.pathname.endsWith('/policies') ? { items: [], page: { total: 0 } } : url.pathname.endsWith('/templates') ? { items: [], page: { total: 0 } } : { ok: true };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
});

test('landing and docs are navigable without wallet state', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Consensus for facts/i })).toBeVisible();
  await page.getByRole('link', { name: 'Read docs' }).click();
  await expect(page.getByRole('heading', { name: /readable path/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test('fact registry and create wizard render on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/facts');
  await expect(page.getByRole('heading', { name: 'Fact registry' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  await page.goto('/app/create');
  await expect(page.getByRole('heading', { name: 'Create fact' })).toBeVisible();
  await expect(page.getByLabel('Subject')).toBeVisible();
});
