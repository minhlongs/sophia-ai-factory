import type { Tier, Gender } from '../presets';
import type {
  RegionalDialect,
  DialectProsody,
  DialectNormalizationRule,
} from '@/seed/types/cultural-adaptation';

export interface LocalizedVoiceProfile {
  id: string;
  presetId: string;
  locale: string;
  baseLanguage: string;
  dialect: RegionalDialect;
  dialectCode: string;
  displayName: string;
  gender: Gender;
  edgeVoiceName: string;
  prosody: DialectProsody;
  prosodySsmlTemplate?: string;
  lexicon: DialectNormalizationRule[];
  minTier: Tier;
  samplePath: string;
  description: string;
  status: 'active' | 'beta' | 'deprecated';
}

export interface VoiceProfileFilter {
  dialect?: RegionalDialect;
  baseLanguage?: string;
  gender?: Gender;
  minTier?: Tier;
}
