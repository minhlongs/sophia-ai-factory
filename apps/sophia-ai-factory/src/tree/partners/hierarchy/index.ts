/**
 * Reseller Hierarchy Submodule Barrel Export
 *
 * Layer: tree (domain business logic & D1 operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/hierarchy/index
 */

export {
  MASTER_CASCADE_OVERRIDE_RATE_PCT,
  calculateCascadeOverride,
} from './cascade-calculator';

export { detectHierarchyCycle } from './cycle-detector';

export {
  bindSubReseller,
  unbindSubReseller,
} from './reseller-binder';

export { accrueCascadeOverride } from './cascade-accrual';

export { getResellerHierarchyTree } from './tree-builder';
