/**
 * Dynamic Multi-Currency Foreign Exchange (FX) Converter
 *
 * Implements multi-currency conversion across USD, VND, EUR, JPY, SGD with
 * multi-tier resilience:
 * 1. Cloudflare KV Cache
 * 2. Live Edge Provider (with strict timeout)
 * 3. Static Bedrock Fallback Rates
 *
 * Layer: tree/billing (Pure domain service — imports only from seed)
 *
 * @module tree/billing/fx-converter
 */

export * from './fx/index';
