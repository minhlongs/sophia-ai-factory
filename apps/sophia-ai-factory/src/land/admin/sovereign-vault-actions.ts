/**
 * Sovereign Data Residency & Cryptographic Compliance Vault Server Actions
 *
 * Thin Root Facade over src/land/admin/vault-actions/
 * 100% backward compatible with existing consumers.
 *
 * Layer: land (Public business layer & server actions)
 *
 * @module land/admin/sovereign-vault-actions
 */

'use server';

export * from './vault-actions';
