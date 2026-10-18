import { afterEach, describe, expect, it, vi } from 'vitest';
import { initiateCheckoutRequest, type InitiateCheckoutParams } from './checkout-api-helper';

const makeParams = (overrides: Partial<InitiateCheckoutParams> = {}) => ({
  selectedTier: 'PREMIUM' as const,
  effectivePeriod: 'monthly' as const,
  paymentMethod: 'nowpayments' as const,
  couponCode: ' SAVE10 ',
  basePriceCents: 39900,
  locale: 'vi',
  csrfHeaders: { 'x-csrf-token': 'csrf-token' },
  onRedirectLogin: vi.fn(),
  onUpdateCheckoutData: vi.fn(),
  onSetCheckoutOpen: vi.fn(),
  onError: vi.fn(),
  ...overrides,
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('initiateCheckoutRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a trimmed coupon and CSRF token, then records the server checkout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      url: 'https://pay.example/checkout',
      orderId: 'ord-1',
      priceCents: 39900,
      discountedPriceCents: 35910,
    }));
    vi.stubGlobal('fetch', fetchMock);
    const params = makeParams();

    await initiateCheckoutRequest(params);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/checkout');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'x-csrf-token': 'csrf-token' });
    expect(JSON.parse(String(init.body))).toEqual({
      tier: 'PREMIUM',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      promoCode: 'SAVE10',
    });
    expect(params.onUpdateCheckoutData).toHaveBeenNthCalledWith(1, {
      tier: 'PREMIUM',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      priceCents: 39900,
      couponCode: 'SAVE10',
    });
    expect(params.onSetCheckoutOpen).toHaveBeenNthCalledWith(1, true);
    expect(params.onUpdateCheckoutData).toHaveBeenNthCalledWith(2, {
      tier: 'PREMIUM',
      url: 'https://pay.example/checkout',
      orderId: 'ord-1',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      priceCents: 39900,
      discountedPriceCents: 35910,
      couponCode: 'SAVE10',
    });
    expect(params.onError).not.toHaveBeenCalled();
  });

  it('omits a blank coupon and uses the base price when the response omits price data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const params = makeParams({ couponCode: '   ' });

    await initiateCheckoutRequest(params);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      tier: 'PREMIUM',
      period: 'monthly',
      paymentMethod: 'nowpayments',
    });
    expect(params.onUpdateCheckoutData).toHaveBeenNthCalledWith(1, expect.objectContaining({ couponCode: undefined }));
    expect(params.onUpdateCheckoutData).toHaveBeenNthCalledWith(2, expect.objectContaining({
      priceCents: 39900,
      discountedPriceCents: undefined,
      couponCode: undefined,
    }));
  });

  it('closes checkout and redirects to login with a localized return URL on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 401)));
    const params = makeParams();

    await initiateCheckoutRequest(params);

    expect(params.onSetCheckoutOpen).toHaveBeenNthCalledWith(1, true);
    expect(params.onSetCheckoutOpen).toHaveBeenNthCalledWith(2, false);
    expect(params.onRedirectLogin).toHaveBeenCalledWith(
      '/vi/login?next=%2Fvi%2Fcheckout%3Ftier%3DPREMIUM',
    );
    expect(params.onError).not.toHaveBeenCalled();
  });

  it('surfaces an API error and closes the checkout dialog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Coupon expired' }, 422)));
    const params = makeParams();

    await initiateCheckoutRequest(params);

    expect(params.onSetCheckoutOpen).toHaveBeenNthCalledWith(2, false);
    expect(params.onError).toHaveBeenCalledWith('Coupon expired');
    expect(params.onUpdateCheckoutData).toHaveBeenCalledTimes(1);
  });

  it('uses the response message and then a stable fallback for API errors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'Payment unavailable' }, 503))
      .mockResolvedValueOnce(jsonResponse({}, 500));
    vi.stubGlobal('fetch', fetchMock);

    const withMessage = makeParams();
    await initiateCheckoutRequest(withMessage);
    expect(withMessage.onError).toHaveBeenCalledWith('Payment unavailable');

    const withoutMessage = makeParams();
    await initiateCheckoutRequest(withoutMessage);
    expect(withoutMessage.onError).toHaveBeenCalledWith('Unable to initiate payment. Please try again.');
  });
});
