/**
 * Dashboard E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/hr');
  });

  test('should display dashboard title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should display key metrics', async ({ page }) => {
    await expect(page.getByText(/total employees/i)).toBeVisible();
    await expect(page.getByText(/on leave/i)).toBeVisible();
    await expect(page.getByText(/pending approvals/i)).toBeVisible();
  });

  test('should navigate to employees page', async ({ page }) => {
    await page.getByRole('link', { name: /employees/i }).click();
    await expect(page).toHaveURL(/.*employees/);
    await expect(page.getByRole('heading', { name: /employees/i })).toBeVisible();
  });
});
