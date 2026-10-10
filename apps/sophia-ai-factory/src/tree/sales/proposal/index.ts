/**
 * Bilingual Enterprise Solution Proposal Generation & Quality Certification Engine
 * Layer: tree/sales (Pure domain logic)
 *
 * @module tree/sales/proposal
 */

export {
  MINIMUM_WORD_COUNT,
  MANDATORY_SECTIONS_EN,
  MANDATORY_SECTIONS_VI,
  countWords,
  verifyProposalQuality,
  parseProposalSections,
} from './types';
export type { ProposalQualityResult } from './types';

export { buildCanonicalEnglishProposal } from './pricing-calculator';
export { buildCanonicalVietnameseProposal } from './terms-generator';
export { generateEnterpriseProposal } from './proposal-service';
