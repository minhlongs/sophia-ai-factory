import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly socialButtons: Locator;
  readonly googleButton: Locator;
  readonly errorMessage: Locator;
  readonly magicLinkToggle: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]');
    this.passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="password"]');
    this.submitButton = page.locator('button[type="submit"], button:has-text(/đăng nhập|login|sign in/i)');
    this.socialButtons = page.locator('[data-testid="social-auth"], [class*="social"] button');
    this.googleButton = page.locator('button:has-text("Google"), [data-testid="google-signin"]');
    this.errorMessage = page.locator('[data-testid="error-message"], [role="alert"], .error, .text-error');
    this.magicLinkToggle = page.locator('button:has-text(/magic link|link đăng nhập/i), [data-testid="magic-link-toggle"]');
    this.forgotPasswordLink = page.locator('a:has-text(/forgot|quên mật khẩu/i), [href*="reset"]');
  }

  async navigate() {
    await this.page.goto('/vi/login');
  }

  async isVisible() {
    return await this.emailInput.isVisible();
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async hasError() {
    return await this.errorMessage.isVisible();
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }

  async toggleMagicLink() {
    await this.magicLinkToggle.click();
  }

  async isPasswordMode() {
    return await this.passwordInput.isVisible();
  }
}