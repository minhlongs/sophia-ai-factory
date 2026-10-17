/**
 * Bilingual Natural Language Ask Router & 4-Advisor Architecture Consultation (Facade)
 *
 * Layer: tree/ask
 * Constraint: Zero :any, zero console.log/warn/error, strict one-way imports.
 *
 * @module tree/ask/ask-router
 */

export * from './ask-types';
export * from './ask-intent-categories';
export { generateArchitecturalConsultation } from './ask-advisor-consultation';
export { matchesWildcard, routeAsk } from './ask-matcher';
