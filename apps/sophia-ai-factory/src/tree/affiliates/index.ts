/**
 * Affiliate domain — tree layer (core domain logic)
 */
export * from './credentials';
export * from './scout';
export * from './shortcode';
// Temporary re-exports from land until affiliate logic moves to tree
export { getTopPrograms, getProgramById, getCategories, getTags, getAllPrograms, getProgramsByTier, getProgramsByCategory, getProgramsByTag, searchPrograms, sortProgramsByEPC } from '@/land/affiliates';
