import { test, expect } from 'playwright/test';
import { randomUUID } from 'node:crypto';

test('customer registers, signs in, deposits $25, and sees it after reload', async ({ page }) => {
  const email = `browser-${randomUUID()}@example.test`;
  const password = 'BrowserDemo!2026';
  const checking = page.getByRole('button', { name: /^CHECKING account / });
  const depositForm = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Deposit or withdraw', exact: true }),
  });

  await test.step('Create a new customer with a $0 balance', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New here? Create an account' }).click();
    await page.getByLabel('Full name', { exact: true }).fill('Browser Test Customer');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Account created.');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  await test.step('Sign in through the real login form', async () => {
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your accounts', exact: true })).toBeVisible();
    await checking.click();
    await expect(checking.locator('.account-balance')).toHaveText('$0.00');
  });

  await test.step('Deposit $25 and check the balance and history', async () => {
    await depositForm.getByLabel('Action', { exact: true }).selectOption('deposits');
    await depositForm.getByLabel('Amount (USD)', { exact: true }).fill('25.00');
    await depositForm.getByLabel('Description (optional)', { exact: true }).fill('Browser test deposit');
    await depositForm.getByRole('button', { name: 'Deposit funds', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Deposit completed.');
    await expect(checking.locator('.account-balance')).toHaveText('$25.00');
    await expect(page.getByRole('row').filter({ hasText: 'Browser test deposit' })).toContainText('+$25.00');
  });

  await test.step('Reload and verify the saved result comes back from the backend', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your accounts', exact: true })).toBeVisible();
    await checking.click();
    await expect(checking.locator('.account-balance')).toHaveText('$25.00');
    const row = page.getByRole('row').filter({ hasText: 'Browser test deposit' });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('cell').nth(2)).toHaveText('+$25.00');
    await expect(row.getByRole('cell').nth(3)).toHaveText('$25.00');
  });
});
