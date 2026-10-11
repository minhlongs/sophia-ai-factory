/**
 * Server-side data access for the YouTube content pipeline dashboard.
 * Reads from D1 tables created by migration 0252.
 * All queries are ownership-checked by userId.
 */

export * from './data/index';
