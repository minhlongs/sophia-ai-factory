import { IPaymentService, CreateCheckoutParams, CheckoutSession } from "../types";
import { polar } from "@/lib/polar";

export class RealPaymentService implements IPaymentService {
  constructor() {
    // Polar is initialized in lib/polar.ts
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const { productIds, successUrl, customerEmail, metadata } = params;

    // Validate product IDs
    if (!productIds || productIds.length === 0) {
      throw new Error(`Missing Polar Product IDs`);
    }

    // Trim all product IDs to remove any trailing whitespace/newlines
    const cleanProductIds = productIds.map(id => id.trim()).filter(id => id.length > 0);

    if (cleanProductIds.length === 0) {
      throw new Error(`All Product IDs are empty after cleanup`);
    }

    try {
      const checkout = await polar.checkouts.create({
        products: cleanProductIds,
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
