import type { LocalizedVoiceProfile } from './types';
import { VIETNAMESE_CENTRAL_SOUTHERN_PROFILES } from './vietnamese-central-southern-profiles';

/**
 * Vietnamese localized voice profiles: Bắc (Northern), Trung (Central), Nam (Southern).
 */
export const VIETNAMESE_VOICE_PROFILES: readonly LocalizedVoiceProfile[] = [
  {
    id: 'prof-vi-vn-namminh-bac',
    presetId: 'namminh-vn-bac-m',
    locale: 'vi-VN',
    baseLanguage: 'vi',
    dialect: 'vi-VN-bac',
    dialectCode: 'bac',
    displayName: 'Nam Minh (Hà Nội - Bắc Bộ)',
    gender: 'male',
    edgeVoiceName: 'vi-VN-NamMinhNeural',
    prosody: {
      pitchOffset: '+0Hz',
      rateMultiplier: 1.0,
      cadenceStyle: 'authoritative',
    },
    prosodySsmlTemplate: "<prosody rate='+0%' pitch='+0Hz'>{text}</prosody>",
    lexicon: [
      { sourceWord: 'ly', targetWord: 'cốc' },
      { sourceWord: 'bắp', targetWord: 'ngô' },
      { sourceWord: 'muỗng', targetWord: 'thìa' },
      { sourceWord: 'trễ', targetWord: 'muộn' },
    ],
    minTier: 'BASIC',
    samplePath: '/voices/namminh-vn-bac-m.wav',
    description: 'Giọng nam chuẩn Hà Nội trang trọng, sắc nét, tin cậy',
    status: 'active',
  },
  {
    id: 'prof-vi-vn-linh-bac',
    presetId: 'linh-vn-bac-f',
    locale: 'vi-VN',
    baseLanguage: 'vi',
    dialect: 'vi-VN-bac',
    dialectCode: 'bac',
    displayName: 'Linh (Hà Nội - Bắc Bộ)',
    gender: 'female',
    edgeVoiceName: 'vi-VN-HoaiMyNeural',
    prosody: {
      pitchOffset: '+2Hz',
      rateMultiplier: 1.02,
      cadenceStyle: 'standard',
    },
    prosodySsmlTemplate: "<prosody rate='+2%' pitch='+2Hz'>{text}</prosody>",
    lexicon: [
      { sourceWord: 'thơm', targetWord: 'dứa' },
      { sourceWord: 'trái cây', targetWord: 'hoa quả' },
      { sourceWord: 'heo', targetWord: 'lợn' },
    ],
    minTier: 'BASIC',
    samplePath: '/voices/linh-vn-bac-f.wav',
    description: 'Giọng nữ Hà Nội thanh lịch, chuẩn phát âm truyền hình',
    status: 'active',
  },
  ...VIETNAMESE_CENTRAL_SOUTHERN_PROFILES,
] as const;
