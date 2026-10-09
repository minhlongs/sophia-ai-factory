/**
 * Land Layer: Agency Portal & Client Onboarding Server Actions Facade
 *
 * Provides transactional server actions for:
 * 1. Step-by-step onboarding validation
 * 2. Atomic client subaccount provisioning, branding persistence, MCU allocation, and seed agent deployment
 * 3. High-performance Agency Admin Portal dashboard data aggregation with tenant isolation
 * 4. Client status management and MCU reallocation
 *
 * Layer: land (imports @/seed/*, @/tree/*; strictly zero imports from @/forest/*)
 *
 * @module land/agency/agency-portal-actions
 */

'use server';

export * from './portal-actions/index';
