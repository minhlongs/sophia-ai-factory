/**
 * Email Template Tests — One-Time Bundle Ready
 * Bilingual (Vi/En), credit balance, cross-sell CTA
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest'
import {
  buildOneTimeBundleReadyEmail,
  type OneTimeBundleReadyContext,
} from '../templates/one-time-bundle-ready'

describe('buildOneTimeBundleReadyEmail — one-time bundle ready notification', () => {
  describe('Vietnamese (vi) locale', () => {
    it('subject in Vietnamese', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 8,
        locale: 'vi',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.subject).toContain('[Sophia AI]')
      expect(email.subject).toContain('sẵn sàng')
    })

    it('text body contains Vietnamese content', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 7,
        locale: 'vi-VN',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.text).toContain('Video AI')
      expect(email.text).toContain('Gói Khởi Đầu')
      expect(email.text).toContain('Số credits còn lại: 7')
      expect(email.text).toContain('Nâng cấp lên gói hàng tháng')
    })

    it('HTML body contains Vietnamese labels + credit balance', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 5,
        videoUrl: 'https://example.com/video.mp4',
        locale: 'vi',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.html).toContain('5')
      expect(email.html).toContain('Credits còn lại')
      expect(email.html).toContain('Xem video')
      expect(email.html).toContain('https://example.com/video.mp4')
    })

    it('HTML includes cross-sell CTA with pricing URL', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 10,
        locale: 'vi',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.html).toContain('Muốn tạo video không giới hạn')
      expect(email.html).toContain('pricing')
      expect(email.html).toContain('sophia.agencyos.network')
    })

    it('HTML lang attribute is vi', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 10,
        locale: 'vi',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.html).toContain('lang="vi"')
    })
  })

  describe('English (en) locale', () => {
    it('subject in English', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 8,
        locale: 'en',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.subject).toContain('[Sophia AI]')
      expect(email.subject).toContain('ready')
    })

    it('text body contains English content', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 6,
        locale: 'en-US',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.text).toContain('AI video')
      expect(email.text).toContain('Starter Bundle')
      expect(email.text).toContain('Credits remaining: 6')
      expect(email.text).toContain('Upgrade to a monthly plan')
    })

    it('HTML body contains English labels + credit balance', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 3,
        videoUrl: 'https://example.com/video-en.mp4',
        locale: 'en',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.html).toContain('3')
      expect(email.html).toContain('Credits remaining')
      expect(email.html).toContain('Watch video')
      expect(email.html).toContain('https://example.com/video-en.mp4')
    })

    it('HTML includes cross-sell CTA in English', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 10,
        locale: 'en',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.html).toContain('Want unlimited videos')
      expect(email.html).toContain('See monthly plans')
    })

    it('HTML lang attribute is en', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 10,
        locale: 'en',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.html).toContain('lang="en"')
    })
  })

  describe('Edge cases + defaults', () => {
    it('default locale (no locale specified) → Vi', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 10,
        // locale undefined
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      // Should default to Vi content
      expect(email.subject).toContain('sẵn sàng')
      expect(email.html).toContain('lang="vi"')
    })

    it('no videoUrl: omits watch video button', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 10,
        videoUrl: null,
        locale: 'en',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      // Should NOT contain watch button
      expect(email.html).not.toContain('Watch video')
      expect(email.html).not.toContain('videoUrl')
    })

    it('zero credits remaining: still displays', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 0,
        locale: 'en',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.html).toContain('0')
      expect(email.html).toContain('Credits remaining')
    })

    it('large credit count: interpolates correctly', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 999,
        locale: 'vi',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.html).toContain('999')
    })

    it('HTML contains proper structure (DOCTYPE, meta, head, body)', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 10,
        locale: 'en',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.html).toContain('<!DOCTYPE html>')
      expect(email.html).toContain('<head>')
      expect(email.html).toContain('<body')
      expect(email.html).toContain('UTF-8')
    })

    it('email contains support contact', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 10,
        locale: 'en',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.text).toContain('support@sophia.agencyos.network')
      expect(email.html).toContain('support@sophia.agencyos.network')
    })

    it('dashboard URL points to /dashboard/videos', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 10,
        locale: 'en',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.html).toContain('/dashboard/videos')
      expect(email.text).toContain('/dashboard/videos')
    })

    it('pricing URL points to /pricing', () => {
      const ctx: OneTimeBundleReadyContext = {
        userEmail: 'user@example.com',
        userId: 'user1',
        purchaseId: 'purchase_123',
        creditsRemaining: 10,
        locale: 'en',
      }

      const email = buildOneTimeBundleReadyEmail(ctx)

      expect(email.html).toContain('/pricing')
      expect(email.text).toContain('/pricing')
    })
  })
})
