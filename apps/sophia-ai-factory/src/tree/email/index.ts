/**
 * @module tree/email
 * Domain wrapper re-exports — actual implementations in forest/email
 */
export * from './email-templates';
export * from './lifecycle-email-rules';
export * from './onboarding-emails';
export * from './render-email';
export * from './sender';
export * from './week-stats';
export { SENDER_FROM } from '@/forest/email/templates/shared-layout';
