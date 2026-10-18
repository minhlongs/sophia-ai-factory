import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractWebhookMoneyValues } from './webhook-payload-extractor';

describe('affiliate webhook payload extractor', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses an attributed order ID before IDs embedded in the payload', () => {
    expect(extractWebhookMoneyValues({ conversionId: 'conversion', order_id: 'order' }, 'awin', 'attributed'))
      .toEqual({ conversionId: 'attributed', commissionCents: 0, orderValueCents: 0 });
  });

  it.each([
    [{ conversionId: 'conversion', order_id: 'snake', orderId: 'camel' }, 'conversion'],
    [{ order_id: 'snake', orderId: 'camel' }, 'snake'],
    [{ orderId: 'camel' }, 'camel'],
  ] as const)('selects the first available payload conversion ID', (payload, expectedId) => {
    expect(extractWebhookMoneyValues(payload, 'tiktok_shop').conversionId).toBe(expectedId);
  });

  it('generates a network-scoped fallback conversion ID when no ID is supplied', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(extractWebhookMoneyValues({}, 'clickbank').conversionId).toMatch(/^conv_clickbank_[a-z0-9]{1,7}$/);
  });

  it.each([
    [{ commissionCents: 987, commission_amount: 1.25, commission: 2, commissionUsd: 3 }, 987],
    [{ commission_amount: 1.256, commission: 2, commissionUsd: 3 }, 126],
    [{ commission: 2.345, commissionUsd: 3 }, 235],
    [{ commissionUsd: 3.456 }, 346],
    [{ commission: '2.00', commission_amount: null }, 0],
  ] as const)('normalizes commission fields by precedence and rounds dollar values', (payload, expectedCents) => {
    expect(extractWebhookMoneyValues(payload, 'amazon').commissionCents).toBe(expectedCents);
  });

  it.each([
    [{ orderValueCents: 501, settlement_amount: 1, revenue: 2, order_value: 3, sale_amount: 4, orderValueUsd: 5 }, 501],
    [{ settlement_amount: 1.235, revenue: 2, order_value: 3 }, 124],
    [{ revenue: 2.345, order_value: 3 }, 235],
    [{ order_value: 3.456, sale_amount: 4 }, 346],
    [{ sale_amount: 4.567, orderValueUsd: 5 }, 457],
    [{ orderValueUsd: 5.678 }, 568],
    [{ revenue: '2.00', sale_amount: null }, 0],
  ] as const)('normalizes order value fields by precedence and rounds dollar values', (payload, expectedCents) => {
    expect(extractWebhookMoneyValues(payload, 'amazon_associates').orderValueCents).toBe(expectedCents);
  });

  it('extracts commission and order amounts independently', () => {
    expect(extractWebhookMoneyValues({ commission_amount: 7.5, sale_amount: 82.25 }, 'accesstrade'))
      .toEqual({ conversionId: expect.stringMatching(/^conv_accesstrade_/), commissionCents: 750, orderValueCents: 8_225 });
  });
});
