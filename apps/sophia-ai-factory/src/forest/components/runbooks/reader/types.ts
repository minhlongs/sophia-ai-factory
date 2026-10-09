import type { RunbookMetadata, RunbookContent } from '@/seed/handover/handover-types';

export interface RunbookReaderClientProps {
  runbooks: RunbookMetadata[];
  activeRunbook: RunbookContent;
  locale: string;
}

export type SupportedLocale = 'en' | 'vi';
