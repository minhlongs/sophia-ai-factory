/**
 * Send "Bundle Generating" email via Resend.
 * Fired immediately when a videos row is inserted with status='queued'.
 * Idempotent: checks billing_events before sending to prevent duplicate sends.
 *
 * @module land/billing/email/send-bundle-generating-email
 */

export { getResend, EMAIL_TYPE } from './resend-client';
export { sendBundleGeneratingEmail, type SendBundleGeneratingInput } from './bundle-generating-email-helpers';