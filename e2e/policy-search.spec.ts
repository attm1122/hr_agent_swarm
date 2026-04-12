/**
 * Policy Search E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Policy Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/knowledge');
  });

  test('should display knowledge base', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /knowledge|policies/i })).toBeVisible();
  });

  test('should search policies', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search policies/i);
    await searchInput.fill('annual leave');
    await searchInput.press('Enter');
    
    // Should show search results
    await expect(page.locator('[data-testid="policy-result"]').first()).toBeVisible();
    await expect(page.getByText(/annual leave/i)).toBeVisible();
  });

  test('should view policy document', async ({ page }) => {
    // Click on first policy
    await page.locator('[data-testid="policy-card"]').first().click();
    
    // Should show policy details
    await expect(page.getByRole('heading')).toBeVisible();
    await expect(page.locator('[data-testid="policy-content"]')).toBeVisible();
  });

  test('should show policy categories', async ({ page }) => {
    await expect(page.getByText(/categories/i)).toBeVisible();
    await expect(page.getByText(/leave|compliance|hr/i)).toBeVisible();
  });

  test('should show related policies', async ({ page }) => {
    await page.locator('[data-testid="policy-card"]').first().click();
    await expect(page.getByText(/related|see also/i)).toBeVisible();
  });
});
