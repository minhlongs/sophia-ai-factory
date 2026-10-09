/**
 * Enterprise Deals Repository & D1 Data Access Object
 *
 * Implements:
 * - Deals CRUD and pagination
 * - BANT scoring persistence and pipeline filtering
 * - Lead enrichment caching and retrieval
 * - Pipeline metrics aggregation
 *
 * Layer: tree/sales (Pure domain logic - only imports from @/seed)
 *
 * @module tree/sales/enterprise-deal-repo
 */

export * from './deals/index';
