export interface ListingFormInitialData {
  id?: string;
  title: string;
  description?: string;
  priceCents: number;
  category?: string;
  sopTemplateId: string;
  thumbnailUrl?: string;
}

export type ListingFormState = (
  | { ok: true; value: { listingId: string } }
  | { ok: false; error: { code: string; message: string } }
) | null;

export interface ListingFormProps {
  initialData?: ListingFormInitialData;
  mode: 'create' | 'edit';
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const LISTING_CATEGORIES = [
  'YouTube',
  'TikTok',
  'Facebook',
  'Instagram',
  'Script',
  'Voiceover',
  'Other',
] as const;
