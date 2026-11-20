import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import vietnamese from '../../messages/vi.json';
import { OPTION_A_PILOT_COPY } from '@/seed/config/tiers/option-a-pilot-contract';
import { LandingHeroView } from '@/components/stitch/screens/landing-hero/modular/landing-hero-view';
import { RefundPolicyBanner } from '@/forest/components/pricing/section/refund-policy-banner';
import { ReviewStep, type ReviewStepProps } from '@/tree/components/setup-wizard/steps/review-step';

afterEach(cleanup);

const config: ReviewStepProps['config'] = {
  OPENROUTER_API_KEY: 'test-openrouter-key',
  ANTHROPIC_API_KEY: '',
  ELEVENLABS_API_KEY: 'test-elevenlabs-key',
  DID_API_KEY: 'test-did-key',
  MUAPI_API_KEY: '',
  REPLICATE_API_KEY: '',
};
const providerConfig: ReviewStepProps['providerConfig'] = {
  HEYGEN_API_KEY: 'test-heygen-key',
  HEYGEN_WEBHOOK_SECRET: '',
  RESEND_API_KEY: '',
  NOWPAYMENTS_API_KEY: '',
  ROUTING_STRATEGY: 'priority',
};

function renderLocalized(children: React.ReactNode, locale: 'en' | 'vi') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'vi' ? vietnamese : en} timeZone="Asia/Ho_Chi_Minh">
      {children}
    </NextIntlClientProvider>,
  );
}

function expectDisclosures(locale: 'en' | 'vi') {
  const copy = OPTION_A_PILOT_COPY[locale];
  expect(screen.getByText(copy.scope).tagName).toBe('P');
  expect(screen.getByText(copy.refund).tagName).toBe('P');
  const otherCopy = OPTION_A_PILOT_COPY[locale === 'vi' ? 'en' : 'vi'];
  expect(screen.queryByText(otherCopy.scope)).toBeNull();
  expect(screen.queryByText(otherCopy.refund)).toBeNull();
}

describe.each(['en', 'vi'] as const)('Option A product disclosures (%s)', (locale) => {
  const messages = locale === 'vi' ? vietnamese : en;

  it('renders landing scope and refund disclosures inside the hero alongside real content', () => {
    const { container } = renderLocalized(<LandingHeroView />, locale);
    expectDisclosures(locale);
    const hero = container.querySelector('#hero');
    expect(hero?.contains(screen.getByText(OPTION_A_PILOT_COPY[locale].scope))).toBe(true);
    expect(hero?.contains(screen.getByText(OPTION_A_PILOT_COPY[locale].refund))).toBe(true);
    expect(screen.getAllByText('OpenRouter BYOK').length).toBeGreaterThan(0);
  });

  it('keeps pilot-specific terms distinct from the existing Master refund policy', () => {
    renderLocalized(<RefundPolicyBanner />, locale);
    expectDisclosures(locale);
    expect(screen.getByText(messages.landing.pricing.refund_master_title)).toBeDefined();
    expect(screen.getByText(messages.landing.pricing.refund_master_desc, { exact: false })).toBeDefined();
  });

  it('shows disclosures before confirming a configured setup and preserves navigation callbacks', () => {
    const onConfirm = vi.fn();
    const onBack = vi.fn();
    renderLocalized(<ReviewStep config={config} providerConfig={providerConfig} onConfirm={onConfirm} onBack={onBack} />, locale);
    expectDisclosures(locale);
    expect(screen.queryByText(messages.setupWizard.review.missingRequired.title)).toBeNull();
    const confirm = screen.getByRole('button', { name: messages.setupWizard.review.actions.confirm });
    expect(confirm).toHaveProperty('disabled', false);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: messages.setupWizard.review.actions.back }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(config.OPENROUTER_API_KEY)).toBeNull();
  });

  it('retains disclosures and blocks confirmation when the required provider key is absent', () => {
    const onConfirm = vi.fn();
    renderLocalized(<ReviewStep config={config} providerConfig={{ ...providerConfig, HEYGEN_API_KEY: '' }} onConfirm={onConfirm} onBack={vi.fn()} />, locale);
    expectDisclosures(locale);
    expect(screen.getByText(messages.setupWizard.review.missingRequired.title)).toBeDefined();
    const confirm = screen.getByRole('button', { name: messages.setupWizard.review.actions.confirm });
    expect(confirm).toHaveProperty('disabled', true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('retains disclosures and prevents duplicate confirmation while saving', () => {
    const onConfirm = vi.fn();
    renderLocalized(<ReviewStep config={config} providerConfig={providerConfig} onConfirm={onConfirm} onBack={vi.fn()} loading />, locale);
    expectDisclosures(locale);
    const confirm = screen.getByRole('button', { name: messages.setupWizard.review.actions.confirm });
    expect(confirm).toHaveProperty('disabled', true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
