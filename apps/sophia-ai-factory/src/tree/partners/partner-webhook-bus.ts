/**
 * Partner Webhook Event Bus & Cryptographic Dispatcher
 *
 * Layer: tree (domain business logic & event schemas)
 * Backward compatibility facade delegating to modular `./webhook-bus` submodules.
 * All submodules strictly adhere to < 200 LOC.
 *
 * @module tree/partners/partner-webhook-bus
 */

export * from './webhook-bus/index';
