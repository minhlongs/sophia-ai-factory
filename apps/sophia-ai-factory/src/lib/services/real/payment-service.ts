import { IPaymentService, CreateCheckoutParams, CheckoutSession } from "../types";
import { createInvoiceUrl } from "@/lib/clients/nowpayments-client";
import { getErrorMessage } from "@/lib/utils/to-error";

export class RealPaymentService implements IPaymentService {
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const { productIds, metadata } = params;

    if (!productIds || productIds.length === 0) {
      throw new Error(`Missing product IDs`);
    }

    const tierId = productIds[0].trim();
    if (!tierId) {
      throw new Error(`Product ID is empty`);
    }

    try {
      const orgId = (metadata as Record<string, string>)?.orgId || 'default';
      const url = createInvoiceUrl(tierId, orgId);

      return {
        url,
        id: `np_${Date.now()}`,
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      throw new Error(`Failed to create checkout: ${errorMessage}`);
    }
  }
}
