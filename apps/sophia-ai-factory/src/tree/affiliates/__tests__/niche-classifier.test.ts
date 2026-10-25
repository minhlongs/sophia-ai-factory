/**
 * Tests for niche classification.
 *
 * The property that matters most is that a financially regulated offer is never
 * downgraded into a vertical without a compliance gate, because that silently
 * removes protection downstream.
 */

import { describe, it, expect } from 'vitest';
import { classifyOfferVertical, isRegulatedVertical } from '../niche-classifier';

describe('regulated verticals are detected', () => {
  it('classifies exchange offers as crypto', () => {
    expect(classifyOfferVertical({ category: 'Crypto Exchange', productName: 'KuCoin' })).toBe('crypto');
    expect(classifyOfferVertical({ category: 'Exchange', productName: 'Bybit rebate' })).toBe('crypto');
  });

  it('classifies trading offers as trading', () => {
    expect(classifyOfferVertical({ category: 'Trading Platform' })).toBe('trading');
    expect(classifyOfferVertical({ category: 'undefined', productName: 'forex signal service' })).toBe('trading');
  });

  it('classifies fintech offers as finance', () => {
    expect(classifyOfferVertical({ category: 'Fintech', productName: 'Business banking' })).toBe('finance');
  });
});

describe('unregulated verticals are detected', () => {
  it('classifies workflow/CRM offers as saas', () => {
    expect(classifyOfferVertical({ category: 'Workflow', productName: 'SmartSuite' })).toBe('saas');
    expect(classifyOfferVertical({ category: 'CRM' })).toBe('saas');
  });

  it('classifies storefront offers as ecommerce', () => {
    expect(classifyOfferVertical({ category: 'E-Commerce', productName: 'Shopify' })).toBe('ecommerce');
  });

  it('falls back to other when nothing matches', () => {
    expect(classifyOfferVertical({ category: 'mystery box', productName: 'thing' })).toBe('other');
  });
});

describe('no downgrade of regulated offers', () => {
  it('crypto token beats a saas-looking category', () => {
    expect(classifyOfferVertical({ category: 'SaaS', productName: 'USDT payment automation' })).toBe('crypto');
  });

  it('trading token beats a finance-looking category', () => {
    expect(classifyOfferVertical({ category: 'Fintech', productName: 'CFD trading desk' })).toBe('trading');
  });

  it('crypto is preferred over trading when both appear', () => {
    expect(classifyOfferVertical({ category: 'trading', productName: 'crypto futures' })).toBe('crypto');
  });
});

describe('empty input is safe', () => {
  it('null category and name resolve to other', () => {
    expect(classifyOfferVertical({ category: null, productName: null })).toBe('other');
  });

  it('empty strings resolve to other', () => {
    expect(classifyOfferVertical({ category: '', productName: '' })).toBe('other');
  });
});

describe('isRegulatedVertical', () => {
  it('marks crypto, trading and finance as regulated', () => {
    expect(isRegulatedVertical('crypto')).toBe(true);
    expect(isRegulatedVertical('trading')).toBe(true);
    expect(isRegulatedVertical('finance')).toBe(true);
  });

  it('does not mark saas, ecommerce or other as regulated', () => {
    expect(isRegulatedVertical('saas')).toBe(false);
    expect(isRegulatedVertical('ecommerce')).toBe(false);
    expect(isRegulatedVertical('other')).toBe(false);
  });
});
