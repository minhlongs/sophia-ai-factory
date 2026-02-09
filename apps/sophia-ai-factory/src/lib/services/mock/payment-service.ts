import { IPaymentService, CreateCheckoutParams, CheckoutSession } from "../types";

export class MockPaymentService implements IPaymentService {
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {

    // Return a dummy URL that might redirect back to the success URL
    const mockSessionId = `mock_session_${Date.now()}`;
    const successUrlWithSession = params.successUrl.replace('{CHECKOUT_SESSION_ID}', mockSessionId);

    return {
      url: successUrlWithSession,
      id: mockSessionId
    };
  }
}
