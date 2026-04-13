/**
 * Onboarding E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/onboarding');
  });

  test('should display onboarding dashboard', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /onboarding/i })).toBeVisible();
  });

  test('should show onboarding tasks', async ({ page }) => {
    await expect(page.getByText(/tasks/i)).toBeVisible();
    const tasks = page.locator('[data-testid="onboarding-task"]');
    await expect(tasks.first()).toBeVisible();
  });

  test('should complete a task', async ({ page }) => {
    // Find first incomplete task
    const incompleteTask = page.locator('[data-testid="task-checkbox"]').first();
    await incompleteTask.click();
    
    // Should show as completed
    await expect(incompleteTask).toBeChecked();
  });

  test('should show onboarding progress', async ({ page }) => {
    await expect(page.getByText(/progress/i)).toBeVisible();
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
  });

  test('should navigate to employee profile', async ({ page }) => {
    await page.getByRole('link', { name: /view profile/i }).click();
    await expect(page).toHaveURL(/.*employees/);
  });
});
