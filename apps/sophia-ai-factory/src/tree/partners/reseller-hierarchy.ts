/**
 * Enterprise Reseller Federation & Multi-Tier Agency Hierarchy Domain Service
 *
 * Layer: tree (domain business logic, math models & D1 database operations)
 * Backward compatibility facade delegating to modular `./hierarchy` submodules.
 * All submodules strictly adhere to < 200 LOC.
 *
 * @module tree/partners/reseller-hierarchy
 */

export * from './hierarchy/index';
