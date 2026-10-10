export type TemplateCategory = 'marketing' | 'notifications' | 'support';

export interface TemplatePack {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  variables: string[];
  example: string;
}

export type TemplateStep = 'select' | 'edit' | 'confirm';

export const TEMPLATE_PACKS: TemplatePack[] = [
  {
    id: 'marketing_welcome',
    name: 'Marketing Welcome',
    description: 'Welcome new customers with a promotional offer',
    category: 'marketing',
    variables: ['customer_name', 'discount_code', 'expiry_date'],
    example: 'Hi {{customer_name}}, welcome to our store! Use code {{discount_code}} for 20% off. Expires {{expiry_date}}.',
  },
  {
    id: 'marketing_promo',
    name: 'Promotional Campaign',
    description: 'Announce a new product or sale',
    category: 'marketing',
    variables: ['product_name', 'promo_price', 'cta_link'],
    example: 'New arrival: {{product_name}} at just {{promo_price}}! Shop now: {{cta_link}}',
  },
  {
    id: 'marketing_abandoned_cart',
    name: 'Abandoned Cart Recovery',
    description: 'Recover lost sales with a gentle reminder',
    category: 'marketing',
    variables: ['customer_name', 'product_name', 'cart_link'],
    example: 'Hey {{customer_name}}, you left {{product_name}} in your cart. Complete your order: {{cart_link}}',
  },
  {
    id: 'notifications_order_confirmed',
    name: 'Order Confirmed',
    description: 'Confirm order details and delivery estimate',
    category: 'notifications',
    variables: ['order_id', 'customer_name', 'delivery_date'],
    example: 'Order {{order_id}} confirmed for {{customer_name}}. Expected delivery: {{delivery_date}}.',
  },
  {
    id: 'notifications_shipping_update',
    name: 'Shipping Update',
    description: 'Notify customer about shipment status',
    category: 'notifications',
    variables: ['order_id', 'tracking_number', 'carrier'],
    example: 'Your order {{order_id}} has shipped! Track with {{carrier}}: {{tracking_number}}',
  },
  {
    id: 'notifications_payment_received',
    name: 'Payment Received',
    description: 'Confirm payment receipt',
    category: 'notifications',
    variables: ['amount', 'payment_method', 'invoice_number'],
    example: 'Payment of {{amount}} received via {{payment_method}}. Invoice: {{invoice_number}}',
  },
  {
    id: 'support_ticket_created',
    name: 'Support Ticket Created',
    description: 'Acknowledge support request',
    category: 'support',
    variables: ['ticket_id', 'customer_name', 'estimated_response'],
    example: 'Hi {{customer_name}}, ticket {{ticket_id}} created. We\'ll respond within {{estimated_response}}.',
  },
  {
    id: 'support_issue_resolved',
    name: 'Issue Resolved',
    description: 'Notify customer that their issue is fixed',
    category: 'support',
    variables: ['ticket_id', 'customer_name', 'resolution_summary'],
    example: 'Ticket {{ticket_id}} resolved for {{customer_name}}. Summary: {{resolution_summary}}',
  },
];
