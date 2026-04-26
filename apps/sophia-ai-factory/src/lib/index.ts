/**
 * Sophia AI Factory - Modular Architecture Entry Point (10x Standard)
 */

export * as Core from './core';
export * as AI from './ai';
export * as Shared from './shared';

// Selective top-level exports for common use cases
export { ServiceFactory } from './ai';
export { OpenClawGateway } from './core';
export { getEnvironmentConfig as Config } from './shared';
