/**
 * Canonical 10-SOP Runbook Catalog.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/runbook/catalog
 */

import type { RunbookContent } from '@/seed/handover/handover-types';
import { SOPS_01_TO_03 } from './sop-01-to-03';
import { SOPS_04_TO_06 } from './sop-04-to-06';
import { SOPS_07_TO_08 } from './sop-07-to-08';
import { SOPS_09_TO_10 } from './sop-09-to-10';

export const RUNBOOK_CATALOG: RunbookContent[] = [
  ...SOPS_01_TO_03,
  ...SOPS_04_TO_06,
  ...SOPS_07_TO_08,
  ...SOPS_09_TO_10,
];
