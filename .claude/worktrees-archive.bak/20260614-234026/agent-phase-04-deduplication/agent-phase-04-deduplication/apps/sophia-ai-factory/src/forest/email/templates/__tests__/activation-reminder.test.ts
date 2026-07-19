/**
 * activation-reminder template tests — bilingual rendering + content invariants.
 */

import { describe, it, expect } from 'vitest';
import { renderActivationReminder } from '@/forest/email/templates/activation-reminder';

describe('renderActivationReminder', () => {
  const base = { ownerFullName: 'Alex', locale: 'en' as const };

  it('renders English subject mentioning "first AI video"', () => {
    const r = renderActivationReminder(base);
    expect(r.subject).toMatch(/first AI video/i);
    expect(r.html).toContain('Hello Alex');
    expect(r.html).toMatch(/3 simple steps/);
  });

  it('renders Vietnamese variant when locale starts with vi', () => {
    const r = renderActivationReminder({ ...base, locale: 'vi' });
    expect(r.subject).toMatch(/Tạo video AI đầu tiên/);
    expect(r.html).toContain('Xin chào Alex');
    expect(r.html).toMatch(/3 bước đơn giản/);
  });

  it('uses locale-correct dashboard URL', () => {
    expect(renderActivationReminder({ ...base, locale: 'en' }).html).toContain('/en/dashboard/videos/new');
    expect(renderActivationReminder({ ...base, locale: 'vi' }).html).toContain('/vi/dashboard/videos/new');
  });

  it('produces non-empty html, text, subject', () => {
    const r = renderActivationReminder(base);
    expect(r.html.length).toBeGreaterThan(200);
    expect(r.text.length).toBeGreaterThan(50);
    expect(r.subject.length).toBeGreaterThan(5);
  });

  it('strips HTML in text version', () => {
    const r = renderActivationReminder(base);
    expect(r.text).not.toMatch(/<[a-z]+[^>]*>/i);
  });
});
