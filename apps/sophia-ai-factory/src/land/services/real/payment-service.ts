import { IPaymentService, CreateCheckoutParams, CheckoutSession } from "../types";
import { createCheckout, createInvoiceUrl } from "@/tree/clients/nowpayments-client";
import { getErrorMessage } from "@/seed/utils/to-error";
import { logger } from "@/seed/utils/logger-utility";

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
      const userId = (metadata as Record<string, string>)?.orgId || 'default';

      try {
        const result = await createCheckout({ tierId, userId });
        return { url: result.invoiceUrl, id: result.orderId };
      } catch (sdkErr) {
        logger.warn('[PaymentService] SDK checkout failed, falling back to pre-created invoice', {
          error: getErrorMessage(sdkErr),
          tierId,
        });
        const url = createInvoiceUrl(tierId, userId);
        return { url, id: `np_${Date.now()}` };
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      throw new Error(`Failed to create checkout: ${errorMessage}`);
    }
  }
}
