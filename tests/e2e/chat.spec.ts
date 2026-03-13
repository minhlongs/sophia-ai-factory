import { test, expect } from '@playwright/test';

test.describe('Sophia AI Factory - Chat Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
  });

  test('should display chat page', async ({ page }) => {
    await expect(page).toHaveURL(/.*chat.*/);
  });

  test('should have chat input', async ({ page }) => {
    const chatInput = page.getByRole('textbox', { name: /message|input|type/i });
    await expect(chatInput).toBeVisible();
  });

  test('should have send button', async ({ page }) => {
    const sendButton = page.getByRole('button', { name: /send/i });
    await expect(sendButton).toBeVisible();
  });
});
