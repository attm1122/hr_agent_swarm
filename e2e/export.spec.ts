/**
 * Export E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reports');
  });

  test('should display reports page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /reports|export/i })).toBeVisible();
  });

  test('should request employee export', async ({ page }) => {
    // Select export type
    await page.getByLabel(/export type/i).click();
    await page.getByRole('option', { name: /employees/i }).click();
    
    // Select format
    await page.getByLabel(/format/i).click();
    await page.getByRole('option', { name: /csv/i }).click();
    
    // Request export
    await page.getByRole('button', { name: /export|download/i }).click();
    
    // Should show confirmation or approval required
    await expect(page.getByText(/export requested|pending approval/i)).toBeVisible();
  });

  test('should show export approval workflow', async ({ page }) => {
    // Request sensitive export
    await page.getByLabel(/export type/i).click();
    await page.getByRole('option', { name: /employees/i }).click();
    
    // Select sensitive fields
    await page.getByLabel(/include salary/i).check();
    
    await page.getByRole('button', { name: /export/i }).click();
    
    // Should require approval
    await expect(page.getByText(/approval required/i)).toBeVisible();
    await expect(page.getByText(/pending/i)).toBeVisible();
  });

  test('should list pending approvals', async ({ page }) => {
    // Navigate to approvals
    await page.goto('/approvals');
    
    await expect(page.getByRole('heading', { name: /approvals/i })).toBeVisible();
    await expect(page.getByText(/pending|awaiting approval/i)).toBeVisible();
  });

  test('should approve an export request', async ({ page }) => {
    // As approver, go to approvals
    await page.goto('/approvals');
    
    // Find export approval
    const approvalCard = page.locator('[data-testid="approval-card"]').first();
    await expect(approvalCard).toBeVisible();
    
    // Approve
    await approvalCard.getByRole('button', { name: /approve/i }).click();
    
    // Should show success
    await expect(page.getByText(/approved|export ready/i)).toBeVisible();
  });

  test('should download exported file', async ({ page }) => {
    // Start waiting for download before clicking
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /download export/i }).click(),
    ]);
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});
