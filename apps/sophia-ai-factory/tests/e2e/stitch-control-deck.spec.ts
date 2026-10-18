import { test, expect } from '@playwright/test';

test.describe("Stitch v4.2 Director's Control Deck & Phase 2 Routes E2E", () => {
  test('renders 18-screen Control Deck Hub with WAI-ARIA tablist, bilingual toggle, and 1-Click Council Dispatch', async ({
    page,
  }) => {
    await page.goto('/en/dashboard/control-deck');

    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(18);
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');

    // Keyboard navigation across tabs
    await tabs.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');

    // Trigger Half-Kelly MCU Rebalance Server Action
    const rebalanceBtn = page.getByTestId('rebalance-half-kelly-btn');
    await expect(rebalanceBtn).toBeVisible();
    await rebalanceBtn.click();

    const rebalanceReceipt = page.getByTestId('rebalance-half-kelly-receipt');
    await expect(rebalanceReceipt).toBeVisible();

    // Trigger 1-Click Approve & Dispatch Server Action
    const dispatchBtn = page.getByTestId('dispatch-advisor-council-btn');
    await expect(dispatchBtn).toBeVisible();
    await dispatchBtn.click();

    const receipt = page.getByTestId('dispatch-advisor-council-receipt');
    await expect(receipt).toBeVisible();
    await expect(receipt).toContainText('MSN-STITCH-ASKADVISORS-1000');

    // Toggle bilingual mode to Vietnamese
    const langBtn = page.getByRole('button', {
      name: /Switch to Vietnamese/i,
    });
    await langBtn.click();
    await expect(
      page.getByRole('heading', { name: /Hướng A — Bàn Chỉ Huy Đạo Diễn/i }),
    ).toBeVisible();
  });

  test('renders interactive Stitch v4.2 ROI & Editor Savings Calculator on /vi/pricing', async ({
    page,
  }) => {
    await page.goto('/vi/pricing');

    const calculator = page.getByTestId('stitch-pricing-roi-calculator');
    await expect(calculator).toBeVisible();
    await expect(calculator).toContainText('NOWPAYMENTS USDT');
  });

  test('enforces zero horizontal overflow and >= 44px touch targets across 375x812, 768x1024, and 1440x900 viewports', async ({
    page,
  }) => {
    const viewports = [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ] as const;

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.goto('/en/dashboard/control-deck');
      const firstTab = page.getByRole('tab').first();
      await expect(firstTab).toBeVisible();

      const controlDeckNoOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(controlDeckNoOverflow).toBe(true);

      for (const target of [
        firstTab,
        page.getByTestId('rebalance-half-kelly-btn'),
        page.getByTestId('dispatch-advisor-council-btn'),
      ]) {
        const box = await target.boundingBox();
        expect(box).not.toBeNull();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }

      await page.goto('/vi/pricing');
      const calculator = page.getByTestId('stitch-pricing-roi-calculator');
      await expect(calculator).toBeVisible();

      const pricingNoOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(pricingNoOverflow).toBe(true);

      const sliderBox = await calculator.getByRole('slider').boundingBox();
      expect(sliderBox).not.toBeNull();
      expect(sliderBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
