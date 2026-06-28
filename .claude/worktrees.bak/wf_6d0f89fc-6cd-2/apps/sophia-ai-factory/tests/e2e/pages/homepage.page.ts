import { Page, Locator } from '@playwright/test';

export class Homepage {
  readonly page: Page;
  readonly navigation: Locator;
  readonly heroSection: Locator;
  readonly heroTitle: Locator;
  readonly heroSubtitle: Locator;
  readonly getStartedButton: Locator;
  readonly pricingLink: Locator;
  readonly localeSwitcher: Locator;
  readonly localeVi: Locator;
  readonly localeEn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navigation = page.locator('header, nav[aria-label="Main navigation"]');
    this.heroSection = page.locator('[data-testid="hero"], section.hero, [class*="hero"]');
    this.heroTitle = page.locator('h1, h1:has-text("Sophia")');
    this.heroSubtitle = page.locator('[data-testid="hero-subtitle"], .hero-subtitle, h1 + p');
    this.getStartedButton = page.locator('a[href*="setup"], a[href*="signup"], button:has-text("Get Started"), a:has-text("Get Started")');
    this.pricingLink = page.locator('a[href*="pricing"]:visible, button:has-text("Pricing")');
    this.localeSwitcher = page.locator('[data-testid="locale-switcher"], select[name="locale"], [aria-label*="language"]');
    this.localeVi = page.locator('a[href="/vi"], button:has-text("VI")');
    this.localeEn = page.locator('a[href="/en"], button:has-text("EN")');
  }

  async navigate() {
    await this.page.goto('/');
  }

  async getTitle() {
    return await this.page.title();
  }

  async isVisible() {
    return await this.navigation.isVisible();
  }

  async clickGetStarted() {
    await this.getStartedButton.click();
  }

  async clickPricing() {
    await this.pricingLink.click();
  }

  async switchToVietnamese() {
    await this.localeVi.click();
  }

  async switchToEnglish() {
    await this.localeEn.click();
  }

  async getLocale() {
    const url = this.page.url();
    if (url.includes('/vi')) return 'vi';
    if (url.includes('/en')) return 'en';
    return 'root';
  }
}
