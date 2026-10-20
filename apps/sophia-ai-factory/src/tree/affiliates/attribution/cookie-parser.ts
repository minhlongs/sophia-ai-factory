/**
 * Cookies and Referrer Parser Utilities — Barrel
 *
 * Implementation lives in `./partner-code-resolver` and `./referred-by-extractor`.
 * This barrel keeps the historical import path stable for existing callers.
 *
 * Layer: tree (domain business logic, edge-compatible)
 *
 * @module tree/affiliates/attribution/cookie-parser
 */

export { extractReferredByFromSettings } from './referred-by-extractor';
export { resolveReferrerPartner } from './partner-code-resolver';
