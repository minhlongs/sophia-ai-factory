import { IPaymentService, CreateCheckoutParams, CheckoutSession } from "../types";
import { polar } from "@/lib/polar";

export class RealPaymentService implements IPaymentService {
  constructor() {
    // Polar is initialized in lib/polar.ts
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const { productId, successUrl, customerEmail, metadata } = params;

    // productId is ALREADY the Polar Product ID (mapped in route.ts via getProductIdByTier)
    // Do NOT call getProductIdByTier again here - that causes double-lookup bug
    if (!productId) {
      throw new Error(`Missing Polar Product ID`);
    }

    try {
      const checkout = await polar.checkouts.create({
        products: [productId],
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
