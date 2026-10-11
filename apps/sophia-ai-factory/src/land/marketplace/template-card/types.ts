/**
 * Creator Template Card Component Types
 *
 * Layer: land
 *
 * @module land/marketplace/template-card/types
 */

import type { CreatorTemplateItem } from '@/tree/marketplace/types';

export interface CreatorTemplateCardProps {
  template: CreatorTemplateItem;
  currentUserId?: string;
  onActivated?: () => void;
}

export interface CardStatusMessage {
  type: 'success' | 'error';
  text: string;
}
