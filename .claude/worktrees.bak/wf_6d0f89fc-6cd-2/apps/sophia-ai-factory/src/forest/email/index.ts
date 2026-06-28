/**
 * Email Domain — Public API (placeholder)
 * Layer: forest
 * Note: Actual email sending is implemented in tree/email
 * Forest may contain email-related orchestrators in the future
 */

// Re-export from tree for convenience (forest can import tree)
export { sendEmail, type EmailParams, type EmailResult } from '@/tree/email/sender';
