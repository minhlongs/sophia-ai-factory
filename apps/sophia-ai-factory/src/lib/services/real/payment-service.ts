import { IPaymentService, CreateCheckoutParams, CheckoutSession } from "../types";
import { polar } from "@/lib/polar";

export class RealPaymentService implements IPaymentService {
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const { productId, successUrl, customerEmail, metadata } = params;

    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl: successUrl,
      ...(customerEmail ? { customerEmail } : {}),
      metadata: metadata
    });

    return {
      url: checkout.url,
      id: checkout.id
    };
  }
}
