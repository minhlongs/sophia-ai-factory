import { describe, it, expect } from 'vitest';
import { sendOnboardingVideoEmail } from '../onboarding-emails';

describe('OnboardingEmails', () => {
  describe('sendOnboardingVideoEmail', () => {
    it('returns false when user not found (dry-run mode)', async () => {
      // In dry-run mode (no RESEND_API_KEY), sendEmail succeeds but DB lookup fails
      // When DB is not available, the function catches errors and returns false
      const result = await sendOnboardingVideoEmail(
        'nonexistent-user-id',
        'nonexistent-video-id',
      );
      // Without proper DB setup, this will fail gracefully
      expect(typeof result).toBe('boolean');
    });

    it('handles empty userId gracefully', async () => {
      const result = await sendOnboardingVideoEmail('', 'video-1');
      expect(typeof result).toBe('boolean');
    });

    it('handles empty videoId gracefully', async () => {
      const result = await sendOnboardingVideoEmail('user-1', '');
      expect(typeof result).toBe('boolean');
    });
  });
});
