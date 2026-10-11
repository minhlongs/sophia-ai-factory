/**
 * Executive BI Digest Submodule Index
 *
 * Layer: forest
 *
 * @module forest/bi/digest
 */

export * from './types';
export {
  renderExecutiveDigestInnerHtml,
  formatEmailDigest,
} from './html-template-builder';
export {
  prepareDigestMetrics,
  extractRecipients,
  type PreparedDigestMetrics,
} from './digest-aggregator';
export {
  sendEmailExecutiveDigest,
  sendEmailDigest,
} from './email-digest-service';
