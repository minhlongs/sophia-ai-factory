/**
 * win-back template tests — bilingual + discount conditional.
 */

import { describe, it, expect } from 'vitest';
import { renderWinBack } from '@/forest/email/templates/win-back';

describe('renderWinBack', () => {
  const base = {
    ownerFullName: 'Alex',
    locale: 'en' as const,
    cancelledAt: '2026-03-10',
  };

  it('renders English subject without discount', () => {
    const r = renderWinBack(base);
    expect(r.subject).toMatch(/miss you/i);
    expect(r.html).toContain('Hello Alex');
    expect(r.html).toMatch(/Subscription cancelled on 2026-03-10/);
    expect(r.html).not.toMatch(/special code/i);
  });

  it('renders English subject with discount when both fields provided', () => {
    const r = renderWinBack({ ...base, discountCode: 'COMEBACK30', discountPercent: 30 });
    expect(r.subject).toMatch(/30%\s*off/i);
    expect(r.html).toContain('COMEBACK30');
    expect(r.html).toMatch(/30% off your first month/i);
  });

  it('does NOT include discount block if only one of code/percent provided', () => {
    const r = renderWinBack({ ...base, discountCode: 'COMEBACK30' });
    expect(r.html).not.toContain('COMEBACK30');
  });

  it('renders Vietnamese variant when locale starts with vi', () => {
    const r = renderWinBack({ ...base, locale: 'vi' });
    expect(r.subject).toMatch(/Chúng tôi nhớ bạn|Quay lại Sophia/);
    expect(r.html).toContain('Xin chào Alex');
  });

  it('embeds UTM-tagged pricing URL', () => {
    const r = renderWinBack(base);
    expect(r.html).toMatch(/pricing\?utm_source=email&utm_campaign=winback&utm_medium=lifecycle/);
  });

  it('strips HTML in text version', () => {
    const r = renderWinBack(base);
    expect(r.text).not.toMatch(/<[a-z]+[^>]*>/i);
  });
});
