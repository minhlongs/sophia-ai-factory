/**
 * Commerce Interfaces — public API barrel.
 *
 * Digital product catalog, order lifecycle, idempotent fulfillment, and the
 * NOWPayments payment-confirmation bridge. Internal helpers (row mappers, id
 * generators) are NOT re-exported.
 *
 * @module land/commerce
 */
export {
  PRODUCT_TYPES,
  type ProductType,
  ProductInputSchema,
  type ProductInput,
  ProductUpdateSchema,
  type ProductUpdate,
  type CommerceProduct,
  type CommerceErrorCode,
  type CommerceError,
  createProduct,
  getProduct,
  listProducts,
  updateProduct,
  deactivateProduct,
} from './product-catalog';

export {
  ORDER_STATUSES,
  type OrderStatus,
  OrderInputSchema,
  type OrderInput,
  type CommerceOrder,
  type OrderErrorCode,
  type OrderError,
  type MarkPaidOk,
  buildCommerceEventId,
  createOrder,
  getOrder,
  markOrderPaid,
  markOrderFulfilled,
} from './commerce-order';

export {
  type FulfillmentErrorCode,
  type FulfillmentError,
  type FulfillmentOk,
  buildGrantRef,
  fulfillOrder,
} from './digital-fulfillment';

export {
  CommercePaymentSchema,
  type CommercePaymentInput,
  type PaymentErrorCode,
  type PaymentError,
  type PaymentOk,
  confirmCommercePayment,
} from './commerce-payment';