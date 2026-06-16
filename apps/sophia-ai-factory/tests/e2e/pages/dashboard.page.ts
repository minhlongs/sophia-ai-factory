import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly overviewTab: Locator;
  readonly campaignsTab: Locator;
  readonly settingsTab: Locator;
  readonly userMenu: Locator;
  readonly signOutButton: Locator;
  readonly userAvatar: Locator;
  readonly userName: Locator;
  readonly quickActions: Locator;
  readonly metricsSection: Locator;
  readonly earningsCard: Locator;
  readonly campaignsCard: Locator;
  readonly conversionsCard: Locator;
  readonly revenueCard: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('[data-testid="sidebar"], aside, nav[aria-label="Dashboard sidebar"]');
    this.overviewTab = page.locator('a[href="/dashboard"]:has-text("Overview"), button:has-text("Overview")');
    this.campaignsTab = page.locator('a[href="/dashboard/campaigns"]:has-text("Campaigns"), a[href*="campaign"]');
    this.settingsTab = page.locator('a[href="/dashboard/settings"]:has-text("Settings"), button:has-text("Settings")');
    this.userMenu = page.locator('[data-testid="user-menu"], button[aria-label="User menu"], [data-testid="user-avatar"]');
    this.signOutButton = page.locator('button:has-text("Sign Out"), a:has-text("Sign out"), button:has-text("Đăng xuất")');
    this.userAvatar = page.locator('[data-testid="user-avatar"], img[alt*="avatar"], .avatar img');
    this.userName = page.locator('[data-testid="user-name"], [data-testid="user-info"] span, .user-name');
    this.quickActions = page.locator('[data-testid="quick-actions"], [data-testid="action-buttons"]');
    this.metricsSection = page.locator('[data-testid="metrics"], [data-testid="dashboard-stats"]');
    this.earningsCard = page.locator('[data-testid="metric-earnings"], [data-testid="earnings-card"]');
    this.campaignsCard = page.locator('[data-testid="metric-campaigns"], [data-testid="campaigns-card"]');
    this.conversionsCard = page.locator('[data-testid="metric-conversions"], [data-testid="conversions-card"]');
    this.revenueCard = page.locator('[data-testid="metric-revenue"], [data-testid="revenue-card"]');
  }

  async navigate() {
    await this.page.goto('/dashboard');
  }

  async isVisible() {
    return await this.sidebar.isVisible();
  }

  async signOut() {
    await this.userMenu.click();
    await this.signOutButton.click();
  }

  async getUserName() {
    return await this.userName.textContent();
  }

  async getMetrics() {
    const metrics = {
      earnings: await this.earningsCard.textContent(),
      campaigns: await this.campaignsCard.textContent(),
      conversions: await this.conversionsCard.textContent(),
      revenue: await this.revenueCard.textContent(),
    };
    return metrics;
  }

  async clickQuickAction(action: string) {
    const button = this.quickActions.locator(`button:has-text("${action}"), a:has-text("${action}")`);
    await button.click();
  }
}
