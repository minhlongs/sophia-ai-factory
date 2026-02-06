import { IPaymentService, CreateCheckoutParams, CheckoutSession } from "../types";
import { polar } from "@/lib/polar";
import { getProductIdByTier } from "@/lib/polar-config";

export class RealPaymentService implements IPaymentService {
  constructor() {
    // Polar is initialized in lib/polar.ts
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const { productId, successUrl, customerEmail, metadata } = params;

    // productId in this context will be the Tier from the frontend (BASIC, PREMIUM, ENTERPRISE)
    // We need to map it to the actual Polar Product ID
    const polarProductId = getProductIdByTier(productId);

    if (!polarProductId) {
      throw new Error(`Polar Product ID not found for tier: ${productId}`);
    }

    try {
      const checkout = await polar.checkouts.create({
        products: [polarProductId],
        successUrl: successUrl,
        customerEmail: customerEmail,
        metadata: metadata as Record<string, any>,
      });

      return {
        url: checkout.url,
        id: checkout.id,
      };
    } catch (error: any) {
      throw new Error(`Failed to create checkout: ${error.message}`);
    }
  }
}
