import { describe, it, expect } from 'vitest';
import {
  welcomeEmail,
  missionCompleteEmail,
  trialEndingEmail,
  invoiceEmail,
  magicLinkEmail,
} from '@/lib/email/email-templates';

describe('Email Templates', () => {
  it('generates welcome email with customer data', () => {
    const html = welcomeEmail('Alice', 'Growth', 2000);
    expect(html).toContain('Alice');
    expect(html).toContain('Growth');
    expect(html).toContain('2,000 MCU');
    expect(html).toContain('Quick Start');
    expect(html).toContain('dashboard/missions/new');
  });

  it('generates mission complete email', () => {
    const html = missionCompleteEmail('Bob', 'msn_123', 'proposal:create', 'Proposal generated');
    expect(html).toContain('Bob');
    expect(html).toContain('msn_123');
    expect(html).toContain('proposal:create');
    expect(html).toContain('Proposal generated');
    expect(html).toContain('View Results');
  });

  it('generates trial ending email with day count', () => {
    const html3 = trialEndingEmail('Carol', 3);
    expect(html3).toContain('3 days');
    expect(html3).toContain('Upgrade Now');

    const html1 = trialEndingEmail('Carol', 1);
    expect(html1).toContain('1 day');
  });

  it('generates invoice email', () => {
    const html = invoiceEmail('Dave', '$149.00', 'Growth', '2026-03-25');
    expect(html).toContain('Dave');
    expect(html).toContain('$149.00');
    expect(html).toContain('Growth');
    expect(html).toContain('2026-03-25');
    expect(html).toContain('Payment Confirmed');
  });

  it('generates magic link email with token', () => {
    const html = magicLinkEmail('abc123token');
    expect(html).toContain('abc123token');
    expect(html).toContain('Sign In');
    expect(html).toContain('15 minutes');
  });

  it('all templates include footer branding', () => {
    const templates = [
      welcomeEmail('Test', 'Starter', 500),
      missionCompleteEmail('Test', 'id', 'cmd', 'summary'),
      trialEndingEmail('Test', 7),
      invoiceEmail('Test', '$49', 'Starter', '2026-01-01'),
      magicLinkEmail('token'),
    ];
    for (const html of templates) {
      expect(html).toContain('Sophia AI Factory');
      expect(html).toContain('sophia.ai');
    }
  });
});
