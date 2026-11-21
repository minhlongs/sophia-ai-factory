import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '../../../../../../../messages/en.json';
import vietnamese from '../../../../../../../messages/vi.json';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';
import TermsPage from '@/app/[locale]/terms/page';
import { getLocale } from 'next-intl/server';
import { PaidPilotBanner } from '../paid-pilot-banner';

vi.mock('next-intl/server', () => ({ getLocale: vi.fn() }));

const translations = en.stitch.pricingPage.paidPilot;

function renderBanner(props: React.ComponentProps<typeof PaidPilotBanner> = {}, locale: 'en' | 'vi' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'vi' ? vietnamese : en}>
      <PaidPilotBanner {...props} />
    </NextIntlClientProvider>,
  );
}

vi.mock('@/seed/security/use-csrf-token', () => ({
  useCsrfToken: () => ({ 'x-csrf-token': 'csrf-pilot-token' }),
  getCsrfHeaders: () => ({ 'x-csrf-token': 'csrf-pilot-token' }),
}));

describe('PaidPilotBanner', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('renders an initially unchecked consent checkbox and version/hash', () => {
    renderBanner();
    const checkbox = screen.getByRole('checkbox', { name: translations.agreementCheckbox });
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(new RegExp(OPTION_A_PILOT_CONTRACT.termsVersion))).toBeDefined();
    expect(screen.getByRole('button', { name: translations.cta })).toHaveProperty('disabled', true);
  });

  it('submits explicit offline consent and never redirects to a provider', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'pending_manual_payment', paymentMethod: 'offline_bank_transfer', orderId: 'pilot-1', amountVnd: 1990000, transferReference: 'PILOT-1', supportEmail: 'support@mekongmind.com', bankInstructions: { configured: true, bankName: 'Bank', accountNumber: '123', accountHolder: 'Holder', transferMemo: 'PILOT-1' } }) });
    const onRedirect = vi.fn();
    renderBanner({ onRedirect });
    fireEvent.click(screen.getByRole('checkbox', { name: translations.agreementCheckbox }));
    fireEvent.click(screen.getByRole('button', { name: translations.cta }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({ tier: 'BASIC', period: 'pilot_14d', paymentMethod: 'offline_bank_transfer', agreement: { accepted: true, version: OPTION_A_PILOT_CONTRACT.termsVersion, hash: OPTION_A_PILOT_CONTRACT.termsHash, locale: 'en', channel: 'pricing_banner' } });
    expect(onRedirect).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toBeDefined();
  });

  it('does not submit when consent is unchecked', () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: translations.cta }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});


describe('pilot Terms', () => {
  it.each([
    ['en', 'Pending Final Legal Counsel Review', 'manual bank transfer only'],
    ['vi', 'đang chờ luật sư rà soát chính thức', 'chỉ dùng chuyển khoản ngân hàng thủ công'],
  ] as const)('publishes the current draft and bank-only policy in %s', async (locale, legal, bank) => {
    vi.mocked(getLocale).mockResolvedValue(locale);
    const { container } = render(await TermsPage());
    expect(container.textContent).toContain(OPTION_A_PILOT_CONTRACT.termsVersion);
    expect(container.textContent).toContain(legal);
    expect(container.textContent).toContain(bank);
    expect(container.textContent).toContain(OPTION_A_PILOT_CONTRACT.supportEmail);
  });
});
