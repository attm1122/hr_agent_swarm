/**
 * Leave Management E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Leave Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leave');
  });

  test('should display leave dashboard', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /leave/i })).toBeVisible();
    await expect(page.getByText(/balance/i)).toBeVisible();
  });

  test('should submit leave request', async ({ page }) => {
    // Open new request form
    await page.getByRole('button', { name: /request leave/i }).click();
    
    // Fill form
    await page.getByLabel(/start date/i).fill('2024-12-25');
    await page.getByLabel(/end date/i).fill('2024-12-27');
    await page.getByLabel(/type/i).click();
    await page.getByRole('option', { name: /annual leave/i }).click();
    await page.getByLabel(/reason/i).fill('Christmas holiday');
    
    // Submit
    await page.getByRole('button', { name: /submit/i }).click();
    
    // Should show success message
    await expect(page.getByText(/submitted successfully/i)).toBeVisible();
  });

  test('should display leave balance', async ({ page }) => {
    await expect(page.getByText(/annual leave/i)).toBeVisible();
    await expect(page.getByText(/sick leave/i)).toBeVisible();
    
    // Should show remaining days
    const balanceCards = page.locator('[data-testid="leave-balance"]');
    await expect(balanceCards.first()).toContainText(/days remaining/i);
  });

  test('should show leave history', async ({ page }) => {
    await expect(page.getByText(/history|previous requests/i)).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });
});
