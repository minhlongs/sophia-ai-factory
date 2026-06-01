/** * @module sop/seeds * Barrel re-exports for SOP seed data. * Playbook entries import SopSeedEntry from here. */
import type { SopSeedEntry } from '@/lib/sop/seeds';
// Re-export the type so `import type { SopSeedEntry } from '../../index'` works
export type { SopSeedEntry };
