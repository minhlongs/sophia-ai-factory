import { Page, Locator } from '@playwright/test';

export class AdminPage {
  readonly page: Page;
  readonly adminNav: Locator;
  readonly usersTab: Locator;
  readonly alertsTab: Locator;
  readonly analyticsTab: Locator;
  readonly systemHealthTab: Locator;
  readonly auditLogsTab: Locator;
  readonly userSearchInput: Locator;
  readonly searchButton: Locator;
  readonly userTable: Locator;
  readonly systemHealthStatus: Locator;
  readonly auditLogsTable: Locator;
  readonly activeUsersCard: Locator;
  readonly systemUptime: Locator;
  readonly recentActivity: Locator;

  constructor(page: Page) {
    this.page = page;
    this.adminNav = page.locator('[data-testid="admin-nav"], nav[aria-label="Admin"], [data-testid="admin-sidebar"]');
    this.usersTab = page.locator('a[href="/admin/users"]:has-text("Users"), button:has-text("Users")');
    this.alertsTab = page.locator('a[href="/admin/alerts"]:has-text("Alerts"), button:has-text("Alerts")');
    this.analyticsTab = page.locator('a[href="/admin/analytics"]:has-text("Analytics"), button:has-text("Analytics")');
    this.systemHealthTab = page.locator('a[href="/admin/health"]:has-text("System Health"), button:has-text("System Health")');
    this.auditLogsTab = page.locator('a[href="/admin/audit"]:has-text("Audit Logs"), button:has-text("Audit Logs")');
    this.userSearchInput = page.locator('input[placeholder*="Search"], input[name*="search"], input[aria-label*="search"]');
    this.searchButton = page.locator('button[type="submit"]:has-text("Search"), button:has-text("Search"), [type="submit"]');
    this.userTable = page.locator('[data-testid="user-table"], table:has-text("Email"), [data-testid="users-list"]');
    this.systemHealthStatus = page.locator('[data-testid="health-status"], [data-testid="system-status"]');
    this.auditLogsTable = page.locator('[data-testid="audit-table"], table:has-text("Action"), [data-testid="audit-logs"]');
    this.activeUsersCard = page.locator('[data-testid="active-users"], [data-testid="stat-active-users"]');
    this.systemUptime = page.locator('[data-testid="system-uptime"], [data-testid="stat-uptime"]');
    this.recentActivity = page.locator('[data-testid="recent-activity"], [data-testid="activity-feed"]');
  }

  async navigate() {
    await this.page.goto('/admin');
  }

  async isVisible() {
    return await this.adminNav.isVisible();
  }

  async searchUser(query: string) {
    await this.userSearchInput.fill(query);
    await this.searchButton.click();
  }

  async getUserCount() {
    const rows = this.userTable.locator('tbody tr');
    return await rows.count();
  }

  async getSystemHealth() {
    return await this.systemHealthStatus.textContent();
  }

  async getAuditLogCount() {
    const rows = this.auditLogsTable.locator('tbody tr');
    return await rows.count();
  }

  async switchTab(tabName: 'users' | 'alerts' | 'analytics' | 'health' | 'audit') {
    let tab: Locator;
    switch (tabName) {
      case 'users':
        tab = this.usersTab;
        break;
      case 'alerts':
        tab = this.alertsTab;
        break;
      case 'analytics':
        tab = this.analyticsTab;
        break;
      case 'health':
        tab = this.systemHealthTab;
        break;
      case 'audit':
        tab = this.auditLogsTab;
        break;
    }
    await tab.click();
  }
}
