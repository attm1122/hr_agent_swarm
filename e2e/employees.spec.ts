/**
 * Employee Management E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Employee Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/employees');
  });

  test('should display employee list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /employees/i })).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('should search employees', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('Alice');
    await searchInput.press('Enter');
    
    // Should show filtered results
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    await expect(page.getByText('Alice')).toBeVisible();
  });

  test('should view employee details', async ({ page }) => {
    // Click on first employee
    await page.locator('table tbody tr').first().click();
    
    // Should navigate to detail page
    await expect(page).toHaveURL(/.*employees\/.+/);
    await expect(page.getByText(/employee details/i)).toBeVisible();
  });

  test('should filter by status', async ({ page }) => {
    await page.getByLabel(/status/i).click();
    await page.getByRole('option', { name: /active/i }).click();
    
    // All visible employees should be active
    const rows = page.locator('table tbody tr');
    for (let i = 0; i < await rows.count(); i++) {
      await expect(rows.nth(i).locator('td').last()).toContainText(/active/i);
    }
  });
});
