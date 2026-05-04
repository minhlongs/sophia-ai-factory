/**
 * Email Tracking Service
 *
 * Logs email delivery events to the billing_events table.
 * Tracks sent/failed emails with metadata for audit purposes.
 *
 * @module billing/email/email-tracking-service
 */

import { createServerClient } from '@/seed/db/client';
import type { EmailTemplateType, BillingEmailContext } from './types';

/**
 * Map email type to billing event type string
 */
function mapTypeToEventType(type: EmailTemplateType): string {
  switch (type) {
    case 'payment_failed': return 'payment_failed_email';
    case 'grace_period_warning': return 'grace_period_email';
    case 'suspension_notice': return 'suspension_email';
    case 'payment_succeeded': return 'payment_success_email';
    case 'overage_detected': return 'overage_email';
  }
}

/**
 * Log email delivery to billing_events table
 *
 * @param context - Email recipient context
 * @param type - Template type
 * @param subject - Email subject line
 * @param sent - Whether email was successfully delivered
 * @param emailId - Resend email ID if sent
 */
export async function logEmailDelivery(
  context: BillingEmailContext,
  type: EmailTemplateType,
  subject: string,
  sent: boolean,
  emailId?: string
): Promise<void> {
  const db = createServerClient();

  await db.from('billing_events').insert({
    user_id: context.userId,
    license_nonce: context.licenseNonce,
    event_type: mapTypeToEventType(type),
    event_category: 'notification',
    event_data: {
      template_type: type,
      subject,
      email_id: emailId,
    },
    email_sent: sent,
    email_template: type,
    email_recipient: context.userEmail,
    email_sent_at: sent ? new Date().toISOString() : null,
    processed: true,
    processed_at: new Date().toISOString(),
  });
}
