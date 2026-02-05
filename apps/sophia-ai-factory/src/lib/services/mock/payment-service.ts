import { IPaymentService, CreateCheckoutParams, CheckoutSession } from "../types";

export class MockPaymentService implements IPaymentService {
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    console.log("[MockPaymentService] Creating checkout session for:", params.productId);

    // Return a dummy URL that might redirect back to the success URL
    // In a real mock scenario, we might want a page that simulates payment success
    // For now, we'll just mock the URL to be the success URL with some params

    const mockSessionId = `mock_session_${Date.now()}`;
    const successUrlWithSession = params.successUrl.replace('{CHECKOUT_SESSION_ID}', mockSessionId);

    // We could return a URL to a local "mock checkout" page if we had one.
    // Or just direct to success for zero-friction dev flow.
    return {
      url: successUrlWithSession,
      id: mockSessionId
    };
  }
}
